import { CONFIG } from 'src/config-global';

import { OperationsLocationView } from 'src/sections/operations/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Location Search | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <OperationsLocationView />;
}
