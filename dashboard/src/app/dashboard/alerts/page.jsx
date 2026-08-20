import { CONFIG } from 'src/config-global';

import { LmsComingSoonView } from 'src/components/lms-coming-soon';

// ----------------------------------------------------------------------

export const metadata = { title: `Alert & Exceptions | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LmsComingSoonView title="แจ้งเตือน & ข้อยกเว้น" />;
}
