// สำเนาจาก server/src/services/rfidReader.js — ถ้าแก้โปรโตคอลฝั่ง server ให้ copy มาทับไฟล์นี้ด้วย
import net from 'net';

// Wire protocol ของ SID-U881-8dbi (SDK: SDK-SID-u881-8dbi) แกะได้จากการดักแพ็กเก็ตจริงระหว่าง
// โปรแกรม demo (SID_U861 CSharp) คุยกับเครื่องผ่าน TCP/IP + disassemble SID_U861.dll โครงเฟรม:
//   [Len(1)] [Adr(1)] [Cmd(1)] [Data(N)] [CRC16 LSB] [CRC16 MSB]
// โดย Len = จำนวน byte ที่เหลือหลังจากตัวมันเอง (Adr+Cmd+Data+CRC) และ CRC16 คำนวณจากทุก byte
// ในเฟรมรวม Len ด้วย (CRC-16/X-25: poly 0x1021 reflected แบบ MSB-first shift, init 0xFFFF)
// เฟรมตอบกลับ: [Len] [Adr] [reCmd] [Status] [Data...] [CRC16] — Status ของ inventory ตามคู่มือ DLL
// (Inventory_G2): 0x01 = รอบนี้จบ (อ่านหมดก่อนหมดเวลา), 0x02 = หมดเวลา InventoryScanTime,
// 0x03 = ยังมีข้อมูลตามมาอีก (เฟรมที่มี EPC), 0x04 = buffer ในเครื่องเต็ม
const READER_ADDR = 0x00;
const CMD_INVENTORY = 0x01;
// Data ของ inventory = [Qvalue, Session] (ตาม signature Inventory_G2 ในคู่มือ DLL) — Q=4, Session 0
// เป็นค่าที่ demo ส่งจริงตอนกด "Query Tag"
const INVENTORY_DATA = Buffer.from([0x04, 0x00]);
const STATUS_MORE_DATA = 0x03;

// SetPowerDbm — ยืนยันจากการ disassemble SID_U861.dll (export SetPowerDbm @ RVA 0x54c0):
//   เฟรม = [Len=0x05] [Adr] [Cmd=0x2F] [powerDbm 1 byte] [CRC16 lo] [CRC16 hi]
//   powerDbm: คู่มือ U861 บอก 0-18 แต่ DLL ไม่ได้ตรวจช่วงเอง (เครื่องเป็นคนตัดสิน) เครื่อง 4 พอร์ต R2000
//   ทั่วไปรองรับถึง 30 จึงเปิดถึง 30 — ค่าที่เครื่องไม่รับจะตอบ status ≠ 0 (ดูได้จากผล settings / test-reader)
//   เครื่องตอบ status ที่ byte[3] และอ่านค่าที่มีผลจริงกลับได้ด้วย readReaderInfo() (byte 10)
// (env RFID_SET_POWER_CMD ไว้ override เผื่อรุ่นอื่น — ปกติไม่ต้องตั้ง)
const CMD_SET_POWER = process.env.RFID_SET_POWER_CMD
  ? parseInt(process.env.RFID_SET_POWER_CMD, 16)
  : 0x2f;

const MAX_POWER_DBM = 30;

// WriteScanTime — ยืนยันจากการ disassemble SID_U861.dll (export WriteScanTime @ RVA 0x5180):
//   เฟรม = [Len=0x05] [Adr] [Cmd=0x25] [ScanTime 1 byte] [CRC16] — หน่วย 100ms ช่วง 3-255
//   = เวลาสูงสุดของ inventory 1 รอบ (ค่าเริ่มต้นในเครื่อง 30 = 3 วินาที) เครื่อง 4 พอร์ตวนเสาทีละต้น
//   ต่อรอบ ค่ายิ่งต่ำ = สลับเสาเร็วขึ้น ("อ่านรัว") แต่ต่อรอบอ่านได้น้อยลงถ้าแท็กเยอะมาก
// ค่านี้น่าจะถูกเก็บลงหน่วยความจำถาวรของเครื่อง จึงส่งเฉพาะตอนค่าเปลี่ยน (จำไว้ต่อ process) ไม่ส่งทุกรอบ
const CMD_SET_SCAN_TIME = 0x25;
const appliedScanTime = new Map(); // "ip:port" -> scanTime ที่สั่งไปแล้ว

// รอ ack ของคำสั่งตั้งค่า (set power / scan time) สูงสุดเท่านี้ — ปกติเครื่องตอบในไม่กี่สิบ ms
const SETTING_ACK_TIMEOUT_MS = 300;

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

