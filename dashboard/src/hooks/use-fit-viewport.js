import { useRef, useState, useEffect, useLayoutEffect } from 'react';

// ----------------------------------------------------------------------

/**
 * ทำให้ส่วนของหน้า "สูงพอดีจอ" แล้วล็อกไม่ให้ทั้งหน้าเลื่อนขึ้นลง — สำหรับหน้าสแกนที่ใช้บนจอทัชสกรีน
 * (เผลอไถจอแล้วหน้าเลื่อนหนีปุ่ม) ส่วนที่ต้องเลื่อนให้เลื่อนเฉพาะในกล่องของตัวเอง (เช่น รายการแท็ก)
 *
 * ใช้: const { ref, height } = useFitViewport({ enabled: isDesktop });
 *      <Box ref={ref} sx={height ? { height } : undefined}>...</Box>
 *
 * height = พื้นที่ที่เหลือจากตำแหน่งบนสุดของ ref ถึงขอบล่างจอ (วัดใหม่ตอนหมุน/ย่อจอ หรือส่วนด้านบน
 * เปลี่ยนความสูง) | null = ไม่ fit (ปิดอยู่ หรือจอเตี้ยกว่า minHeight -> ปล่อยเลื่อนตามปกติ ดีกว่าบีบจนใช้ไม่ได้)
 */
export function useFitViewport({ enabled = true, minHeight = 460, bottomGap = 16 } = {}) {
  const ref = useRef(null);
  const [height, setHeight] = useState(null);

  useLayoutEffect(() => {
    if (!enabled) {
      setHeight(null);
      return undefined;
    }

    const update = () => {
      if (!ref.current) return;
      const top = ref.current.getBoundingClientRect().top + window.scrollY;
      const available = Math.floor(window.innerHeight - top - bottomGap);
      setHeight(available >= minHeight ? available : null);
    };

    window.scrollTo(0, 0);
    update();

    // ส่วนด้านบน (header/แท็บ/ชิปโรงพยาบาล) โหลดเสร็จทีหลังแล้วสูงขึ้น -> body เปลี่ยนขนาด -> วัดใหม่
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [enabled, minHeight, bottomGap]);

  const locked = height !== null;

  // ล็อกการเลื่อนทั้งหน้าระหว่าง fit อยู่ (คืนค่าเดิมตอนออกจากหน้า/สลับแท็บ)
  useEffect(() => {
    if (!locked) return undefined;
    const html = document.documentElement;
    const { body } = document;
    const prev = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      overscroll: html.style.overscrollBehavior,
    };
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehavior = 'none'; // กันดึงหน้าเด้ง (pull-to-refresh / bounce) บนจอทัช
    window.scrollTo(0, 0);
    return () => {
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      html.style.overscrollBehavior = prev.overscroll;
    };
  }, [locked]);

  return { ref, height };
}
