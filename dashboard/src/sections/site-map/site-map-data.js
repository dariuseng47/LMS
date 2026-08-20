// เนื้อหาอธิบายโครงสร้างเมนูทั้งระบบ — ใช้แสดงในหน้า "แผนผังเว็บไซต์" (/dashboard/site-map)
// เขียนอ้างอิงจาก PROMPT_MASTER.md, Advanced_Feature_Details&Rules.md, docs/rbac-permissions.md,
// docs/multi-tenant-isolation.md, docs/device-network-failure-handling.md, docs/data-model.md
// อัปเดตไฟล์นี้ทุกครั้งที่มีการเพิ่ม/แก้เมนูจริงใน config-nav-dashboard.jsx เพื่อให้ตรงกัน

const ROLE_LABEL = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  OPERATOR: 'Operator',
};

export { ROLE_LABEL };

export const SITE_MAP = [
  {
    icon: 'solar:buildings-3-bold-duotone',
    title: 'ศูนย์บริหารเครือข่าย',
    roles: ['SUPERADMIN'],
    description:
      'มุมมองระดับสูงสุดของระบบ สำหรับบริหารทุกโรงพยาบาล (tenant) ในเครือข่ายพร้อมกัน เห็นเฉพาะ superadmin เท่านั้น — เมนูอื่นทั้งหมดในระบบถูกจำกัดขอบเขตด้วย hospital_id (tenant boundary) แต่หมวดนี้คือจุดเดียวที่มองข้าม tenant ได้',
    children: [
      {
        title: 'จัดการโรงพยาบาล',
        icon: 'solar:hospital-bold-duotone',
        description:
          'เพิ่ม/แก้ไขโรงพยาบาล (สร้าง tenant ใหม่) แต่ละโรงพยาบาลแยกข้อมูลจากกันโดยสมบูรณ์ผ่าน hospital_id ตั้งโควตาการใช้งาน (quota_config) ให้แต่ละแห่งได้แยกกัน',
      },
      {
        title: 'โอนย้ายผ้าข้ามโรงพยาบาล',
        icon: 'solar:transfer-horizontal-bold-duotone',
        description:
          'ย้าย fabric_item จากโรงพยาบาลหนึ่งไปอีกแห่งหนึ่ง เป็น cross-tenant write เพียงจุดเดียวที่ระบบอนุญาต ต้องมี superadmin หรือ admin ที่อยู่ใน allow-list ของทั้งต้นทางและปลายทางอนุมัติ ทุกรายการถูกบันทึกลง transfer_records แบบ append-only พร้อม audit log เสมอ',
      },
      {
        title: 'ตั้งค่าระบบส่วนกลาง',
        icon: 'solar:settings-bold-duotone',
        description: 'ตั้งค่ามาตรฐานกลางที่ใช้ร่วมกันทั้งเครือข่าย เช่น ค่า default สำหรับ tenant ที่สร้างใหม่',
      },
    ],
  },
  {
    icon: 'solar:widget-5-bold-duotone',
    title: 'แดชบอร์ดโรงพยาบาล',
    roles: ['SUPERADMIN', 'ADMIN', 'OPERATOR'],
    description:
      'ภาพรวมการทำงานประจำวันของโรงพยาบาลหนึ่งแห่ง (เฉพาะ tenant ตัวเอง) ทุก role เข้าดูได้ แต่ operator ดูได้อย่างเดียว แก้ไขค่าไม่ได้',
    children: [
      {
        title: 'ภาพรวมการทำงาน',
        icon: 'solar:pie-chart-2-bold-duotone',
        description:
          'สรุปจำนวนผ้าทั้งหมดแยกตามสถานะ (ซัก / อบ / ชั่งน้ำหนัก-นับ / พับ-QC / สต๊อกกลาง / ตู้แผนก / ใช้งานที่วอร์ด / พัก / ชำรุด), จำนวนอุปกรณ์ออนไลน์-ออฟไลน์, จำนวนสแกนวันนี้ และผ้าที่ข้ามขั้นตอน (step skipped) ใน 7 วันล่าสุด — ดึงข้อมูลสดจากฐานข้อมูลทุกครั้งที่เปิดหน้า',
      },
      {
        title: 'แจ้งเตือน & ข้อยกเว้น',
        icon: 'solar:bell-bing-bold-duotone',
        description:
          'ศูนย์รวมการแจ้งเตือนทุกประเภท: ผ้าค้างตู้แผนกต่ำกว่า par level ที่ตั้งไว้, ผ้าข้ามขั้นตอน (STEP_SKIPPED), RFID สัญญาณอ่อนกว่าเกณฑ์ (RSSI), อุปกรณ์หลุดออฟไลน์, และผ้าค้างสถานะนานเกินเวลาที่กำหนด',
      },
      {
        title: 'วิเคราะห์การซัก & ทรัพย์สิน',
        icon: 'solar:chart-square-bold-duotone',
        description:
          'รายงานสรุปรอบซักผ้าเทียบกับ Max Wash Cycle ที่ตั้งไว้ต่อหมวดหมู่ผ้า ช่วยดูว่าผ้าล็อตไหนใกล้ครบอายุใช้งานและควรวางแผนจัดซื้อใหม่',
      },
    ],
  },
  {
    icon: 'solar:t-shirt-bold-duotone',
    title: 'จัดการผ้าและล็อต',
    roles: ['SUPERADMIN', 'ADMIN', 'OPERATOR'],
    description:
      'บริหารทะเบียนผ้าทุกชิ้นในโรงพยาบาล ตั้งแต่รับเข้าจนถึงปลดระวาง operator ต้องได้รับสิทธิ์เพิ่มจาก admin ก่อน (ผ่าน user_permission_overrides) ถึงจะสร้าง/แก้ไขได้ ค่า default คือ operator แก้ hold ได้แต่สร้างผ้าใหม่ไม่ได้',
    children: [
      {
        title: 'คลังผ้าทั้งหมด',
        icon: 'solar:box-bold-duotone',
        description:
          'รายการผ้าทุกชิ้น filter ตามสถานะ / หมวดหมู่ / รหัส EPC ได้ คลิกดูรายละเอียดพร้อมประวัติการสแกนย้อนหลังทั้งหมดของชิ้นนั้น',
      },
      {
        title: 'ลงทะเบียนผ้า / ล็อต',
        icon: 'solar:add-square-bold-duotone',
        description:
          'เพิ่มผ้าใหม่เข้าระบบได้ทั้งแบบรายชิ้น (พร้อมรูปถ่าย) หรือยกล็อตจากการจัดซื้อ ทุกชิ้นผูกกับรหัส EPC ที่เป็น unique key ระดับ global (ไม่ใช่ระดับโรงพยาบาล) เพราะเป็น physical tag ตัวเดียวติดผ้าจริง แม้โอนย้ายข้าม รพ. รหัส EPC ก็ไม่เปลี่ยน มีแค่เจ้าของ (hospital_id) ที่เปลี่ยน',
      },
      {
        title: 'รายการพัก & ชำรุด',
        icon: 'solar:pause-circle-bold-duotone',
        description:
          'พักผ้าไว้ชั่วคราว (Hold) เมื่อสงสัยว่ามีปัญหา หรือแทงชำรุดถาวร (Decommission) เมื่อใช้งานต่อไม่ได้ ทำได้ทั้งรายชิ้นและยกล็อต ต้องระบุเหตุผลและแนบรูปประกอบทุกครั้ง',
      },
      {
        title: 'ประวัติผ้าที่จำหน่ายออก',
        icon: 'solar:trash-bin-minimalistic-bold-duotone',
        description: 'ดูย้อนหลังผ้าที่ถูกแทงชำรุดไปแล้วทั้งหมด เป็น log แบบอ่านอย่างเดียว ไม่สามารถแก้ไขหรือลบได้',
      },
    ],
  },
  {
    icon: 'solar:routing-2-bold-duotone',
    title: 'ปฏิบัติการ & ติดตามผ้า',
    roles: ['SUPERADMIN', 'ADMIN', 'OPERATOR'],
    description:
      'หมวดที่ operator หน้างานใช้บ่อยที่สุด ครอบคลุมการติดตามผ้าทุกจุดของ flow ตั้งแต่ซักจนถึงตู้แผนก และค้นหาตำแหน่งผ้าแบบเรียลไทม์',
    children: [
      {
        title: 'ติดตามสถานะกระบวนการ',
        icon: 'solar:radar-2-bold-duotone',
        description:
          'มอนิเตอร์แบบเรียลไทม์ว่าผ้าแต่ละชิ้นอยู่จุดไหนใน flow (ซัก → อบ → จุดชั่งน้ำหนัก/นับ RFID 3 จุด → พับ/QC มัด → สต๊อกกลาง → ตู้แผนก) หากผ้าโผล่ที่จุดชั่งน้ำหนักโดยไม่มี log ออกจากตู้แผนกก่อนหน้า ระบบจะ flag STEP_SKIPPED ทันที',
      },
      {
        title: 'รับ-ส่งผ้าประจำวอร์ด',
        icon: 'solar:delivery-bold-duotone',
        description:
          'ขั้นตอนเติมผ้าเข้าตู้แผนก: เลือกแผนกครั้งเดียว → สแกนครั้งที่ 1 อ่านผ้าที่ค้างตู้เดิม → เติมผ้าใหม่ลงตู้ → สแกนครั้งที่ 2 ย้ายผ้าจากรถเข็นเข้าตู้จริง ระบบคำนวณ % ผ้าคงเหลือเทียบ par level ให้อัตโนมัติและแจ้งเตือนเมื่อต่ำกว่าเกณฑ์ที่ตั้งไว้',
      },
      {
        title: 'ค้นหาตำแหน่งผ้า',
        icon: 'solar:map-point-search-bold-duotone',
        description: 'ค้นหาด้วยรหัส EPC เพื่อดูตำแหน่ง/สถานะล่าสุดที่ผ้าชิ้นนั้นควรอยู่ ใช้เวลาตามหาผ้าที่หาไม่เจอ',
      },
    ],
  },
  {
    icon: 'solar:cpu-bolt-bold-duotone',
    title: 'อุปกรณ์ & สัญญาณ RFID',
    roles: ['SUPERADMIN', 'ADMIN'],
    description:
      'จัดการอุปกรณ์ RFID reader ทุกจุดติดตั้ง (จุดชั่งน้ำหนัก, โต๊ะพับ, ตู้แผนก, เครื่อง handheld) ตั้งค่าความแรงสัญญาณขั้นต่ำ (RSSI threshold) แยกรายจุดติดตั้งได้ (เช่น โต๊ะพับต้องใช้สัญญาณแรงกว่าปกติเพื่อกันอ่านติดผ้ามัดข้างเคียง) และผูกข้อมูลผู้ดูแล/เบอร์โทรติดต่อกรณีอุปกรณ์มีปัญหา แต่ละอุปกรณ์ส่ง heartbeat ทุก 30 วินาที หากขาดหายเกิน 60 วินาทีระบบจะขึ้นสถานะออฟไลน์และแจ้งเตือนผู้ดูแลอัตโนมัติ ปิดไม่ให้ operator แก้ config โดย default เพราะกระทบระบบวงกว้างได้',
    children: [],
  },
  {
    icon: 'solar:shield-keyhole-bold-duotone',
    title: 'ความปลอดภัย & ตั้งค่าระบบ',
    roles: ['SUPERADMIN', 'ADMIN'],
    description:
      'จัดการบัญชีผู้ใช้และค่าความปลอดภัยของระบบ ใช้กฎ cascading delegation: บทบาทที่สูงกว่าเป็นผู้กำหนดเพดานสิทธิ์ให้บทบาทที่ต่ำกว่า และห้ามมอบสิทธิ์ที่ตัวเองไม่มีให้ผู้อื่น',
    children: [
      {
        title: 'ผู้ใช้งาน & สิทธิ์การเข้าถึง',
        icon: 'solar:users-group-rounded-bold-duotone',
        description:
          'superadmin สร้าง/ลบ/แก้ไขบัญชี admin และ operator ได้ทั้งหมดทุกโรงพยาบาล — admin สร้าง/ลบ/แก้ไขได้เฉพาะ operator ในโรงพยาบาลตัวเองเท่านั้น (แก้ admin คนอื่นไม่ได้แม้อยู่ รพ. เดียวกัน) — operator จัดการบัญชีใครไม่ได้เลย กฎนี้เป็น hard-coded boundary ที่ override ไม่ได้แม้แต่ superadmin เพราะเป็น security boundary ไม่ใช่ business preference',
      },
      {
        title: 'ตั้งค่าเวลาค้างสถานะ',
        icon: 'solar:clock-circle-bold-duotone',
        description:
          'กำหนดเวลาสูงสุดที่ผ้าอยู่ในแต่ละสถานะได้ก่อนจะถือว่าผิดปกติ (เช่น ค้างที่ห้องอบเกิน 4 ชั่วโมง) หากเกินเวลาที่ตั้งไว้ระบบจะยิงแจ้งเตือนอัตโนมัติไปที่หน้าแดชบอร์ด',
      },
      {
        title: 'ประวัติการใช้งานระบบ',
        icon: 'solar:document-text-bold-duotone',
        description:
          'audit log แบบ append-only บันทึกการกระทำสำคัญทุกอย่างในระบบ ห้ามแก้ไขหรือลบแม้แต่โดย superadmin รวมถึงบันทึกทุกครั้งที่ superadmin เข้าดูข้อมูลข้ามโรงพยาบาล (CROSS_TENANT_READ) เพื่อความโปร่งใสในการตรวจสอบย้อนหลัง',
      },
    ],
  },
];
