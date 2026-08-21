import { CONFIG } from 'src/config-global';

import { OrganizationCabinetsView } from 'src/sections/organization/view';

// ----------------------------------------------------------------------

export const metadata = { title: `ตู้เก็บผ้า & Par Level | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <OrganizationCabinetsView />;
}
