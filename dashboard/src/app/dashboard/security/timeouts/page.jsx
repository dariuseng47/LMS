import { CONFIG } from 'src/config-global';

import { StatusTimeoutView } from 'src/sections/security/view/status-timeout-view';

// ----------------------------------------------------------------------

export const metadata = { title: `Status Timeout Settings | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <StatusTimeoutView />;
}
