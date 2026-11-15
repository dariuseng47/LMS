import { CONFIG } from 'src/config-global';

import { OperationsInspectScanView } from 'src/sections/operations/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Inspect Scan | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.operations.inspect_scan.view">
      <OperationsInspectScanView />
    </PermissionGuard>
  );
}
