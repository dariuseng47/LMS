import { useMemo, useState, useCallback } from 'react';

import { useEpcLookup } from 'src/hooks/use-epc-lookup';
import { useSocketEvent } from 'src/hooks/use-socket-event';

// ----------------------------------------------------------------------

// ผ้าที่จำหน่ายออกแล้วเปลี่ยนประเภทไม่ได้ — ตรงกับ BLOCKED_STATUSES ใน fabricCategoryChanges.controller.js
const BLOCKED_STATUS = 'DECOMMISSIONED';

// ชนิดของกลุ่มในรายการ เรียงตามลำดับที่แสดง — เฉพาะ ready ที่เลือก/ยกเลิกได้และนับเข้ายอด
// title = ชื่อกลุ่มคงที่ (ไม่ระบุ = ชื่อประเภทปัจจุบัน), note = เหตุผลที่ข้าม (ไม่ระบุ = ชื่อหมวดหมู่)
const GROUP_TEXT = {
  ready: {},
  pending: { title: 'กำลังตรวจสอบกับระบบ' },
  error: { title: 'ตรวจไม่สำเร็จ' },
  same: { note: 'อยู่ประเภทนี้แล้ว — ข้าม' },
  blocked: { title: 'แทงชำรุดแล้ว', note: 'เปลี่ยนประเภทไม่ได้ — ข้าม' },
};
const GROUP_ORDER = Object.keys(GROUP_TEXT);

function groupKindOf(entry, targetId) {
  if (!entry) return 'pending';
  if (entry.state !== 'found') return 'error';
  if (entry.item.status === BLOCKED_STATUS) return 'blocked';
  return Number(entry.item.fabricCategoryId) === targetId ? 'same' : 'ready';
}

/**
 * รายการผ้าที่จะเปลี่ยนประเภท — สะสมจากทุกวิธี (สแกน / กรอกรหัส / เลือกจากคลัง) ตรวจกับระบบเป็นก้อนเบื้องหลัง
 * แล้วจัดกลุ่มตามประเภทปัจจุบัน (ดู useEpcLookup)
 *
 * groups = กลุ่มที่แสดง | sources = ประเภทต้นทาง + ชิ้นที่เลือกไว้ (มากไปน้อย) | selectedEpcs = ชิ้นที่จะถูกเปลี่ยนจริง
 * target = ประเภทปลายทางที่เลือก (null = ยังไม่เลือก)
 */
export function useChangeCategoryList({ hospitalId, categories, target }) {
  // Map<epc, { epc, selected }>
  const [foundTags, setFoundTags] = useState(() => new Map());

  // แท็กที่มีอยู่แล้วไม่แตะต้อง — ชิ้นที่ผู้ใช้แตะยกเลิกไว้ต้องไม่ถูกเลือกกลับมาเองเมื่อเครื่องอ่านเจอซ้ำ
  const addTags = useCallback((codes) => {
    setFoundTags((prev) => {
      const fresh = codes.filter((epc) => epc && !prev.has(epc));
      if (fresh.length === 0) return prev;
      const next = new Map(prev);
      fresh.forEach((epc) => next.set(epc, { epc, selected: true }));
      return next;
    });
  }, []);

  const toggleTag = useCallback((epc) => {
    setFoundTags((prev) => {
      const tag = prev.get(epc);
      if (!tag) return prev;
      return new Map(prev).set(epc, { ...tag, selected: !tag.selected });
    });
  }, []);

  const toggleGroup = useCallback((group, selected) => {
    setFoundTags((prev) => {
      const next = new Map(prev);
      group.tags.forEach(({ epc }) => {
        const tag = next.get(epc);
        if (tag) next.set(epc, { ...tag, selected });
      });
      return next;
    });
  }, []);

  const removeTag = useCallback((epc) => {
    setFoundTags((prev) => {
      const next = new Map(prev);
      next.delete(epc);
      return next;
    });
  }, []);

  const clear = useCallback(() => setFoundTags(new Map()), []);

  const tagEpcs = useMemo(() => [...foundTags.keys()], [foundTags]);
  const lookup = useEpcLookup(tagEpcs, hospitalId);
  const { results, listedEpcs, recheck } = lookup;

  // มีการเปลี่ยน/ย้อนประเภทผ้าจากที่อื่น (แท็บประวัติ, handheld, เครื่องอื่น) -> ประเภทปัจจุบันในรายการอาจไม่ตรงแล้ว
  useSocketEvent('fabric:category-changed', () => recheck(listedEpcs));

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [Number(c.id), c])),
    [categories]
  );

  // เรียงตามชนิดก่อน แล้วตามลำดับที่สแกนเจอ (ไม่เรียงตามจำนวน — กลุ่มจะสลับที่ไปมาระหว่างอ่านต่อเนื่อง)
  const groups = useMemo(() => {
    const targetId = target ? Number(target.id) : null;
    const map = new Map();
    listedEpcs.forEach((epc) => {
      const tag = foundTags.get(epc);
      if (!tag) return;
      const item = results[epc]?.item;
      const kind = groupKindOf(results[epc], targetId);
      const categoryId = item ? Number(item.fabricCategoryId) : null;
      const key = kind === 'ready' || kind === 'same' ? `${kind}:${categoryId}` : kind;
      if (!map.has(key)) {
        const category = categoryById.get(categoryId);
        const { title, note } = GROUP_TEXT[kind];
        map.set(key, {
          key,
          kind,
          categoryId,
          title: title ?? category?.name ?? item?.categoryName ?? 'ไม่ระบุประเภทผ้า',
          caption: note ?? (title ? null : category?.group_name),
          tags: [],
        });
      }
      map.get(key).tags.push(tag);
    });
    return [...map.values()].sort(
      (a, b) => GROUP_ORDER.indexOf(a.kind) - GROUP_ORDER.indexOf(b.kind)
    );
  }, [listedEpcs, results, foundTags, categoryById, target]);

  const sources = useMemo(
    () =>
      groups
        .filter((group) => group.kind === 'ready')
        .map((group) => ({
          categoryId: group.categoryId,
          name: group.title,
          epcs: group.tags.filter((tag) => tag.selected).map((tag) => tag.epc),
        }))
        .filter((source) => source.epcs.length > 0)
        .sort((a, b) => b.epcs.length - a.epcs.length),
    [groups]
  );
  const selectedEpcs = useMemo(() => sources.flatMap((source) => source.epcs), [sources]);

  const skippedCount = useMemo(
    () =>
      groups.reduce(
        (sum, { kind, tags }) => sum + (kind === 'same' || kind === 'blocked' ? tags.length : 0),
        0
      ),
    [groups]
  );

  return {
    foundTags,
    tagEpcs,
    lookup,
    groups,
    sources,
    selectedEpcs,
    skippedCount,
    addTags,
    toggleTag,
    toggleGroup,
    removeTag,
    clear,
  };
}
