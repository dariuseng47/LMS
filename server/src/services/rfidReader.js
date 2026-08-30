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
// แกะเฟรมที่ครบแล้วออกจาก buffer, คืน { epcs, rest } โดย rest = ไบต์ของเฟรมที่ยังมาไม่ครบ
// (เก็บไว้ต่อกับ chunk รอบถัดไป) — เรียกซ้ำได้ทุกครั้งที่มีข้อมูลเข้ามาระหว่างสแกนหลายรอบ
function drainFrames(buffer) {
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
  return { epcs, rest: buffer.subarray(offset) };
}

// ค่า default ปรับได้ผ่าน env เผื่อจูนหน้างานโดยไม่ต้องแก้โค้ด
const DEFAULT_SCAN_DURATION_MS = Number(process.env.RFID_SCAN_DURATION_MS) || 3000;
const DEFAULT_POLL_INTERVAL_MS = Number(process.env.RFID_POLL_INTERVAL_MS) || 200;

// RFID_DEBUG=1 -> log ทุกขั้นตอนตอนคุยกับเครื่องอ่าน (ต่อ/ส่ง/รับ byte ดิบ/สรุปผล) ลง server log
// ใช้ debug ตอน bring-up เครื่องใหม่ว่า "ต่อไม่ติด" หรือ "ต่อติดแต่เฟรมไม่ตรงรูปแบบที่ parse ได้"
const DEBUG = process.env.RFID_DEBUG === '1' || process.env.RFID_DEBUG === 'true';
const hex = (buf) => buf.toString('hex').replace(/(..)/g, '$1 ').trim();
const dbg = (...args) => {
  if (DEBUG) console.log('[rfid-reader]', ...args);
};

/**
 * เชื่อมต่อไปที่เครื่องอ่าน RFID ผ่าน TCP/IP แล้วสั่ง inventory ซ้ำๆ ตลอดช่วง scanDurationMs
 * (ทุก pollIntervalMs) สะสม EPC ที่อ่านได้แบบไม่ซ้ำ จากนั้นปิดการเชื่อมต่อ — Answer Mode ของ
 * เครื่องนี้ตอบแค่ 1 รอบต่อคำสั่ง และแต่ละรอบมักอ่านแท็กไม่ครบ (RF collision + วนเสาอากาศ 4 พอร์ต)
 * จึงต้องยิงซ้ำหลายรอบให้แท็กทุกชิ้นมีโอกาสตอบ ไม่งั้น "สแกนไว" จนได้ผลว่างเปล่า
 */
export function queryTags({
  ip,
  port,
  connectTimeoutMs = 5000,
  scanDurationMs = DEFAULT_SCAN_DURATION_MS,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
  // รองรับพารามิเตอร์เดิม: ถ้าส่ง idleTimeoutMs มา ใช้เป็นช่วงสแกนแทน (กันสคริปต์เก่าพัง)
  idleTimeoutMs,
}) {
  const duration = idleTimeoutMs ? Math.max(idleTimeoutMs, scanDurationMs) : scanDurationMs;

  const inventoryFrame = buildFrame(CMD_INVENTORY, INVENTORY_DATA);
  dbg(`ต่อ ${ip}:${port} | ช่วงสแกน ${duration}ms ทุก ${pollIntervalMs}ms | ส่ง ${hex(inventoryFrame)}`);

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    let rxBytes = 0; // นับ byte ดิบทั้งหมดที่รับมา ไว้แยก "ต่อไม่ติด" ออกจาก "ต่อติดแต่ parse ไม่ได้"
    let polls = 0;
    const found = new Map(); // epc -> { epc, rssi, ant } (เก็บ rssi ที่แรงสุดที่เจอ)
    let pollTimer = null;
    let stopTimer = null;
    let settled = false;

    const sendInventory = () => {
      if (settled) return;
      polls += 1;
      socket.write(inventoryFrame);
    };

    const finish = (result, error) => {
      if (settled) return;
      settled = true;
      clearInterval(pollTimer);
      clearTimeout(stopTimer);
      socket.destroy();
      if (error) {
        dbg(`จบแบบ error: ${error.message} (ส่ง ${polls} รอบ, รับ ${rxBytes} byte)`);
        reject(error);
      } else {
        dbg(
          `จบ: ส่ง ${polls} รอบ, รับ ${rxBytes} byte, ได้ ${result.epcs.length} แท็ก` +
            (rxBytes > 0 && result.epcs.length === 0
              ? ' — เครื่องตอบมาแต่ไม่ตรงรูปแบบเฟรมที่ parse ได้ (ตรวจ CMD/โครงเฟรมของรุ่นนี้)'
              : '')
        );
        resolve(result);
      }
    };

    socket.setTimeout(connectTimeoutMs);

    socket.on('connect', () => {
      dbg('ต่อสำเร็จ เริ่มยิง inventory');
      socket.setTimeout(0);
      sendInventory();
      pollTimer = setInterval(sendInventory, pollIntervalMs);
      stopTimer = setTimeout(() => finish({ epcs: [...found.values()] }), duration);
    });

    socket.on('data', (chunk) => {
      rxBytes += chunk.length;
      dbg(`<< ${chunk.length}B  ${hex(chunk)}`);
      buffer = Buffer.concat([buffer, chunk]);
      const { epcs, rest } = drainFrames(buffer);
      buffer = rest;
      for (const tag of epcs) {
        const prev = found.get(tag.epc);
        if (!prev || tag.rssi > prev.rssi) found.set(tag.epc, tag);
      }
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
