import { CONFIG } from 'src/config-global';

import { LmsComingSoonView } from 'src/components/lms-coming-soon';

// ----------------------------------------------------------------------

export const metadata = { title: `Wash & Asset Analytics | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LmsComingSoonView title="Wash & Asset Analytics" />;
}
