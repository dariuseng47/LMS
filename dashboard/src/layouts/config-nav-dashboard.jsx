import { paths } from 'src/routes/paths';

import { CONFIG } from 'src/config-global';

import { Iconify } from 'src/components/iconify';
import { SvgColor } from 'src/components/svg-color';

// ----------------------------------------------------------------------

const icon = (name) => <SvgColor src={`${CONFIG.assetsDir}/assets/icons/navbar/${name}.svg`} />;

const ICONS = {
  hq: <Iconify icon="solar:buildings-2-bold-duotone" />,
  dashboard: icon('ic-dashboard'),
  alert: <Iconify icon="solar:bell-bing-bold-duotone" />,
  analytics: icon('ic-analytics'),
  fabric: <Iconify icon="solar:t-shirt-bold-duotone" />,
  operations: <Iconify icon="solar:routing-2-bold-duotone" />,
  device: <Iconify icon="solar:cpu-bolt-bold-duotone" />,
  security: icon('ic-lock'),
};

// โครงเมนูตาม PROMPT_MASTER.md — แต่ละหมวดถูก gate ด้วย role ตาม docs/rbac-permissions.md
// role ที่ใช้: 'SUPERADMIN' | 'ADMIN' | 'OPERATOR' (ตรงกับ users.role ใน data-model.md)
const ALL_ROLES = ['SUPERADMIN', 'ADMIN', 'OPERATOR'];

export function getNavData(role) {
  const sections = [
    {
      subheader: '1. HQ Super Admin',
      roles: ['SUPERADMIN'],
      items: [
        { title: 'Hospital Management', path: paths.dashboard.hq.hospitals, icon: ICONS.hq },
        { title: 'Inter-Hospital Transfer', path: paths.dashboard.hq.transfers, icon: ICONS.hq },
        { title: 'Global System Config', path: paths.dashboard.hq.config, icon: ICONS.hq },
      ],
    },
    {
      subheader: '2. Hospital Dashboard',
      roles: ALL_ROLES,
      items: [
        { title: 'Operational Overview', path: paths.dashboard.root, icon: ICONS.dashboard },
        { title: 'Alert & Exceptions', path: paths.dashboard.alerts, icon: ICONS.alert },
        { title: 'Wash & Asset Analytics', path: paths.dashboard.washAnalytics, icon: ICONS.analytics },
      ],
    },
    {
      subheader: '3. Fabric & Lot Management',
      roles: ALL_ROLES,
      items: [
        { title: 'Fabric Inventory', path: paths.dashboard.fabric.root, icon: ICONS.fabric },
        { title: 'Register Fabric / Lot', path: paths.dashboard.fabric.new, icon: ICONS.fabric },
        { title: 'Hold & Damaged List', path: paths.dashboard.fabric.hold, icon: ICONS.fabric },
        {
          title: 'Decommissioned Logs',
          path: paths.dashboard.fabric.decommissioned,
          icon: ICONS.fabric,
        },
      ],
    },
    {
      subheader: '4. Operations & Tracking',
      roles: ALL_ROLES,
      items: [
        {
          title: 'Process Status Monitor',
          path: paths.dashboard.operations.root,
          icon: ICONS.operations,
        },
        {
          title: 'Ward Dispatch & Receive',
          path: paths.dashboard.operations.ward,
          icon: ICONS.operations,
        },
        {
          title: 'Location Search',
          path: paths.dashboard.operations.location,
          icon: ICONS.operations,
        },
      ],
    },
    {
      subheader: '5. Device & Signal Management',
      roles: ['SUPERADMIN', 'ADMIN'],
      items: [
        { title: 'Reader & Cabinet Config', path: paths.dashboard.devices, icon: ICONS.device },
      ],
    },
    {
      subheader: '6. Security & System Settings',
      roles: ['SUPERADMIN', 'ADMIN'],
      items: [
        {
          title: 'User & Role Management',
          path: paths.dashboard.security.users,
          icon: ICONS.security,
        },
        {
          title: 'Status Timeout Settings',
          path: paths.dashboard.security.timeouts,
          icon: ICONS.security,
        },
        {
          title: 'Security Audit Logs',
          path: paths.dashboard.security.auditLogs,
          icon: ICONS.security,
        },
      ],
    },
  ];

  return sections.filter((section) => !role || section.roles.includes(role));
}

// เผื่อโค้ดที่อื่นยัง import navData แบบ static อยู่ — default ให้เห็นทุกเมนู (ใช้ตอนยังไม่รู้ role)
export const navData = getNavData(undefined);
