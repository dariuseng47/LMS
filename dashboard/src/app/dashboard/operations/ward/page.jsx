import { CONFIG } from 'src/config-global';

import { LmsComingSoonView } from 'src/components/lms-coming-soon';

// ----------------------------------------------------------------------

export const metadata = { title: `Ward Dispatch & Receive | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LmsComingSoonView title="รับ-ส่งผ้าประจำวอร์ด" />;
}
