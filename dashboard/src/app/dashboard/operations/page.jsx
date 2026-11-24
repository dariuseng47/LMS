import { CONFIG } from 'src/config-global';

import { OperationsProcessMonitorView } from 'src/sections/operations/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Process Status Monitor | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.tracking.view">
      <OperationsProcessMonitorView />
    </PermissionGuard>
  );
}