// แกะเฟรมที่ "มาครบแล้ว" จาก buffer (แต่ละแท็ก 1 เฟรมแยกกัน) คืน:
//   tags      = แท็กที่เจอ
//   roundEnds = จำนวนเฟรม "จบรอบ inventory" (เฟรมสั้นไม่มี EPC, status ไม่ใช่ 0x03)
//   acks      = เฟรมตอบคำสั่งอื่นที่ไม่ใช่ inventory [{ cmd, status }]
//   rest      = byte ท้ายที่ยังมาไม่ครบเฟรม (เก็บไว้ต่อกับ chunk ถัดไป)
// เครื่องอ่านคนละรุ่นมี header ก่อน EPCLen ยาวไม่เท่ากัน จึงลองทีละ layout เอาอันที่ "ตรงเป๊ะ"
// (EPCLen ต้องสอดคล้องกับ Len และมี RSSI(1)+CRC(2) ต่อท้ายพอดีถึงท้ายเฟรม)
//   R2000 4 พอร์ต (192.168.1.250): Len,Adr,Cmd,Status,Ant,Num,EPCLen,EPC,RSSI,CRC16  → EPCLen ที่ offset 6
//     ตัวอย่าง: 15 00 01 | 03 01 01 | 0C | E2 80 68 90 00 00 00 00 00 00 07 57 | 4B | 9C 90
//   คีออสตรวจสอบ (192.168.1.190): Len,Adr,Cmd,Status,Num,EPCLen,EPC,RSSI,CRC16       → EPCLen ที่ offset 5
//     ตัวอย่าง: 14 00 01 | 03 01 | 0C | E2 80 69 15 00 00 50 20 7D 83 70 35 | 69 | 06 64
// เฟรมจบรอบ: 4 พอร์ต Len=7 (Status,Ant,Num=0) / คีออส Len=6 (Status,Num=0) — status 0x01/0x02
const TAG_FRAME_LAYOUTS = [
  { epcLenOffset: 6, nonEpcBytes: 9, antOffset: 4 },
  { epcLenOffset: 5, nonEpcBytes: 8, antOffset: null },
];

function parseFrames(buffer) {
  const tags = [];
  const acks = [];
  let roundEnds = 0;
  let offset = 0;
  while (offset < buffer.length) {
    const len = buffer[offset];
    const frameEnd = offset + 1 + len;
    if (frameEnd > buffer.length) break; // เฟรมยังมาไม่ครบ รอ chunk ถัดไป

    const cmd = buffer[offset + 2];
    const status = buffer[offset + 3];
    if (cmd === CMD_INVENTORY && len >= 10) {
      for (const { epcLenOffset, nonEpcBytes, antOffset } of TAG_FRAME_LAYOUTS) {
        const epcLen = buffer[offset + epcLenOffset];
        const epcStart = offset + epcLenOffset + 1;
        const epcEnd = epcStart + epcLen;
        if (epcLen > 0 && epcLen === len - nonEpcBytes && epcEnd + 3 === frameEnd) {
          tags.push({
            epc: buffer.subarray(epcStart, epcEnd).toString('hex').toUpperCase(),
            rssi: buffer[epcEnd],
            ant: antOffset === null ? null : buffer[offset + antOffset],
          });
          break;
        }
      }
    } else if (cmd === CMD_INVENTORY && len >= 4 && status !== STATUS_MORE_DATA) {
      roundEnds += 1;
    } else if (cmd !== CMD_INVENTORY && len >= 4) {
      acks.push({ cmd, status });
    }
    offset = frameEnd;
  }
  return { tags, roundEnds, acks, rest: buffer.subarray(offset) };
}

// ค่า default ปรับได้ผ่าน env เผื่อจูนหน้างานโดยไม่ต้องแก้โค้ด
// idleTimeout   = (สำรอง) เงียบนานเท่านี้ = ถือว่ารอบนั้นจบ — ใช้เฉพาะกับเครื่องที่ไม่ส่งเฟรมจบรอบ
//                 ถ้าเครื่องส่งเฟรมจบรอบ (SID ส่ง) จะยิงรอบถัดไปทันทีที่ได้เฟรมนั้น ไม่มีช่วงเครื่องว่าง
// stableRounds  = ยิง inventory ซ้ำจนกว่าจะไม่เจอ EPC ใหม่ติดกันครบกี่ "รอบวนเสา" ถึงจะถือว่าอ่านครบ
//                 (คูณจำนวนเสาที่เห็นแท็ก เพราะเครื่อง 4 พอร์ตอ่านทีละเสาต่อรอบ — กันหยุดก่อนเสาอื่นได้อ่าน)
// maxWait/maxRounds = เพดานกันค้าง ถ้าเครื่องสตรีมไม่หยุด หรือเจอแท็กใหม่เรื่อยๆ ไม่จบสักที
const DEFAULT_IDLE_TIMEOUT_MS = Number(process.env.RFID_IDLE_TIMEOUT_MS) || 800;
const DEFAULT_STABLE_ROUNDS = Number(process.env.RFID_STABLE_ROUNDS) || 3;
const DEFAULT_MAX_WAIT_MS = Number(process.env.RFID_MAX_WAIT_MS) || 15000;
const DEFAULT_MAX_ROUNDS = Number(process.env.RFID_MAX_ROUNDS) || 100;

