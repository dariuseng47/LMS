// คิว "ลิสต์ก่อน ตรวจทีหลัง" สำหรับแท็กที่สแกนเข้ามาเยอะ ๆ (ใช้ในหน้าสแกนค้นหาผ้า + หน้าสแกนลงทะเบียน)
//
// หน้าจอใส่แท็กลงรายการทันทีที่อ่านได้ (สถานะ "รอตรวจ") แล้วโยน EPC เข้าคิวนี้ คิวจะทยอยส่งไปตรวจกับ
// server เป็นก้อน ๆ เบื้องหลัง:
//  - ทีละ request เดียว (ไม่ยิงซ้อน) — ระหว่างรอผลแท็กใหม่จะสะสมในคิว รอบถัดไปจึงได้ก้อนใหญ่ขึ้นเอง
//    (สแกนช้า = ก้อนเล็กตอบไว / สแกนรัว = ก้อนใหญ่ ประหยัด request) ไม่เกิน batchSize ต่อ request
//  - ตรวจตามลำดับที่สแกน (FIFO) แท็กแรก ๆ ได้ผลก่อน
//  - เน็ตสะดุด: ลองใหม่อัตโนมัติ retries ครั้ง (หน่วงเพิ่มขึ้นเรื่อย ๆ) ก่อนแจ้ง onFailed ให้หน้าจอขึ้นปุ่มลองใหม่
//
// fetchBatch(codes) ต้องคืน Promise ของ "ผลต่อ EPC" เป็น object { [epc]: result } — EPC ที่ไม่อยู่ใน
// object จะได้ result = undefined ส่งกลับไปให้ onResults เหมือนกัน (หน้าจอตีความเองว่าแปลว่าอะไร)
export function createEpcBatchQueue({
  fetchBatch,
  onResults, // (resultsByEpc: { [epc]: result | undefined }) => void — เรียกครั้งเดียวต่อก้อน
  onFailed, // (codes: string[], error) => void — ก้อนที่ลองครบแล้วยังไม่สำเร็จ
  onPendingChange, // (count) => void — จำนวนแท็กที่ยังรอตรวจ (อยู่ในคิว + กำลังถาม)
  batchSize = 200, // server รับสูงสุด 500 ต่อ request
  delayMs = 150, // รอแท็กที่ไหลตามมาอีกนิดก่อนยิงก้อนแรก
  retries = 2,
  retryDelayMs = 1000,
}) {
  let queue = [];
  const queued = new Set(); // กันใส่ซ้ำระหว่างรอ
  let inFlight = 0; // จำนวนแท็กในก้อนที่กำลังถาม
  let timer = null;
  let running = false;
  let disposed = false;
  let generation = 0; // เพิ่มทุกครั้งที่ clear — ทิ้งผลของก้อนที่ค้างจากรอบก่อน
  let lastPending = -1;

  const reportPending = () => {
    const next = queue.length + inFlight;
    if (next === lastPending || disposed) return;
    lastPending = next;
    onPendingChange?.(next);
  };

  const schedule = (delay) => {
    if (timer || running || disposed || queue.length === 0) return;
    timer = setTimeout(run, delay);
  };

  async function run() {
    timer = null;
    if (running || disposed || queue.length === 0) return;
    running = true;
    const gen = generation;
    const batch = queue.splice(0, batchSize);
    inFlight = batch.length;
    reportPending();

    let results;
    let lastError;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      if (attempt > 0) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
        if (disposed || gen !== generation) break;
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        results = await fetchBatch(batch);
        break;
      } catch (err) {
        lastError = err;
      }
    }

    running = false;
    inFlight = 0;
    if (disposed) return;
    if (gen === generation) {
      batch.forEach((code) => queued.delete(code));
      if (results) {
        const byEpc = {};
        batch.forEach((code) => {
          byEpc[code] = results[code];
        });
        onResults?.(byEpc);
      } else {
        onFailed?.(batch, lastError);
      }
    }
    reportPending();
    schedule(0);
  }

  return {
    push(codes) {
      if (disposed) return;
      let added = false;
      codes.forEach((code) => {
        if (!code || queued.has(code)) return;
        queued.add(code);
        queue.push(code);
        added = true;
      });
      if (!added) return;
      reportPending();
      schedule(delayMs);
    },
    // เอาออกจากคิว (เช่น ผู้ใช้ลบแท็กนั้นทิ้งก่อนตรวจถึง) — ถ้ากำลังถามอยู่ผลจะกลับมาแล้วหน้าจอเมินเอง
    remove(code) {
      if (!queued.has(code)) return;
      const idx = queue.indexOf(code);
      if (idx === -1) return;
      queue.splice(idx, 1);
      queued.delete(code);
      reportPending();
    },
    clear() {
      generation += 1;
      clearTimeout(timer);
      timer = null;
      queue = [];
      queued.clear();
      inFlight = 0;
      reportPending();
    },
    dispose() {
      disposed = true;
      generation += 1;
      clearTimeout(timer);
      timer = null;
      queue = [];
      queued.clear();
    },
  };
}
