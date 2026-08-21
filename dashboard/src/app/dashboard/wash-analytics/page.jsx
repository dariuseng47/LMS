import { CONFIG } from 'src/config-global';

import { WashAnalyticsView } from 'src/sections/wash-analytics/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Wash & Asset Analytics | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <WashAnalyticsView />;
}