// RFID_DEBUG=1 -> log ทุกขั้นตอนตอนคุยกับเครื่องอ่าน (ต่อ/ส่ง/รับ byte ดิบ/สรุปผล) ลง log
// ใช้ debug ตอน bring-up เครื่องใหม่ว่า "ต่อไม่ติด" หรือ "ต่อติดแต่เฟรมไม่ตรงรูปแบบที่ parse ได้"
const DEBUG = process.env.RFID_DEBUG === '1' || process.env.RFID_DEBUG === 'true';
const hex = (buf) => buf.toString('hex').replace(/(..)/g, '$1 ').trim();
const dbg = (...args) => {
  if (DEBUG) console.log('[rfid-reader]', ...args);
};

/**
 * เชื่อมต่อไปที่เครื่องอ่าน RFID ผ่าน TCP/IP แล้วสั่ง inventory ซ้ำเป็นรอบๆ จนกว่าจะ "อ่านครบ"
 * (ไม่เจอ EPC ใหม่ติดกันครบ stableRounds รอบวนเสา) หรือชนเพดานเวลา/จำนวนรอบ แล้วปิดการเชื่อมต่อ
 *
 * ยิงรอบถัดไป "หลังเครื่องตอบรอบเดิมจบ" เสมอ (ได้เฟรมจบรอบ หรือเงียบครบ idleTimeoutMs) ไม่ยิงทับ
 * ตอนเครื่องกำลังตอบ — ออกแบบให้รองรับเคสเข็นรถเข็นผ้าผ่านเครื่องช้าๆ ต้องอ่านจนสุดคันก่อนจบ
 */
