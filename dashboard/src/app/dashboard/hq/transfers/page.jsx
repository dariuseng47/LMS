import { CONFIG } from 'src/config-global';

import { LmsComingSoonView } from 'src/components/lms-coming-soon';

// ----------------------------------------------------------------------

export const metadata = { title: `Inter-Hospital Transfer | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LmsComingSoonView title="Inter-Hospital Transfer" />;
}
