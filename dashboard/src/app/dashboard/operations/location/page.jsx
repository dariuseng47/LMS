import { CONFIG } from 'src/config-global';

import { LmsComingSoonView } from 'src/components/lms-coming-soon';

// ----------------------------------------------------------------------

export const metadata = { title: `Location Search | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LmsComingSoonView title="ค้นหาตำแหน่งผ้า" />;
}
