import { CONFIG } from 'src/config-global';

import { UserListView } from 'src/sections/security/view';

// ----------------------------------------------------------------------

export const metadata = { title: `User & Role Management | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <UserListView />;
}
