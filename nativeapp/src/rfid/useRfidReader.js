import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { getReaderPower, getSelectedDeviceId, NONE_DEVICE_ID } from './deviceSettings';
import { getDriver } from './drivers';

// Hook คุมเครื่องอ่าน RFID ในตัวเครื่อง (Orca 50 หรือ SEUIC UTouch 2) — เลือก driver จาก device id
// ที่ผู้ใช้ตั้งไว้ในหน้า "ตั้งค่าเครื่อง" แล้ว expose API เดียวกันไม่ว่าจะเครื่องไหน
//
//  - "single read": SDK ทั้งคู่ (ในทางที่เราใช้) ไม่มี primitive ตรง ๆ — startRead() แล้วหยุดที่
//    tag แรกเอง
//  - โหมด "เหนี่ยวไก": Orca อาศัย firmware trigger + listenTags อย่างเดียว / SEUIC ใช้
//    listenTrigger (TriggerDown/Up จริง) + startRead()/stopRead() — ดู useTriggerScan.js
const SINGLE_READ_TIMEOUT_MS = 10000;

// ---- การเชื่อมต่อที่ใช้ร่วมกันทั้งแอป ------------------------------------------------------
//
// เดิมแต่ละหน้า connect()/disconnect() scanner singleton เอง — แท็บ (คลังผ้า/วอร์ด/เปลี่ยนสถานะ)
// mount ค้างไว้พร้อมกัน พอออกจากหน้าใดหน้าหนึ่ง (เช่น ลงทะเบียนผ้า) มันสั่ง disconnect ปิดเครื่องอ่าน
// ทิ้งทั้งที่หน้าอื่นยังเชื่อว่า "connected" อยู่ → กดไกไม่ติดจนต้องปิดแอปเข้าใหม่
// ตอนนี้นับจำนวนหน้าที่ใช้อยู่ (refs) — connect ครั้งเดียวตอนมีผู้ใช้คนแรก และ disconnect จริงเมื่อ
// ไม่มีใครใช้แล้วสักพัก (กันต่อ/ตัดถี่ ๆ ตอนสลับหน้า)
//
// scanner ทั้งสองรุ่นเก็บ callback ได้ event ละตัวเดียว (on() ทับของเดิม และ removeon ของ Orca
// เทียบด้วย toString() ซึ่ง closure ทุกตัวหน้าตาเหมือนกัน → ถอดของหน้าอื่นทิ้งได้) จึงผูก dispatcher
// กลางไว้ตัวเดียวต่อ event แล้วกระจายให้ผู้ฟังทุกรายใน Set แทน
const DISCONNECT_GRACE_MS = 1500;
const readers = new Map(); // driver -> shared reader state (scanner เป็น singleton ต่อ driver)

function getSharedReader(deviceId) {
  const driver = getDriver(deviceId);
  let reader = readers.get(driver);
  if (reader) {
    reader.deviceId = deviceId; // ใช้อ่านค่า power ของรุ่นที่เลือกล่าสุด
    return reader;
  }

  reader = {
    deviceId,
    driver,
    refs: 0,
    status: 'idle', // idle | connecting | connected | error
    errorMessage: '',
    statusSubscribers: new Set(),
    eventListeners: {},
    dispatchersInstalled: false,
    disconnectTimer: null,
    connectSeq: 0,
  };
  readers.set(driver, reader);
  return reader;
}

function setReaderStatus(reader, status, errorMessage = '') {
  reader.status = status;
  reader.errorMessage = errorMessage;
  reader.statusSubscribers.forEach((cb) => cb(status, errorMessage));
}

function installDispatchers(reader) {
  if (reader.dispatchersInstalled) return;
  reader.dispatchersInstalled = true;
  const { scanner, event } = reader.driver;
  [event.Tag, event.TriggerDown, event.TriggerUp].filter(Boolean).forEach((name) => {
    scanner.on(name, (payload) => {
      const listeners = reader.eventListeners[name];
      if (!listeners) return;
      // copy ก่อนวน — ผู้ฟังอาจถอดตัวเองระหว่างถูกเรียก (เช่น singleRead)
      [...listeners].forEach((cb) => cb(payload));
    });
  });
}

