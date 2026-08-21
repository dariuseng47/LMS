import { CONFIG } from 'src/config-global';

import { FabricHoldView } from 'src/sections/fabric/view';

// ----------------------------------------------------------------------

export const metadata = { title: `Hold & Damaged List | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <FabricHoldView />;
}
