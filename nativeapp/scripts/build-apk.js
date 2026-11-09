// สร้างไฟล์ APK (release) พร้อมเลข build — ใช้แทน `cd android && ./gradlew assembleRelease`
//
//   npm run build:apk
//
// 1. ตั้งเลข build เป็นเวลาตอน build (YYYYMMDDHHmm เวลาไทย) แล้วฝังลง src/update/buildInfo.json ชั่วคราว
//    (แอปอ่านไฟล์นี้เพื่อรู้ว่าตัวเองเป็น build ไหน — ดู src/update/AppUpdateContext.jsx)
// 2. รัน gradlew assembleRelease (โฟลเดอร์ android/ ต้องมีอยู่แล้ว — ถ้ายังไม่มีให้รัน `npx expo prebuild` ก่อน)
// 3. คืนค่า buildInfo.json กลับเป็นเดิม (git ไม่สกปรก)
// 4. คัดลอก APK ไปไว้ที่ ../server/downloads/welclean-lms-<version>-<build>.apk
//    → อัปไฟล์นี้ขึ้นโฟลเดอร์ downloads ของ server บน Plesk แอปทุกเครื่องจะเห็นเตือน "มีเวอร์ชันใหม่"
//    (server อ่านเลข build จากชื่อไฟล์ — อย่าเปลี่ยนชื่อไฟล์ตอนอัป)
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const buildInfoPath = path.join(root, 'src/update/buildInfo.json');
const androidDir = path.join(root, 'android');
const apkPath = path.join(androidDir, 'app/build/outputs/apk/release/app-release.apk');
const outDir = path.resolve(root, '../server/downloads');

function buildNumber(date = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}`;
}

if (!fs.existsSync(androidDir)) {
  console.error('ไม่พบโฟลเดอร์ android/ — รัน `npx expo prebuild --platform android` ก่อน');
  process.exit(1);
}

const version = require(path.join(root, 'app.json')).expo.version;
const build = buildNumber();
const original = fs.readFileSync(buildInfoPath, 'utf8');

console.log(`▶ build APK เวอร์ชัน ${version} (build ${build})`);
fs.writeFileSync(buildInfoPath, `${JSON.stringify({ build, version }, null, 2)}\n`);

let result;
try {
  result = spawnSync(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', ['assembleRelease'], {
    cwd: androidDir,
    stdio: 'inherit',
  });
} finally {
  fs.writeFileSync(buildInfoPath, original);
}

if (result.status !== 0) {
  console.error('✖ build ไม่สำเร็จ');
  process.exit(result.status ?? 1);
}

fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `welclean-lms-${version}-${build}.apk`);
fs.copyFileSync(apkPath, outFile);
console.log(`✔ เสร็จแล้ว: ${outFile}`);
console.log('  อัปไฟล์นี้ขึ้นโฟลเดอร์ downloads ของ server (ห้ามเปลี่ยนชื่อไฟล์ — เลข build อยู่ในชื่อ)');
