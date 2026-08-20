import { CONFIG } from 'src/config-global';

import { LmsComingSoonView } from 'src/components/lms-coming-soon';

// ----------------------------------------------------------------------

export const metadata = { title: `Process Status Monitor | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LmsComingSoonView title="ติดตามสถานะกระบวนการ" />;
}
