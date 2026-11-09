import { lookupFabricByEpcs } from '../api/operations.api';
import { getHospitalScope } from '../api/client';

// กรองแท็กที่สแกนได้ให้เหลือเฉพาะ "ผ้าที่ลงทะเบียนกับระบบแล้ว" (มีใน fabric_items ของโรงพยาบาลนี้)
// แท็กที่ไม่ได้ลงทะเบียน (ป้ายผ้าของที่อื่น/แท็กหลงในระยะเสา) ถูกทิ้งเงียบ ๆ ไม่ขึ้นจอเลย
// ใช้กับทุกโหมดสแกนผ่าน useTriggerScan ยกเว้นหน้าลงทะเบียนผ้า (ต้องเห็นแท็กใหม่)
//
// ตรวจกับ server ผ่าน POST /tracking/lookup เป็นก้อน (สแกนกองผ้าทีเดียวเป็นร้อยชิ้น) และจำผลไว้
//  - ลงทะเบียนแล้ว: จำ POSITIVE_TTL_MS — เหนี่ยวไกซ้ำกองเดิมไม่ต้องถามใหม่
//  - ไม่พบ: จำสั้น ๆ NEGATIVE_TTL_MS — เผื่อเพิ่งอนุมัติลงทะเบียนจากเว็บ จะได้เห็นเร็ว
// cache แยกตามโรงพยาบาลที่เลือก (superadmin สลับได้) และล้างทิ้งตอน logout
const LOOKUP_BATCH = 200; // server รับสูงสุด 500 ต่อ request
const FLUSH_DELAY_MS = 120;
const POSITIVE_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_TTL_MS = 15 * 1000;
const MAX_CACHE_SIZE = 20000;

const cache = new Map(); // `${scope}|${epc}` -> { registered: boolean, expiresAt }

function cacheKey(epc) {
  return `${getHospitalScope() ?? '-'}|${epc}`;
}

function readCache(epc) {
  const key = cacheKey(epc);
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.registered;
}

function writeCache(epc, registered) {
  if (cache.size > MAX_CACHE_SIZE) cache.clear();
  cache.set(cacheKey(epc), {
    registered,
    expiresAt: Date.now() + (registered ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
  });
}

export function clearRegisteredTagCache() {
  cache.clear();
}

// สร้างตัวกรองหนึ่งตัวต่อช่วงที่หน้ากำลังฟังแท็ก
//  onRegistered(epc, item?) — item (ข้อมูลผ้าจาก lookup) แนบมาเฉพาะตอนเพิ่งถาม server สด ๆ
//                             ถ้ามาจาก cache จะไม่มี (สถานะ/ตำแหน่งอาจเก่าแล้ว)
//  onBusyChange(bool)       — มีแท็กรอตรวจกับ server อยู่หรือไม่
//  onError(message | '')    — ถามไม่สำเร็จ (เน็ตหลุด ฯลฯ) แท็กชุดนั้นจะไม่ขึ้นจอ ต้องเหนี่ยวไกสแกนใหม่
export function createRegisteredTagFilter({ onRegistered, onBusyChange, onError }) {
  let disposed = false;
  let queue = [];
  const pending = new Set(); // อยู่ในคิว/กำลังถาม — กันถามซ้ำ
  let timer = null;
  let inFlight = false;
  let busy = false;

  const setBusy = (next) => {
    if (busy === next || disposed) return;
    busy = next;
    onBusyChange?.(next);
  };

  const scheduleFlush = (delay = FLUSH_DELAY_MS) => {
    if (timer || disposed) return;
    timer = setTimeout(flush, delay);
  };

  async function flush() {
    timer = null;
    if (disposed || inFlight || queue.length === 0) return;

    const batch = queue.splice(0, LOOKUP_BATCH);
    inFlight = true;
    try {
      const { items = [] } = await lookupFabricByEpcs(batch);
      const byEpc = new Map(items.map((item) => [item.epcCode, item]));
      batch.forEach((epc) => {
        const item = byEpc.get(epc);
        writeCache(epc, !!item);
        pending.delete(epc);
        if (item && !disposed) onRegistered(epc, item);
      });
      if (!disposed) onError?.('');
    } catch (err) {
      batch.forEach((epc) => pending.delete(epc));
      if (!disposed) onError?.(err?.message || 'ตรวจสอบแท็กกับระบบไม่สำเร็จ');
    } finally {
      inFlight = false;
    }

    if (queue.length > 0) scheduleFlush(0);
    else setBusy(false);
  }

  const push = (rawEpc) => {
    if (disposed) return;
    const epc = typeof rawEpc === 'string' ? rawEpc.trim() : '';
    if (!epc || pending.has(epc)) return;

    const known = readCache(epc);
    if (known === true) {
      onRegistered(epc);
      return;
    }
    if (known === false) return;

    pending.add(epc);
    queue.push(epc);
    setBusy(true);
    scheduleFlush();
  };

  const dispose = () => {
    disposed = true;
    clearTimeout(timer);
    timer = null;
    queue = [];
    pending.clear();
  };

  return { push, dispose };
}
