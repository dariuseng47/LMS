import { CONFIG } from 'src/config-global';

import { OperationsRestockReportView } from 'src/sections/operations/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Ward Restock History & Forecast | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <OperationsRestockReportView />;
}
