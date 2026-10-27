-- เมนู "เปลี่ยนประเภทผ้า" (เว็บ: จัดการผ้าและล็อต › เปลี่ยนหมวดหมู่ / ประเภทผ้า, แอป: เปลี่ยนประเภทผ้า)
--   ย้ายผ้ารายชิ้นหรือเป็นชุดไปอยู่ "ประเภทผ้า" อื่น (หมวดหมู่ผ้าเปลี่ยนตามประเภทใหม่โดยอัตโนมัติ
--   เพราะผ้าได้หมวดหมู่ผ่านประเภทผ้า ดู 032_fabric_groups.sql)
--
-- version control: ทุกการเปลี่ยน = 1 batch (ชุดการเปลี่ยน) เก็บค่าก่อน/หลังรายชิ้นไว้ครบ
--   ย้อนกลับได้ทั้ง batch — การย้อนกลับเองก็เป็น batch ใหม่ (batch_type = 'REVERT') ไม่ลบประวัติเดิม
--   จึงย้อนการย้อนกลับ (redo) ได้ต่อเนื่องไม่จำกัด
--
-- รันกับ database เดิม: mysql -u <user> -p <db> < 033_fabric_category_changes.sql

CREATE TABLE IF NOT EXISTS fabric_category_change_batches (
  id               BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  hospital_id      BIGINT UNSIGNED NOT NULL,
  batch_type       ENUM('CHANGE','REVERT') NOT NULL DEFAULT 'CHANGE',
  mode             ENUM('SINGLE','BULK') NOT NULL,
  source           ENUM('WEB','HANDHELD') NOT NULL DEFAULT 'WEB',
  -- ประเภทปลายทางของ batch แบบ CHANGE (REVERT ปลายทางต่างกันรายชิ้น จึงเป็น NULL)
  to_category_id   BIGINT UNSIGNED NULL,
  reason           VARCHAR(500) NULL,
  item_count       INT UNSIGNED NOT NULL DEFAULT 0,
  -- batch แบบ REVERT: ย้อนกลับ batch ไหน
  reverts_batch_id BIGINT UNSIGNED NULL,
  created_by       BIGINT UNSIGNED NOT NULL,
  created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fccb_hospital_created (hospital_id, created_at),
  FOREIGN KEY (hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (to_category_id) REFERENCES fabric_categories(id),
  FOREIGN KEY (reverts_batch_id) REFERENCES fabric_category_change_batches(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS fabric_category_change_items (
  id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  batch_id            BIGINT UNSIGNED NOT NULL,
  fabric_item_id      BIGINT UNSIGNED NOT NULL,
  epc_code            VARCHAR(64) NOT NULL,
  from_category_id    BIGINT UNSIGNED NOT NULL,
  to_category_id      BIGINT UNSIGNED NOT NULL,
  -- ถูกย้อนกลับแล้วโดย batch ไหน (NULL = ยังมีผลอยู่)
  reverted_by_batch_id BIGINT UNSIGNED NULL,
  reverted_at         DATETIME NULL,
  INDEX idx_fcci_batch (batch_id),
  INDEX idx_fcci_item (fabric_item_id),
  FOREIGN KEY (batch_id) REFERENCES fabric_category_change_batches(id),
  FOREIGN KEY (fabric_item_id) REFERENCES fabric_items(id),
  FOREIGN KEY (from_category_id) REFERENCES fabric_categories(id),
  FOREIGN KEY (to_category_id) REFERENCES fabric_categories(id),
  FOREIGN KEY (reverted_by_batch_id) REFERENCES fabric_category_change_batches(id)
);

-- สิทธิ์เมนูใหม่ (ดู server/src/config/menuCatalog.js)
INSERT INTO permissions (perm_key, category, description) VALUES
  ('web.fabric.change_category.view',     'web:fabric',      'ดู: เปลี่ยนหมวดหมู่ / ประเภทผ้า'),
  ('web.fabric.change_category.edit',     'web:fabric',      'แก้ไข: เปลี่ยน / ย้อนกลับประเภทผ้า'),
  ('handheld.change_category.view',       'handheld:fabric', 'ดู: เปลี่ยนประเภทผ้า'),
  ('handheld.change_category.edit',       'handheld:fabric', 'แก้ไข: เปลี่ยน / ย้อนกลับประเภทผ้า')
ON DUPLICATE KEY UPDATE category = VALUES(category), description = VALUES(description);

-- ADMIN ได้เต็มทั้งเว็บและมือถือ — OPERATOR ไม่ได้ default (เปิดให้เป็นรายคนผ่านหน้าจัดการสิทธิ์)
INSERT IGNORE INTO role_default_permissions (role, perm_key) VALUES
  ('ADMIN', 'web.fabric.change_category.view'),
  ('ADMIN', 'web.fabric.change_category.edit'),
  ('ADMIN', 'handheld.change_category.view'),
  ('ADMIN', 'handheld.change_category.edit');