function addReaderListener(reader, name, cb) {
  installDispatchers(reader);
  if (!reader.eventListeners[name]) reader.eventListeners[name] = new Set();
  reader.eventListeners[name].add(cb);
  return () => reader.eventListeners[name]?.delete(cb);
}

function connectReader(reader) {
  const { scanner } = reader.driver;
  const seq = ++reader.connectSeq;
  setReaderStatus(reader, 'connecting');
  scanner
    .connect()
    .then((ok) => {
      if (seq !== reader.connectSeq) return;
      if (!ok) {
        setReaderStatus(reader, 'error', 'เชื่อมต่อเครื่องอ่าน RFID ไม่สำเร็จ');
        return;
      }
      setReaderStatus(reader, 'connected');
      // ตั้งกำลังส่งเสาอากาศตามค่าที่ผู้ใช้ตั้งไว้ (แยกช่วงตามรุ่นเครื่อง) แก้ปัญหาสัญญาณอ่อน
      getReaderPower(reader.deviceId)
        .then((power) => {
          if (seq !== reader.connectSeq) return;
          try {
            scanner.setAntennaPower(String(power));
          } catch {
            // เพิกเฉย — เครื่องที่ไม่ใช่ handheld ตัวจริงอาจ throw จาก native lib
          }
        })
        .catch(() => {});
    })
    .catch((err) => {
      if (seq !== reader.connectSeq) return;
      setReaderStatus(reader, 'error', err?.message || 'เชื่อมต่อเครื่องอ่าน RFID ไม่สำเร็จ');
    });
}

function acquireReader(reader) {
  reader.refs += 1;
  clearTimeout(reader.disconnectTimer);
  reader.disconnectTimer = null;
  // idle = ยังไม่เคยต่อ/ตัดไปแล้ว, error = ลองใหม่ทุกครั้งที่มีหน้าเข้ามาใช้ ไม่ต้องปิดแอป
  if (reader.status === 'idle' || reader.status === 'error') {
    connectReader(reader);
  }
}

function releaseReader(reader) {
  reader.refs = Math.max(0, reader.refs - 1);
  if (reader.refs > 0) return;
  clearTimeout(reader.disconnectTimer);
  reader.disconnectTimer = setTimeout(() => {
    reader.disconnectTimer = null;
    if (reader.refs > 0) return;
    reader.connectSeq += 1; // ทิ้งผล connect ที่ค้างอยู่
    try {
      reader.driver.scanner.stopRead();
      reader.driver.scanner.disconnect();
    } catch {
      // เพิกเฉย
    }
    setReaderStatus(reader, 'idle');
  }, DISCONNECT_GRACE_MS);
}

