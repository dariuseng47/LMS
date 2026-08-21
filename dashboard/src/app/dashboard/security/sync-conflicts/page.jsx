import { CONFIG } from 'src/config-global';

import { SyncConflictsView } from 'src/sections/security/view/sync-conflicts-view';

// ----------------------------------------------------------------------

export const metadata = { title: `Sync Conflicts | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return <SyncConflictsView />;
}
