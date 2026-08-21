import { pool } from '../db/pool.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { findTargetUser, assertCanManage } from './users.controller.js';
import {
  hasPermission,
  isKnownPermissionKey,
  incrementPermVersion,
  getEffectivePermissions,
} from '../utils/permissions.js';

/**
 * GET /api/v1/users/:id/permissions
 */
export const getUserPermissions = asyncHandler(async (req, res) => {
  const targetUser = await findTargetUser(req.params.id);
  assertCanManage(req.auth, targetUser);

  const permissions = await getEffectivePermissions(targetUser.id, targetUser.role);
  return res.json({ permissions });
});

/**
 * PUT /api/v1/users/:id/permissions
 * body: { overrides: [{ permKey, effect: 'GRANT'|'DENY'|null }] } — effect null = ลบ override
 * นั้นออก กลับไปใช้ default ของ role ตามปกติ
 *
 * กฎ delegation ตาม docs/rbac-permissions.md:
 * - assertCanManage() บล็อก admin ที่พยายามแก้ record ของ admin/superadmin คนอื่นไปแล้ว
 *   (และบล็อก operator ไม่ให้เรียก endpoint นี้ได้เลย) ก่อนถึงโค้ดส่วนนี้
 * - ผู้มอบสิทธิ์ (grantor) ต้องมี perm_key นั้น effective = true อยู่แล้วจริง ถึงจะ GRANT ให้คนอื่นได้
 *   ป้องกัน privilege escalation ผ่านการ delegate (superadmin effective ทุก perm อยู่แล้วข้ามเช็คนี้ได้)
 */
export const updateUserPermissions = asyncHandler(async (req, res) => {
  const targetUser = await findTargetUser(req.params.id);
  assertCanManage(req.auth, targetUser);

  const { overrides } = req.body;

  for (const { permKey, effect } of overrides) {
    if (!isKnownPermissionKey(permKey)) {
      throw new AppError(400, 'VALIDATION_ERROR', `ไม่รู้จัก permission: ${permKey}`);
    }

    if (req.auth.role !== 'SUPERADMIN' && effect === 'GRANT') {
      const grantorHasIt = await hasPermission(req.auth.userId, req.auth.role, permKey);
      if (!grantorHasIt) {
        throw new AppError(
          403,
          'FORBIDDEN',
          `ไม่สามารถมอบสิทธิ์นี้ให้ผู้อื่นได้ เพราะตัวคุณเองไม่มีสิทธิ์นี้อยู่ก่อนแล้ว`
        );
      }
    }

    if (effect === null) {
      await pool.query(
        'DELETE FROM user_permission_overrides WHERE user_id = ? AND perm_key = ?',
        [targetUser.id, permKey]
      );
    } else {
      await pool.query(
        `INSERT INTO user_permission_overrides (user_id, perm_key, effect, granted_by)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE effect = VALUES(effect), granted_by = VALUES(granted_by)`,
        [targetUser.id, permKey, effect, req.auth.userId]
      );
    }
  }

  await incrementPermVersion(targetUser.id);

  const permissions = await getEffectivePermissions(targetUser.id, targetUser.role);
  return res.json({ permissions });
});
