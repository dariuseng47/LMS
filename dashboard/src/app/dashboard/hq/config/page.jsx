import { CONFIG } from 'src/config-global';

import { LmsComingSoonView } from 'src/components/lms-coming-soon';

// ----------------------------------------------------------------------

export const metadata = { title: `Global System Config | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LmsComingSoonView title="ตั้งค่าระบบส่วนกลาง" />;
}
