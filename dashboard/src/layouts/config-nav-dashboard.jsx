import { paths } from 'src/routes/paths';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

// โครงเมนูตาม PROMPT_MASTER.md — แต่ละหมวดใหญ่เป็นเมนูหลักที่ย่อเมนูรองไว้ (คลิกเพื่อขยาย)
// role ที่ใช้ gate: 'SUPERADMIN' | 'ADMIN' | 'OPERATOR' (ตรงกับ users.role ใน data-model.md)
const ALL_ROLES = ['SUPERADMIN', 'ADMIN', 'OPERATOR'];

const icon = (name) => <Iconify icon={name} width={22} />;

export function getNavData(role) {
  const items = [
    {
      title: 'ศูนย์บริหารเครือข่าย',
      path: paths.dashboard.hq.hospitals,
      icon: icon('solar:buildings-3-bold-duotone'),
      roles: ['SUPERADMIN'],
      children: [
        {
          title: 'จัดการโรงพยาบาล',
          path: paths.dashboard.hq.hospitals,
          icon: icon('solar:hospital-bold-duotone'),
        },
        {
          title: 'โอนย้ายผ้าข้ามโรงพยาบาล',
          path: paths.dashboard.hq.transfers,
          icon: icon('solar:transfer-horizontal-bold-duotone'),
        },
        {
          title: 'ตั้งค่าระบบส่วนกลาง',
          path: paths.dashboard.hq.config,
          icon: icon('solar:settings-bold-duotone'),
        },
      ],
    },
    {
      title: 'แดชบอร์ดโรงพยาบาล',
      path: paths.dashboard.root,
      icon: icon('solar:widget-5-bold-duotone'),
      roles: ALL_ROLES,
      children: [
        {
          title: 'ภาพรวมการทำงาน',
          path: paths.dashboard.root,
          icon: icon('solar:pie-chart-2-bold-duotone'),
        },
        {
          title: 'แจ้งเตือน & ข้อยกเว้น',
          path: paths.dashboard.alerts,
          icon: icon('solar:bell-bing-bold-duotone'),
        },
        {
          title: 'วิเคราะห์การซัก & ทรัพย์สิน',
          path: paths.dashboard.washAnalytics,
          icon: icon('solar:chart-square-bold-duotone'),
        },
      ],
    },
    {
      title: 'จัดการผ้าและล็อต',
      path: paths.dashboard.fabric.root,
      icon: icon('solar:t-shirt-bold-duotone'),
      roles: ALL_ROLES,
      children: [
        {
          title: 'คลังผ้าทั้งหมด',
          path: paths.dashboard.fabric.root,
          icon: icon('solar:box-bold-duotone'),
        },
        {
          title: 'ลงทะเบียนผ้า / ล็อต',
          path: paths.dashboard.fabric.new,
          icon: icon('solar:add-square-bold-duotone'),
        },
        {
          title: 'รายการพัก & ชำรุด',
          path: paths.dashboard.fabric.hold,
          icon: icon('solar:pause-circle-bold-duotone'),
        },
        {
          title: 'ประวัติผ้าที่จำหน่ายออก',
          path: paths.dashboard.fabric.decommissioned,
          icon: icon('solar:trash-bin-minimalistic-bold-duotone'),
        },
      ],
    },
    {
      title: 'ปฏิบัติการ & ติดตามผ้า',
      path: paths.dashboard.operations.root,
      icon: icon('solar:routing-2-bold-duotone'),
      roles: ALL_ROLES,
      children: [
        {
          title: 'ติดตามสถานะกระบวนการ',
          path: paths.dashboard.operations.root,
          icon: icon('solar:radar-2-bold-duotone'),
        },
        {
          title: 'รับ-ส่งผ้าประจำวอร์ด',
          path: paths.dashboard.operations.ward,
          icon: icon('solar:delivery-bold-duotone'),
        },
        {
          title: 'ค้นหาตำแหน่งผ้า',
          path: paths.dashboard.operations.location,
          icon: icon('solar:map-point-search-bold-duotone'),
        },
      ],
    },
    {
      title: 'โครงสร้างโรงพยาบาล',
      path: paths.dashboard.organization.tree,
      icon: icon('solar:city-bold-duotone'),
      roles: ['SUPERADMIN', 'ADMIN'],
    },
    {
      title: 'อุปกรณ์ & สัญญาณ RFID',
      path: paths.dashboard.devices,
      icon: icon('solar:cpu-bolt-bold-duotone'),
      roles: ['SUPERADMIN', 'ADMIN'],
    },
    {
      title: 'ความปลอดภัย & ตั้งค่าระบบ',
      path: paths.dashboard.security.users,
      icon: icon('solar:shield-keyhole-bold-duotone'),
      roles: ['SUPERADMIN', 'ADMIN'],
      children: [
        {
          title: 'ผู้ใช้งาน & สิทธิ์การเข้าถึง',
          path: paths.dashboard.security.users,
          icon: icon('solar:users-group-rounded-bold-duotone'),
        },
        {
          title: 'ตั้งค่าเวลาค้างสถานะ',
          path: paths.dashboard.security.timeouts,
          icon: icon('solar:clock-circle-bold-duotone'),
        },
        {
          title: 'ประวัติการใช้งานระบบ',
          path: paths.dashboard.security.auditLogs,
          icon: icon('solar:document-text-bold-duotone'),
        },
        {
          title: 'ข้อมูลชนกันจากออฟไลน์',
          path: paths.dashboard.security.syncConflicts,
          icon: icon('solar:shuffle-bold-duotone'),
        },
      ],
    },
  ];

  return [
    {
      subheader: 'เมนูใช้งานระบบ',
      items: items.filter((item) => !role || item.roles.includes(role)),
    },
    {
      subheader: 'ข้อมูลระบบ',
      items: [
        {
          title: 'แผนผังเว็บไซต์',
          path: paths.dashboard.siteMap,
          icon: icon('solar:widget-2-bold-duotone'),
        },
      ],
    },
  ];
}

// เผื่อโค้ดที่อื่นยัง import navData แบบ static อยู่ — default ให้เห็นทุกเมนู (ใช้ตอนยังไม่รู้ role)
export const navData = getNavData(undefined);