export function useRfidReader({ enabled, deviceId }) {
  const [resolvedId, setResolvedId] = useState(deviceId ?? NONE_DEVICE_ID);
  const [status, setStatus] = useState('idle'); // idle | connecting | connected | error
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (deviceId !== undefined) {
      setResolvedId(deviceId);
      return;
    }
    getSelectedDeviceId().then(setResolvedId);
  }, [deviceId]);

  const hasRfidDevice = resolvedId !== NONE_DEVICE_ID;
  const reader = useMemo(() => (hasRfidDevice ? getSharedReader(resolvedId) : null), [hasRfidDevice, resolvedId]);
  const driver = reader ? reader.driver : getDriver(resolvedId);
  const active = enabled && !!reader && Platform.OS === 'android';

  useEffect(() => {
    if (!active) {
      setStatus('idle');
      setErrorMessage('');
      return undefined;
    }

    const onStatus = (nextStatus, nextError) => {
      setStatus(nextStatus);
      setErrorMessage(nextError);
    };
    reader.statusSubscribers.add(onStatus);
    acquireReader(reader);
    onStatus(reader.status, reader.errorMessage);

    return () => {
      reader.statusSubscribers.delete(onStatus);
      releaseReader(reader);
      setStatus('idle');
    };
  }, [active, reader]);

  const connected = status === 'connected';

  const singleRead = useCallback(
    () =>
      new Promise((resolve, reject) => {
        if (!connected) {
          reject(new Error('เครื่องอ่าน RFID ยังไม่พร้อม'));
          return;
        }

        const { scanner, event } = driver;
        let settled = false;
        let unlisten = null;
        const finish = () => {
          settled = true;
          clearTimeout(timer);
          if (unlisten) unlisten();
          scanner.stopRead();
        };

        const timer = setTimeout(() => {
          if (settled) return;
          finish();
          reject(new Error('ไม่พบ RFID Tag ในระยะเวลาที่กำหนด'));
        }, SINGLE_READ_TIMEOUT_MS);

        unlisten = addReaderListener(reader, event.Tag, (epc) => {
          if (settled) return;
          finish();
          resolve(epc);
        });
        scanner.cleanTagBuffer();
        scanner.startRead();
      }),
    [connected, driver, reader]
  );

  // โหมด "เหนี่ยวไก" — ผูก listener รับ TagEvent ที่ไหลเข้ามา คืน cleanup function สำหรับถอด
  const listenTags = useCallback(
    (onTag) => {
      if (!connected) return undefined;
      driver.scanner.cleanTagBuffer();
      return addReaderListener(reader, driver.event.Tag, onTag);
    },
    [connected, driver, reader]
  );

  // แบบเดียวกับ listenTags แต่สั่ง startRead เองด้วย — คืน cleanup ที่หยุดอ่าน + ถอด listener
  const startBulkRead = useCallback(
    (onTag) => {
      if (!connected) return undefined;
      const unlisten = listenTags(onTag);
      driver.scanner.startRead();
      return () => {
        driver.scanner.stopRead();
        if (unlisten) unlisten();
      };
    },
    [connected, driver, listenTags]
  );

  const stopBulkRead = useCallback(() => {
    driver.scanner.stopRead();
  }, [driver]);

  // event ปุ่มไกจริง (SEUIC เท่านั้น) — onDown/onUp ถูกเรียกตอนกด/ปล่อยไกด้ามปืน คืน cleanup
  const listenTrigger = useCallback(
    (onDown, onUp) => {
      if (!driver.hasTriggerEvents || !connected) return undefined;
      const { event } = driver;
      const unlistenDown = addReaderListener(reader, event.TriggerDown, () => onDown?.());
      const unlistenUp = addReaderListener(reader, event.TriggerUp, () => onUp?.());
      return () => {
        unlistenDown();
        unlistenUp();
      };
    },
    [connected, driver, reader]
  );

  // สั่งเริ่ม/หยุด inventory ตรง ๆ — SEUIC ใช้คู่กับ listenTrigger (Orca อาศัย firmware ไม่ต้องเรียก)
  const startRead = useCallback(() => {
    if (!connected) return;
    const { scanner } = driver;
    scanner.cleanTagBuffer();
    scanner.startRead();
  }, [connected, driver]);

  const stopRead = useCallback(() => {
    driver.scanner.stopRead();
  }, [driver]);

  // ล้าง buffer กันอ่านซ้ำ — เรียกหลังปล่อยไก เพื่อให้เหนี่ยวไกซ้ำแล้วอ่านแท็กเดิมได้อีก
  const cleanBuffer = useCallback(() => {
    driver.scanner.cleanTagBuffer();
  }, [driver]);

  // ปรับกำลังส่งเสาอากาศสด ๆ ระหว่างเชื่อมต่ออยู่ (dBm) — ให้หน้า "ตั้งค่าเครื่อง" เรียกตอนเลื่อนค่า
  const applyPower = useCallback(
    (power) => {
      if (!connected) return;
      try {
        driver.scanner.setAntennaPower(String(power));
      } catch {
        // เพิกเฉย
      }
    },
    [connected, driver]
  );

  return {
    status,
    errorMessage,
    hasTriggerEvents: driver.hasTriggerEvents,
    singleRead,
    startBulkRead,
    stopBulkRead,
    listenTags,
    listenTrigger,
    startRead,
    stopRead,
    cleanBuffer,
    applyPower,
  };
}
