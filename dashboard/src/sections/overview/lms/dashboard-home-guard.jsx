'use client';

import { useMemo, useEffect } from 'react';

import { useRouter } from 'src/routes/hooks';

import { usePermission } from 'src/hooks/use-has-permission';

import { getNavData } from 'src/layouts/config-nav-dashboard';

import { LoadingScreen } from 'src/components/loading-screen';

import { useAuthContext } from 'src/auth/hooks';
import { PermissionGuard } from 'src/auth/guard';

// ----------------------------------------------------------------------

const HOME_PERM = 'web.dashboard.overview.view';

// หน้าแรกหลังล็อกอิน (/dashboard) — ไม่มีสิทธิ์ "แดชบอร์ดโรงพยาบาล" ให้พาไปเมนูแรกที่เข้าได้แทน
// ไม่มีเมนูไหนเข้าได้เลย = แสดงหน้า "ไม่มีสิทธิ์" ตามปกติ
export function DashboardHomeGuard({ children }) {
  const router = useRouter();
  const { user } = useAuthContext();
  const { can, ready, permissions } = usePermission();
  const allowed = can(HOME_PERM);

  const fallbackPath = useMemo(() => {
    if (!ready || allowed) return null;
    const [mainMenu] = getNavData(user?.role, { permissions });
    return mainMenu.items[0]?.path ?? null;
  }, [ready, allowed, user?.role, permissions]);

  useEffect(() => {
    if (fallbackPath) router.replace(fallbackPath);
  }, [fallbackPath, router]);

  if (fallbackPath) return <LoadingScreen />;

  return <PermissionGuard perm={HOME_PERM}>{children}</PermissionGuard>;
}
