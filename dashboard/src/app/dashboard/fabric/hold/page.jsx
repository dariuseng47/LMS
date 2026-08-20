import { CONFIG } from 'src/config-global';

import { LmsComingSoonView } from 'src/components/lms-coming-soon';

// ----------------------------------------------------------------------

export const metadata = { title: `Hold & Damaged List | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LmsComingSoonView title="Hold & Damaged List" />;
}
