import { CONFIG } from 'src/config-global';

import { OperationsStockScanView } from 'src/sections/operations/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Scan Into Stock | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <OperationsStockScanView />;
}