export function queryTags({
  ip,
  port,
  connectTimeoutMs = 5000,
  idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS,
  stableRounds = DEFAULT_STABLE_ROUNDS,
  maxRounds = DEFAULT_MAX_ROUNDS,
  maxWaitMs = DEFAULT_MAX_WAIT_MS,
  powerDbm, // 0-18: สั่งตั้งกำลังส่งก่อน inventory | undefined = ไม่แตะ ใช้ค่าเดิมในเครื่อง
  scanTime, // 3-255 (x100ms): เวลาสูงสุดต่อรอบ | undefined = ไม่แตะ ใช้ค่าเดิมในเครื่อง
}) {
  const key = `${ip}:${port}`;
  const inventoryFrame = buildFrame(CMD_INVENTORY, INVENTORY_DATA);

  // คำสั่งตั้งค่าที่ต้องส่งก่อนเริ่ม inventory (ส่งทีละคำสั่ง รอ ack ก่อนค่อยส่งตัวถัดไป)
  const settings = [];
  const setPower = powerDbm >= 0 && powerDbm <= MAX_POWER_DBM ? Math.round(powerDbm) : null;
  if (setPower !== null) {
    settings.push({ name: `กำลังส่ง ${setPower}dBm`, cmd: CMD_SET_POWER, frame: buildFrame(CMD_SET_POWER, Buffer.from([setPower])) });
  }
  const setScan = scanTime >= 3 && scanTime <= 255 ? Math.round(scanTime) : null;
  if (setScan !== null && appliedScanTime.get(key) !== setScan) {
    settings.push({
      name: `ScanTime ${setScan * 100}ms`,
      cmd: CMD_SET_SCAN_TIME,
      frame: buildFrame(CMD_SET_SCAN_TIME, Buffer.from([setScan])),
      onSent: () => appliedScanTime.set(key, setScan),
    });
  }
  dbg(
    `ต่อ ${key} | นิ่ง ${stableRounds} รอบวนเสา (idle สำรอง ${idleTimeoutMs}ms) เพดาน ${maxRounds} รอบ/${maxWaitMs}ms` +
      (settings.length ? ` | ตั้งค่า: ${settings.map((s) => s.name).join(', ')}` : '') +
      ` | inv ${hex(inventoryFrame)}`
  );

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    const startedAt = Date.now();
    let buffer = Buffer.alloc(0);
    let rxBytes = 0; // นับ byte ดิบทั้งหมดที่รับมา ไว้แยก "ต่อไม่ติด" ออกจาก "ต่อติดแต่ parse ไม่ได้"
    let phase = 'connecting'; // connecting -> settings -> inventory
    let pendingSetting = null; // { name, cmd, timer }
    const settingResults = []; // [{ name, status }] status null = เครื่องไม่ตอบ
    let roundsSent = 0;
    let roundInFlight = false;
    let freshThisRound = 0;
    let stableStreak = 0; // จำนวนรอบล่าสุดติดกันที่ไม่เจอ EPC ใหม่เลย
    let sawRoundEndFrame = false; // เครื่องนี้ส่งเฟรมจบรอบไหม (ถ้าส่ง idle ใช้เป็นแค่ตัวกันค้าง)
    const antennas = new Set(); // เสาที่เคยเห็นแท็ก
    const found = new Map(); // epc -> { epc, rssi, ant } (เก็บ rssi ที่แรงสุดที่เจอ)
    let idleTimer = null;
    let maxTimer = null;
    let settled = false;

    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(idleTimer);
      clearTimeout(maxTimer);
      if (pendingSetting) clearTimeout(pendingSetting.timer);
      socket.destroy();
      if (error) {
        dbg(`จบแบบ error: ${error.message} (รับ ${rxBytes} byte)`);
        reject(error);
        return;
      }
      const epcs = [...found.values()];
      dbg(
        `จบ: ${roundsSent} รอบ ${Date.now() - startedAt}ms, รับ ${rxBytes} byte, ได้ ${epcs.length} แท็ก, เสา [${[...antennas].join(',')}]` +
          (rxBytes > 0 && epcs.length === 0
            ? " — เครื่องตอบมาแต่ parse เป็นแท็กไม่ได้ (เฟรม 'ไม่พบแท็ก' ตามปกติ หรือรูปแบบเฟรมไม่ตรง — ดู hex ด้านบน)"
            : '')
      );
      resolve({ epcs, rounds: roundsSent, antennas: [...antennas], ms: Date.now() - startedAt, settings: settingResults });
    };

    // เครื่องที่ส่งเฟรมจบรอบ: idle เป็นแค่ตัวกันค้าง ต้องนานกว่า ScanTime (ไม่งั้นยิงทับตอนเครื่องยังค้นอยู่)
    const idleMs = () => {
      if (!sawRoundEndFrame) return idleTimeoutMs;
      const scanMs = (appliedScanTime.get(key) ?? 30) * 100;
      return Math.max(idleTimeoutMs, scanMs + 500);
    };
    function armIdle() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        if (roundInFlight) endRound('idle');
      }, idleMs());
    }

    const sendRound = () => {
      roundsSent += 1;
      roundInFlight = true;
      freshThisRound = 0;
      socket.write(inventoryFrame);
      armIdle();
    };

    // รอบนี้จบ (ได้เฟรมจบรอบ หรือเงียบครบ idle) -> เช็คว่านิ่งหรือยัง -> ยิงรอบถัดไปทันที/จบ
    function endRound(reason) {
      roundInFlight = false;
      stableStreak = freshThisRound > 0 ? 0 : stableStreak + 1;
      const needed = stableRounds * Math.max(1, antennas.size);
      dbg(
        `รอบ ${roundsSent} จบ (${reason}): EPC ใหม่ ${freshThisRound} | รวม ${found.size} | นิ่ง ${stableStreak}/${needed}`
      );
      if (stableStreak >= needed || roundsSent >= maxRounds) {
        finish();
        return;
      }
      sendRound();
    }

    // ส่งคำสั่งตั้งค่าทีละตัว รอ ack (หรือ timeout) แล้วค่อยตัวถัดไป ครบแล้วเริ่ม inventory
    const nextSetting = () => {
      const setting = settings.shift();
      if (!setting) {
        pendingSetting = null;
        phase = 'inventory';
        sendRound();
        return;
      }
      dbg(`>> ตั้ง${setting.name}: ${hex(setting.frame)}`);
      socket.write(setting.frame);
      setting.onSent?.();
      pendingSetting = {
        name: setting.name,
        cmd: setting.cmd,
        timer: setTimeout(() => {
          dbg(`   ไม่มี ack ภายใน ${SETTING_ACK_TIMEOUT_MS}ms — ไปต่อ`);
          settingResults.push({ name: setting.name, status: null });
          if (!settled) nextSetting();
        }, SETTING_ACK_TIMEOUT_MS),
      };
    };

    socket.setTimeout(connectTimeoutMs);

    socket.on('connect', () => {
      dbg('ต่อสำเร็จ');
      socket.setTimeout(0);
      maxTimer = setTimeout(() => finish(), maxWaitMs);
      phase = 'settings';
      nextSetting();
    });

    socket.on('data', (chunk) => {
      rxBytes += chunk.length;
      dbg(`<< ${chunk.length}B  ${hex(chunk)}`);
      buffer = Buffer.concat([buffer, chunk]);
      const { tags, roundEnds, acks, rest } = parseFrames(buffer);
      buffer = Buffer.from(rest);

      if (phase === 'settings' && pendingSetting) {
        const ack = acks.find((a) => a.cmd === pendingSetting.cmd);
        if (ack) {
          dbg(`   ack status 0x${ack.status.toString(16).padStart(2, '0')}${ack.status === 0 ? ' (OK)' : ' (เครื่องอาจไม่รองรับคำสั่งนี้)'}`);
          clearTimeout(pendingSetting.timer);
          settingResults.push({ name: pendingSetting.name, status: ack.status });
          nextSetting();
        }
        return;
      }
      if (phase !== 'inventory') return;

      for (const tag of tags) {
        if (tag.ant !== null) antennas.add(tag.ant);
        const prev = found.get(tag.epc);
        if (!prev) freshThisRound += 1;
        if (!prev || tag.rssi > prev.rssi) found.set(tag.epc, tag);
      }
      if (roundEnds > 0 && roundInFlight) {
        sawRoundEndFrame = true;
        endRound('เฟรมจบรอบ');
      } else {
        armIdle(); // ยังได้ข้อมูลอยู่ = รอบนี้ยังไม่จบ เลื่อน idle ออกไป
      }
    });

    socket.on('timeout', () => {
      finish(new Error('เชื่อมต่อเครื่องอ่าน RFID ไม่สำเร็จ (connection timeout)'));
    });

    socket.on('error', (err) => {
      finish(err);
    });

    socket.connect({ host: ip, port });
  });
}

