// ทดสอบว่า PC นี้ต่อเครื่องอ่าน RFID ใน LAN ได้ไหม (ไม่ต้องต่อ server)
// ใช้: npm run test-reader -- 192.168.1.250 6000
import { queryTags } from './rfidReader.js';

const [ip, portArg] = process.argv.slice(2);
const port = Number(portArg);
if (!ip || !port) {
  console.log('วิธีใช้: npm run test-reader -- <IP เครื่องอ่าน> <Port>');
  console.log('ตัวอย่าง: npm run test-reader -- 192.168.1.250 6000');
  process.exit(1);
}

console.log(`กำลังต่อ ${ip}:${port} ... (วางผ้าที่มีแท็กไว้หน้าเครื่องอ่าน)`);
try {
  const { epcs } = await queryTags({ ip, port });
  console.log(`✅ ต่อได้ — อ่านเจอ ${epcs.length} แท็ก`);
  epcs.forEach((t) => console.log(`  ${t.epc}  rssi=${t.rssi}  ant=${t.ant}`));
} catch (error) {
  console.log(`❌ ต่อไม่ได้: ${error.message}`);
  process.exit(1);
}
