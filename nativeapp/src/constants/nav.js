// Operator-facing subset of dashboard/src/layouts/config-nav-dashboard.jsx —
// items gated to SUPERADMIN/ADMIN only (org tree, devices, security/users) are
// excluded. Icon names are MaterialCommunityIcons (via @expo/vector-icons),
// chosen as the closest practical match to the dashboard's Iconify `solar:*`
// duotone set — React Native has no Iconify runtime.
//
// Each tab has an outline icon (inactive) and a filled icon (active) — the tab bar
// swaps between them so the active tab reads as "on" rather than just tinted.

export const tabs = [
  {
    name: 'home',
    label: 'หน้าแรก',
    icon: 'view-dashboard-outline',
    iconActive: 'view-dashboard',
  },
  {
    name: 'inventory',
    label: 'คลังผ้า',
    icon: 'archive-outline',
    iconActive: 'archive',
  },
  {
    name: 'ward',
    label: 'รับ-ส่งวอร์ด',
    icon: 'truck-delivery-outline',
    iconActive: 'truck-delivery',
  },
  {
    name: 'hold',
    label: 'พัก & ชำรุด',
    icon: 'pause-circle-outline',
    iconActive: 'pause-circle',
  },
  {
    name: 'location',
    label: 'ค้นหาตำแหน่ง',
    icon: 'map-marker-radius-outline',
    iconActive: 'map-marker-radius',
  },
];
