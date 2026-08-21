import { CONFIG } from 'src/config-global';

import { FabricRegisterView } from 'src/sections/fabric/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Register Fabric / Lot | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <FabricRegisterView />;
}
