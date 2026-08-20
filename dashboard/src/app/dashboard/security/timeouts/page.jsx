import { CONFIG } from 'src/config-global';

import { LmsComingSoonView } from 'src/components/lms-coming-soon';

// ----------------------------------------------------------------------

export const metadata = { title: `Status Timeout Settings | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LmsComingSoonView title="ตั้งค่าเวลาค้างสถานะ" />;
}
