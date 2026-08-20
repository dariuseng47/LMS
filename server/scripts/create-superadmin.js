// สร้างบัญชี superadmin คนแรกของระบบ (ใช้ครั้งเดียวตอน setup)
// ใช้งาน: npm run create-superadmin -- <username> <password> <full_name>
import readline from 'node:readline/promises';

import bcrypt from 'bcryptjs';

import { pool } from '../src/db/pool.js';

async function main() {
  const [, , argUsername, argPassword, ...rest] = process.argv;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const username = argUsername || (await rl.question('Username: '));
  const password = argPassword || (await rl.question('Password (8+ ตัวอักษร): '));
  const fullName = rest.join(' ') || (await rl.question('ชื่อ-นามสกุล: '));

  rl.close();

  if (!username || !password || password.length < 8) {
    console.error('❌ ต้องระบุ username และ password (อย่างน้อย 8 ตัวอักษร)');
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO users (hospital_id, role, username, password_hash, full_name, is_active)
     VALUES (NULL, 'SUPERADMIN', ?, ?, ?, TRUE)`,
    [username, passwordHash, fullName || username]
  );

  console.log(`✅ สร้าง superadmin "${username}" สำเร็จแล้ว`);
  await pool.end();
}

main().catch((error) => {
  console.error('❌ สร้าง superadmin ไม่สำเร็จ:', error.message);
  process.exit(1);
});
