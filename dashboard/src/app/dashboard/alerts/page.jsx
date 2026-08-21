import { CONFIG } from 'src/config-global';

import { AlertsView } from 'src/sections/alerts/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Alert & Exceptions | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <AlertsView />;
}
