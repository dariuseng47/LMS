import { CONFIG } from 'src/config-global';

import { OperationsWashReceiveView } from 'src/sections/operations/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Wash Receive & Weighing | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <OperationsWashReceiveView />;
}
