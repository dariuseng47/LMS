// Tenant isolation wrapper — ดู docs/multi-tenant-isolation.md (ชั้นที่ 2)
// Controller ห้ามเรียก pool.query()/pool.execute() ตรงๆ กับตารางใน TENANT_SCOPED_TABLES
// ต้องผ่าน scopedQuery(pool, tenantId) เสมอ เพื่อบังคับ inject hospital_id เข้า WHERE ทุกครั้ง

export const TENANT_SCOPED_TABLES = new Set([
  'fabric_items',
  'fabric_lots',
  'fabric_categories',
  'devices',
  'scan_logs',
  'cabinets',
  'departments',
  'cabinet_par_levels',
  'users',
  'audit_logs',
  'sync_conflicts',
  'hold_decommission_records',
]);

function assertTenantId(table, tenantId) {
  if (TENANT_SCOPED_TABLES.has(table) && (tenantId === undefined || tenantId === null)) {
    throw new Error(
      `scopedQuery: table "${table}" ถูก whitelist เป็น tenant-scoped แต่ไม่มี tenantId — ห้าม query ตารางนี้แบบไม่ระบุ tenant`
    );
  }
}

export function scopedQuery(pool, tenantId) {
  return {
    /** SELECT ... WHERE hospital_id = tenantId AND ...where */
    async select(table, where = {}, { columns = '*' } = {}) {
      assertTenantId(table, tenantId);

      const conditions = TENANT_SCOPED_TABLES.has(table)
        ? { ...where, hospital_id: tenantId }
        : { ...where };

      const keys = Object.keys(conditions);
      const clause = keys.length ? `WHERE ${keys.map((key) => `${key} = ?`).join(' AND ')}` : '';
      const values = keys.map((key) => conditions[key]);

      const [rows] = await pool.query(`SELECT ${columns} FROM \`${table}\` ${clause}`, values);
      return rows;
    },

    /** INSERT พร้อมบังคับ hospital_id = tenantId เข้า payload อัตโนมัติ */
    async insert(table, data) {
      assertTenantId(table, tenantId);

      const payload = TENANT_SCOPED_TABLES.has(table) ? { ...data, hospital_id: tenantId } : data;
      const keys = Object.keys(payload);
      const placeholders = keys.map(() => '?').join(', ');

      const [result] = await pool.query(
        `INSERT INTO \`${table}\` (${keys.map((k) => `\`${k}\``).join(', ')}) VALUES (${placeholders})`,
        keys.map((key) => payload[key])
      );
      return result;
    },

    /** UPDATE ... WHERE hospital_id = tenantId AND ...where — กัน update ข้าม tenant */
    async update(table, where, data) {
      assertTenantId(table, tenantId);

      const conditions = TENANT_SCOPED_TABLES.has(table)
        ? { ...where, hospital_id: tenantId }
        : { ...where };

      const setKeys = Object.keys(data);
      const whereKeys = Object.keys(conditions);
      if (whereKeys.length === 0) {
        throw new Error('scopedQuery.update: ต้องมี WHERE condition เสมอ ห้าม update ทั้งตาราง');
      }

      const setClause = setKeys.map((key) => `\`${key}\` = ?`).join(', ');
      const whereClause = whereKeys.map((key) => `\`${key}\` = ?`).join(' AND ');

      const [result] = await pool.query(
        `UPDATE \`${table}\` SET ${setClause} WHERE ${whereClause}`,
        [...setKeys.map((key) => data[key]), ...whereKeys.map((key) => conditions[key])]
      );
      return result;
    },
  };
}
