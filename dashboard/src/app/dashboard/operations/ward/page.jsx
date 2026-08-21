import { CONFIG } from 'src/config-global';

import { OperationsWardView } from 'src/sections/operations/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Ward Dispatch & Receive | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <OperationsWardView />;
}
