import net from 'net';

// Wire protocol ของ SID-U881-8dbi (SDK: SDK-SID-u881-8dbi) แกะได้จากการดักแพ็กเก็ตจริงระหว่าง
// โปรแกรม demo (SID_U861 CSharp) คุยกับเครื่องผ่าน TCP/IP (คนละโปรโตคอลกับที่ระบุใน .doc ของ SDK
// ซึ่งมีแค่ signature ของฟังก์ชัน DLL ไม่มีระดับ byte) โครงเฟรม:
//   [Len(1)] [Adr(1)] [Cmd(1)] [Data(N)] [CRC16 LSB] [CRC16 MSB]
// โดย Len = จำนวน byte ที่เหลือหลังจากตัวมันเอง (Adr+Cmd+Data+CRC) และ CRC16 คำนวณจากทุก byte
// ในเฟรมรวม Len ด้วย (CRC-16/X-25: poly 0x1021 reflected แบบ MSB-first shift, init 0xFFFF)
const READER_ADDR = 0x00;
const CMD_INVENTORY = 0x01;
// Data ของคำสั่ง inventory ที่ demo ส่งจริงตอนกด "Query Tag" — ยังไม่ทราบความหมายของแต่ละ byte
// ชัดเจน (อาจเป็น Q-value/session) จึง replay ค่าที่ยืนยันแล้วว่าใช้งานได้จริงไปก่อน
const INVENTORY_DATA = Buffer.from([0x04, 0x00]);

function crc16(bytes) {
  let crc = 0xffff;
  for (let byte of bytes) {
    for (let i = 0; i < 8; i += 1) {
      const bit = (byte ^ crc) & 0x01;
      crc >>= 1;
      if (bit) crc ^= 0x8408;
      byte >>= 1;
    }
  }
  return crc & 0xffff;
}

function buildFrame(cmd, data = Buffer.alloc(0), adr = READER_ADDR) {
  const len = 1 + 1 + data.length + 2; // Adr + Cmd + Data + CRC(2)
  const withoutCrc = Buffer.concat([Buffer.from([len, adr, cmd]), data]);
  const crc = crc16(withoutCrc);
  return Buffer.concat([withoutCrc, Buffer.from([crc & 0xff, (crc >> 8) & 0xff])]);
}

// แกะรายการแท็กจาก buffer ที่ต่อกันมาหลายเฟรม (แต่ละแท็ก 1 เฟรมแยกกัน ไม่ได้รวมเป็นก้อนเดียว)
// โครงเฟรมแท็กจริงของ SID R2000 4 พอร์ต (ดักจากเครื่องที่ซุ้ม 192.168.1.250) — มี header 3 byte
// คั่นระหว่าง Cmd กับ EPCLen ไม่ใช่ 2 byte:
//   Len, Adr, Cmd(0x01), Ant, b4, b5, EPCLen, EPC(EPCLen byte), RSSI, CRC16(2)
//   ตัวอย่าง: 15 00 01 | 03 01 01 | 0C | E2 80 68 90 00 00 00 00 00 00 07 57 | 4B | 9C 90
// เฟรมปิดท้าย (สรุปผล ไม่มี EPC): Len=0x07, Adr, Cmd, 01, XX, 00, CRC(2) — XX=0x02 เมื่อไม่เจอแท็ก,
// 0x01 เมื่อมีแท็ก — ข้ามทิ้งเพราะ EPCLen จะเป็น 0
function parseFrames(buffer) {
  const epcs = [];
  let offset = 0;
  while (offset < buffer.length) {
    const len = buffer[offset];
    const frameEnd = offset + 1 + len;
    if (frameEnd > buffer.length) break; // เฟรมยังมาไม่ครบ รอรอบถัดไป

    const cmd = buffer[offset + 2];
    // เฟรมแท็ก: Len = Adr+Cmd+Ant+b4+b5+EPCLenByte+EPC+RSSI+CRC = 9 + EPCLen → ต้อง >= 10
    if (cmd === CMD_INVENTORY && len >= 10) {
      const ant = buffer[offset + 3];
      const epcLen = buffer[offset + 6];
      const epcStart = offset + 7;
      const epcEnd = epcStart + epcLen;
      // ตรวจว่า EPCLen สอดคล้องกับ Len และมี RSSI(1)+CRC(2) ต่อท้ายพอดีถึงท้ายเฟรม
      if (epcLen > 0 && epcLen === len - 9 && epcEnd + 3 === frameEnd) {
        const epc = buffer.subarray(epcStart, epcEnd).toString('hex').toUpperCase();
        const rssiRaw = buffer[epcEnd];
        epcs.push({ epc, rssi: rssiRaw, ant });
      }
    }
    offset = frameEnd;
  }
  return epcs;
}

/**
 * เชื่อมต่อไปที่เครื่องอ่าน RFID ผ่าน TCP/IP, สั่ง inventory 1 รอบ, เก็บผลจนกว่าจะเงียบ
 * (idle timeout) แล้วปิดการเชื่อมต่อ — ใช้ต่อ-ยิง-ปิดทุกครั้งแทนที่จะเปิดค้างไว้ เพราะ Answer Mode
 * ของเครื่องนี้ตอบตามคำสั่งเท่านั้น ไม่ต้อง maintain persistent connection
 */
export function queryTags({ ip, port, connectTimeoutMs = 5000, idleTimeoutMs = 1500 }) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    let idleTimer = null;
    let settled = false;

    const finish = (result, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(idleTimer);
      socket.destroy();
      if (error) reject(error);
      else resolve(result);
    };

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        finish({ epcs: parseFrames(buffer) });
      }, idleTimeoutMs);
    };

    socket.setTimeout(connectTimeoutMs);

    socket.on('connect', () => {
      socket.setTimeout(0);
      socket.write(buildFrame(CMD_INVENTORY, INVENTORY_DATA));
      resetIdleTimer();
    });

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      resetIdleTimer();
    });

    socket.on('timeout', () => {
      finish(null, new Error('เชื่อมต่อเครื่องอ่าน RFID ไม่สำเร็จ (connection timeout)'));
    });

    socket.on('error', (err) => {
      finish(null, err);
    });

    socket.connect({ host: ip, port });
  });
}
