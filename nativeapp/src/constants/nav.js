// Operator-facing subset of dashboard/src/layouts/config-nav-dashboard.jsx —
// items gated to SUPERADMIN/ADMIN only (org tree, devices, security/users) are
// excluded. Icon names are MaterialCommunityIcons (via @expo/vector-icons),
// chosen as the closest practical match to the dashboard's Iconify `solar:*`
// duotone set — React Native has no Iconify runtime.

export const tabs = [
  {
    name: 'home',
    label: 'หน้าแรก',
    icon: 'view-dashboard-outline',
  },
  {
    name: 'inventory',
    label: 'คลังผ้า',
    icon: 'archive-outline',
  },
  {
    name: 'ward',
    label: 'รับ-ส่งวอร์ด',
    icon: 'truck-delivery-outline',
  },
  {
    name: 'hold',
    label: 'พัก & ชำรุด',
    icon: 'pause-circle-outline',
  },
  {
    name: 'location',
    label: 'ค้นหาตำแหน่ง',
    icon: 'map-marker-radius-outline',
  },
];
