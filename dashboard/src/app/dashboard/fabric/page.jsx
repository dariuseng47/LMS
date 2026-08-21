import { CONFIG } from 'src/config-global';

import { FabricInventoryView } from 'src/sections/fabric/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Fabric Inventory | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <FabricInventoryView />;
}
