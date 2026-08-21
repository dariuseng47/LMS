import { CONFIG } from 'src/config-global';

import { OrganizationTreeView } from 'src/sections/organization/view';

// ----------------------------------------------------------------------

export const metadata = { title: `ผังโครงสร้างโรงพยาบาล | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <OrganizationTreeView />;
}
