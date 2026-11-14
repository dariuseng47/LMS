// ทดสอบเครื่องอ่าน RFID ใน LAN จาก PC นี้ (ไม่ต้องต่อ server)
//   สแกน:          npm run test-reader -- <IP> <Port> [เวลาอ่านต่อเสา ms] [จำนวนครั้ง]
//                  เช่น npm run test-reader -- 192.168.1.250 27011 300 5
//   เช็คกำลังส่ง:   npm run test-reader -- <IP> <Port> power <dBm>
//                  ตั้งกำลังส่งแล้วอ่านค่ากลับจากเครื่อง ดูว่าเครื่องรับค่าจริงไหม
import { queryTags, readReaderInfo, setReaderPower } from './rfidReader.js';

const [ip, portArg, arg3, arg4] = process.argv.slice(2);
const port = Number(portArg);
if (!ip || !port) {
  console.log('วิธีใช้:');
  console.log('  สแกน:        npm run test-reader -- <IP> <Port> [เวลาอ่านต่อเสา ms] [จำนวนครั้ง]');
  console.log('  เช็คกำลังส่ง: npm run test-reader -- <IP> <Port> power <dBm>');
  process.exit(1);
}

const fmtInfo = (info) =>
  `กำลังส่ง ${info.powerDbm} dBm, เวลาต่อรอบ ${info.scanTimeMs} ms, firmware ${info.version}, type 0x${(info.readerType ?? 0).toString(16)}  [${info.raw}]`;

if (arg3 === 'power') {
  const target = Number(arg4);
  try {
    console.log(`ก่อนตั้ง:  ${fmtInfo(await readReaderInfo({ ip, port }))}`);
    if (Number.isInteger(target) && target >= 0 && target <= 30) {
      const res = await setReaderPower({ ip, port, powerDbm: target });
      console.log(
        `ตั้ง ${target} dBm: ${res.status === 0 ? '✅ เครื่องรับค่า' : `❌ เครื่องปฏิเสธ (status 0x${res.status.toString(16)})`}  [${res.raw}]`
      );
      console.log(`หลังตั้ง: ${fmtInfo(await readReaderInfo({ ip, port }))}`);
    } else {
      console.log('(ไม่ได้ระบุ dBm 0-30 — แค่อ่านค่าปัจจุบัน)');
    }
  } catch (error) {
    console.log(`❌ ${error.message}`);
    process.exit(1);
  }
  process.exit(0);
}

const scanTime = Number(arg3) >= 300 ? Math.round(Number(arg3) / 100) : undefined;
const times = Math.max(1, Number(arg4) || 1);
console.log(
  `กำลังต่อ ${ip}:${port} ` +
    (scanTime ? `(${scanTime * 100} ms/เสา) ` : '(ใช้เวลาต่อเสาตามที่ตั้งในเครื่อง) ') +
    `สแกน ${times} ครั้ง — วางผ้าที่มีแท็กไว้หน้าเครื่องอ่าน`
);
const all = new Set();
for (let i = 1; i <= times; i += 1) {
  try {
    // eslint-disable-next-line no-await-in-loop
    const { epcs, rounds, ms } = await queryTags({ ip, port, scanTime, stableRounds: 1 });
    epcs.forEach((t) => all.add(t.epc));
    const perAnt = {};
    epcs.forEach((t) => {
      perAnt[t.ant ?? '-'] = (perAnt[t.ant ?? '-'] || 0) + 1;
    });
    const rssis = epcs.map((t) => t.rssi);
    console.log(
      `ครั้งที่ ${i}: ✅ ${epcs.length} แท็ก ใน ${ms} ms (${rounds} รอบ) | แยกเสา: ` +
        (Object.entries(perAnt).map(([a, n]) => `เสา ${a} = ${n}`).join(', ') || '-') +
        (rssis.length ? ` | RSSI ${Math.min(...rssis)}-${Math.max(...rssis)}` : '')
    );
    if (times === 1) epcs.forEach((t) => console.log(`  ${t.epc}  rssi=${t.rssi}  ant=${t.ant ?? '-'}`));
  } catch (error) {
    console.log(`ครั้งที่ ${i}: ❌ ต่อไม่ได้: ${error.message}`);
    process.exit(1);
  }
}
if (times > 1) console.log(`รวมทุกครั้ง ไม่ซ้ำ ${all.size} แท็ก`);
