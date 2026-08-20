import { CONFIG } from 'src/config-global';

import { LmsComingSoonView } from 'src/components/lms-coming-soon';

// ----------------------------------------------------------------------

export const metadata = { title: `Security Audit Logs | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <LmsComingSoonView title="Security Audit Logs" />;
}
