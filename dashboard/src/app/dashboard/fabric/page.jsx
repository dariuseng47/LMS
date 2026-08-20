import { CONFIG } from 'src/config-global';

import { LmsComingSoonView } from 'src/components/lms-coming-soon';

// ----------------------------------------------------------------------

export const metadata = { title: `Fabric Inventory | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LmsComingSoonView title="คลังผ้าทั้งหมด" />;
}
