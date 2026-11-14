// ถอน Windows Service — รันแบบ "Run as administrator": npm run uninstall-service
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import nodeWindows from 'node-windows';

const DIR = path.dirname(fileURLToPath(import.meta.url));

const svc = new nodeWindows.Service({
  name: 'LMS Reader Agent',
  script: path.join(DIR, 'agent.js'),
});

svc.on('uninstall', () => console.log('✅ ถอน service แล้ว'));
svc.on('alreadyuninstalled', () => console.log('ยังไม่ได้ติดตั้ง service นี้'));
svc.uninstall();
