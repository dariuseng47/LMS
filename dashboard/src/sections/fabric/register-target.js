// "ผ้าที่จะลงทะเบียน" ที่เลือกไว้ = ล็อต และ/หรือ ประเภทผ้า — ใช้ร่วมกันแท็บสแกนลงทะเบียน + Handheld
//   เลือกล็อตที่ตั้งประเภทไว้แล้ว -> ประเภทมาจากล็อต (categoryId = null)
//   เลือกล็อตที่ยังไม่ตั้งประเภท  -> ต้องเลือกประเภทเพิ่ม
//   เลือกเฉพาะประเภท            -> ไม่ผูกล็อต (lotId = null)

export const EMPTY_TARGET = { lotId: null, categoryId: null };

// จำนวนที่ลงทะเบียนเข้าล็อตแล้วเทียบกับจำนวนที่สั่งซื้อ — null = server เวอร์ชันเก่ายังไม่ส่ง registered_count
export function lotProgress(lot) {
  if (!lot || lot.registered_count === undefined) return null;
  const registered = Number(lot.registered_count);
  const quantity = Number(lot.quantity) || 0;
  return {
    registered,
    quantity,
    remaining: Math.max(0, quantity - registered),
    percent: quantity > 0 ? Math.min(100, (registered / quantity) * 100) : 0,
    isFull: quantity > 0 && registered >= quantity,
  };
}

// รวมค่าที่เลือกกับข้อมูลจริง -> { lot, category, ready, title, detail } (ready = พร้อมลงทะเบียน)
export function resolveTarget(target, lots, categories) {
  const lot = lots.find((l) => l.id === target.lotId) ?? null;
  const categoryId = lot?.fabric_category_id ?? target.categoryId;
  const category = categories.find((c) => c.id === categoryId) ?? null;

  return {
    lot,
    category,
    ready: !!category,
    title: category?.name ?? (lot ? `ล็อต ${lot.lot_code}` : null),
    detail: [category?.group_name, lot && category ? `ล็อต ${lot.lot_code}` : null]
      .filter(Boolean)
      .join(' · '),
  };
}
