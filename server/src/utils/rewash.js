import { pool } from '../db/pool.js';

// ประวัติ "ส่งซักใหม่" (rewash_records — ดู db/migrations/038_rewash_status.sql)
//
// ทุกจุดที่พาผ้าออกจากสถานะ REWASH ต้องปิด record ที่ยังเปิดอยู่ของผ้าชิ้นนั้น:
//   WASHED   — ผ่านการซักจริง: รับผ้าหลังซัก & ชั่งน้ำหนัก (wash-receive-batch / weight-gate)
//              หรือเปลี่ยนสถานะเป็น WASH เองจากเมนูเปลี่ยนสถานะ
//   BYPASSED — ออกจาก REWASH ทางอื่นโดยไม่ผ่านการซัก (เปลี่ยนสถานะเป็นอย่างอื่นเอง, สแกนเข้าสต๊อคตรง ๆ)
// แท็บ "ประวัติผ้าส่งซักใหม่" ใช้ closed_at/close_type หา "ยังรอซัก" + เวลาเฉลี่ยกว่าจะได้ซัก
export const REWASH_CLOSE_TYPES = { WASHED: 'WASHED', BYPASSED: 'BYPASSED' };

/**
 * ปิด rewash_records ที่ยังเปิดของผ้าหลายชิ้นในครั้งเดียว
 * @param db           pool หรือ connection ที่อยู่ใน transaction
 * @param itemIds      fabric_items.id[] — ส่งเฉพาะชิ้นที่สถานะเดิมเป็น REWASH ก็ได้ ไม่งั้นก็แค่ไม่มีแถวให้ปิด
 */
export async function closeOpenRewashRecords(
  db,
  tenantId,
  itemIds,
  { closeType = REWASH_CLOSE_TYPES.WASHED, washBatchId = null } = {}
) {
  if (!itemIds || itemIds.length === 0) return 0;
  const [result] = await (db ?? pool).query(
    `UPDATE rewash_records SET closed_at = NOW(), close_type = ?, wash_batch_id = ?
     WHERE hospital_id = ? AND fabric_item_id IN (?) AND closed_at IS NULL`,
    [closeType, washBatchId, tenantId, itemIds]
  );
  return result.affectedRows ?? 0;
}