// GetReaderInformation — ยืนยันจากการ disassemble SID_U861.dll (export @ RVA 0x39b0):
//   ส่ง [Len=0x04] [Adr] [Cmd=0x21] [CRC16] → ตอบ [Len][Adr][0x21][Status][Ver(2)][Type][TrType]
//   [dmaxfre][dminfre][Power][ScanTime]... — ใช้เช็คว่าตั้งกำลังส่ง/ScanTime ไปแล้วเครื่องรับค่าจริงไหม
const CMD_GET_INFO = 0x21;

// ส่งคำสั่งเดี่ยว 1 คำสั่งแล้วรอเฟรมตอบของคำสั่งนั้น (เปิด-ปิด TCP ในตัว) คืน Buffer ของเฟรมตอบ
export function sendCommand({ ip, port, cmd, data = Buffer.alloc(0), timeoutMs = 3000 }) {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let buffer = Buffer.alloc(0);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`เครื่องไม่ตอบคำสั่ง 0x${cmd.toString(16)} ภายใน ${timeoutMs}ms`));
    }, timeoutMs);
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      let offset = 0;
      while (offset < buffer.length) {
        const frameEnd = offset + 1 + buffer[offset];
        if (frameEnd > buffer.length) return;
        if (buffer[offset + 2] === cmd) {
          clearTimeout(timer);
          socket.destroy();
          resolve(Buffer.from(buffer.subarray(offset, frameEnd)));
          return;
        }
        offset = frameEnd;
      }
    });
    socket.connect({ host: ip, port }, () => socket.write(buildFrame(cmd, data)));
  });
}

export async function readReaderInfo({ ip, port }) {
  const frame = await sendCommand({ ip, port, cmd: CMD_GET_INFO });
  return {
    raw: hex(frame),
    status: frame[3],
    version: frame.length > 5 ? `${frame[4]}.${frame[5]}` : null,
    readerType: frame[6] ?? null,
    powerDbm: frame[10] ?? null,
    scanTimeMs: frame[11] !== undefined ? frame[11] * 100 : null,
  };
}

export async function setReaderPower({ ip, port, powerDbm }) {
  const frame = await sendCommand({ ip, port, cmd: CMD_SET_POWER, data: Buffer.from([powerDbm]) });
  return { raw: hex(frame), status: frame[3] };
}
