// "ผ้าที่จะลงทะเบียน" = ประเภทผ้า (ต้องเลือก) + ล็อต (ไม่บังคับ) — ผ้าเก่าที่ใช้งานมานานไม่มีล็อตก็ลงได้
// 1 ล็อตมีได้หลายประเภท และลงประเภทที่ไม่อยู่ในล็อตได้ (server ใส่ประเภทนั้นเข้าล็อตให้เองตามผ้า)

export const EMPTY_TARGET = { lotId: null, categoryId: null };

// ประเภทผ้าในล็อต: { category_id, category_name, group_name, quantity, registered_count }
//   quantity = null -> ไม่มีจำนวนสั่งซื้อ (ประเภทที่เพิ่มเข้าล็อตอัตโนมัติจากผ้าที่ลงทะเบียน)
// server เวอร์ชันเก่ายังไม่ส่ง lines -> ใช้ประเภทเดียวของล็อต
export function lotLines(lot) {
  if (!lot) return [];
  if (lot.lines) return lot.lines;
  if (!lot.fabric_category_id) return [];
  return [
    {
      category_id: lot.fabric_category_id,
      category_name: lot.category_name,
      group_name: lot.group_name,
      quantity: lot.quantity,
      registered_count: lot.registered_count ?? 0,
    },
  ];
}

// ความคืบหน้าการลงทะเบียนของประเภทหนึ่งในล็อต — quantity/remaining = null เมื่อไม่มีจำนวนสั่งซื้อให้เทียบ
export function lineProgress(line) {
  const registered = Number(line.registered_count ?? 0);
  const quantity = Number(line.quantity) > 0 ? Number(line.quantity) : null;
  return {
    registered,
    quantity,
    remaining: quantity === null ? null : Math.max(0, quantity - registered),
    percent: quantity === null ? 0 : Math.min(100, (registered / quantity) * 100),
    isFull: quantity !== null && registered >= quantity,
  };
}

// ความคืบหน้ารวมทั้งล็อต — "ครบ" ต้องครบทุกประเภทที่สั่งซื้อ (ประเภทหนึ่งลงเกินไม่ชดเชยอีกประเภทที่ยังขาด)
export function lotProgress(lot) {
  const ordered = lotLines(lot).map(lineProgress).filter((line) => line.quantity !== null);
  // ล็อตเก่าที่ไม่ได้แยกประเภท มีแค่ยอดรวมของล็อต
  if (ordered.length === 0) return lineProgress(lot);

  const quantity = ordered.reduce((sum, line) => sum + line.quantity, 0);
  const counted = ordered.reduce((sum, line) => sum + Math.min(line.registered, line.quantity), 0);
  return {
    registered: Number(lot.registered_count ?? 0),
    quantity,
    remaining: quantity - counted,
    percent: (counted / quantity) * 100,
    isFull: ordered.every((line) => line.isFull),
  };
}

// รวมค่าที่เลือกกับข้อมูลจริง — line = ประเภทที่เลือกในล็อตนั้น (null = ไม่ผูกล็อต หรือประเภทไม่อยู่ในล็อต)
export function resolveTarget(target, lots, categories) {
  const lot = lots.find((l) => l.id === target.lotId) ?? null;
  const category = categories.find((c) => c.id === target.categoryId) ?? null;
  const line = category
    ? (lotLines(lot).find((l) => l.category_id === category.id) ?? null)
    : null;

  return { lot, category, line, notInLot: !!lot && !!category && !line };
}

// เลือกล็อต -> { target, needsCategory } : ล็อตมีประเภทเดียวเลือกให้เอง / ประเภทที่เลือกไว้อยู่ในล็อตก็คงไว้
// นอกนั้น needsCategory = true ให้ผู้ใช้เลือกประเภทต่อ (ประเภทในล็อตขึ้นก่อน)
export function targetWithLot(target, lot) {
  if (!lot) return { target: { ...target, lotId: null }, needsCategory: false };

  const lines = lotLines(lot);
  const categoryId = target.categoryId ?? (lines.length === 1 ? lines[0].category_id : null);
  return {
    target: { lotId: lot.id, categoryId },
    needsCategory: !lines.some((line) => line.category_id === categoryId),
  };
}
