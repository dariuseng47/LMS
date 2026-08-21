import { CONFIG } from 'src/config-global';

import { FabricDecommissionedView } from 'src/sections/fabric/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Decommissioned Logs | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <FabricDecommissionedView />;
}
