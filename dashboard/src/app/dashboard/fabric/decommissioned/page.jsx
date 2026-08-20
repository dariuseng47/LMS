import { CONFIG } from 'src/config-global';

import { LmsComingSoonView } from 'src/components/lms-coming-soon';

// ----------------------------------------------------------------------

export const metadata = { title: `Decommissioned Logs | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LmsComingSoonView title="ประวัติผ้าที่จำหน่ายออก" />;
}
