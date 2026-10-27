import { CONFIG } from 'src/config-global';

import { FabricChangeCategoryView } from 'src/sections/fabric/view';

import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

export const metadata = { title: `Change Fabric Category | Dashboard - ${CONFIG.appName}` };

export default function Page() {
  return (
    <PermissionGuard perm="web.fabric.change_category.view">
      <FabricChangeCategoryView />
    </PermissionGuard>
  );
}
