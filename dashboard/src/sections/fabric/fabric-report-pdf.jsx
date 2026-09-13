import { useMemo } from 'react';
import { Page, View, Text, Font, Document, StyleSheet } from '@react-pdf/renderer';

import { fDate, fDateTime } from 'src/utils/format-time';

// ----------------------------------------------------------------------

// ฟอนต์ Roboto เดิมของธีมไม่มีตัวอักษรไทย ใช้ Noto Sans Thai แทน (ตัวเดียวกับรายงานฝั่ง
// operations — react-pdf dedupe family name ให้เอง จึง register ซ้ำได้ไม่มีปัญหา)
Font.register({
  family: 'NotoSansThai',
  fonts: [
    { src: '/fonts/NotoSansThai-Regular.ttf' },
    { src: '/fonts/NotoSansThai-Bold.ttf', fontWeight: 700 },
  ],
});

const useStyles = () =>
  useMemo(
    () =>
      StyleSheet.create({
        page: {
          fontSize: 9,
          lineHeight: 1.6,
          fontFamily: 'NotoSansThai',
          backgroundColor: '#FFFFFF',
          padding: '32px 28px',
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 20,
          paddingBottom: 16,
          borderBottomWidth: 2,
          borderStyle: 'solid',
          borderColor: '#00A76F',
        },
        h1: { fontSize: 16, fontWeight: 700, color: '#00A76F' },
        muted: { fontSize: 8, color: '#637381' },
        table: { display: 'flex', width: '100%', marginBottom: 4 },
        rowHead: { flexDirection: 'row', backgroundColor: '#F4F6F8', padding: '6px 4px' },
        row: {
          flexDirection: 'row',
          padding: '6px 4px',
          borderBottomWidth: 1,
          borderStyle: 'solid',
          borderColor: '#F0F0F0',
        },
        rowAlt: {
          flexDirection: 'row',
          padding: '6px 4px',
          backgroundColor: '#FBFCFD',
          borderBottomWidth: 1,
          borderStyle: 'solid',
          borderColor: '#F0F0F0',
        },
        cellHead: { fontSize: 8, fontWeight: 700, color: '#454F5B' },
        cell: { fontSize: 8, color: '#212B36' },
        footer: {
          position: 'absolute',
          bottom: 20,
          left: 28,
          right: 28,
          textAlign: 'center',
          fontSize: 7,
          color: '#919EAB',
        },
      }),
    []
  );

const ROW_LIMIT = 400;
const FOOTER_TEXT = 'รายงานสร้างโดยระบบ WelGroup Laundry Management — ใช้เพื่อการวางแผนภายในเท่านั้น';

/**
 * รายงาน PDF ตารางเดียวแบบทั่วไป ใช้กับทุกเมนูย่อยของ "จัดการผ้าและล็อต" (คลังผ้า/ล็อต/พัก-ชำรุด/
 * จำหน่ายออก) — โครงหน้าเดียวกับรายงาน Excel ที่ export ด้วย exportRowsToExcel (ดู export-excel.js)
 * เพื่อไม่ให้ตัวเลขสองฝั่งเพี้ยนกัน
 *
 * @param {object} opts
 * @param {string} opts.title
 * @param {string} [opts.hospitalName]
 * @param {string} [opts.subtitle]           บรรทัดเสริมใต้ชื่อโรงพยาบาล เช่น ตัวกรองที่ใช้อยู่
 * @param {{ from: any, to: any }|null} [opts.range]  ช่วงวันที่ที่กรอง (null = ไม่ได้กรอง/ทั้งหมด)
 * @param {{ key: string, label: string, width: string, align?: 'left'|'right'|'center' }[]} opts.columns
 * @param {object[]} opts.rows
 */
export function FabricListReportPDF({ title, hospitalName, subtitle, range, columns, rows }) {
  const styles = useStyles();
  const limitedRows = rows.slice(0, ROW_LIMIT);

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>{title}</Text>
            {hospitalName && <Text style={styles.muted}>{hospitalName}</Text>}
            <Text style={styles.muted}>
              ช่วงเวลา {range ? `${fDate(range.from)} — ${fDate(range.to)}` : 'ทั้งหมด'}
            </Text>
            {subtitle && <Text style={styles.muted}>{subtitle}</Text>}
          </View>
          <View>
            <Text style={styles.muted}>สร้างเมื่อ {fDateTime(new Date())}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.rowHead}>
            {columns.map((col) => (
              <Text key={col.key} style={[styles.cellHead, { width: col.width, textAlign: col.align ?? 'left' }]}>
                {col.label}
              </Text>
            ))}
          </View>
          {limitedRows.map((row, i) => (
            <View style={i % 2 === 1 ? styles.rowAlt : styles.row} key={row.__key ?? i}>
              {columns.map((col) => (
                <Text
                  key={col.key}
                  style={[styles.cell, { width: col.width, textAlign: col.align ?? 'left' }]}
                >
                  {row[col.key] ?? '—'}
                </Text>
              ))}
            </View>
          ))}
          {limitedRows.length === 0 && (
            <Text style={[styles.cell, { padding: '8px 4px' }]}>ไม่มีข้อมูลตามเงื่อนไขที่เลือก</Text>
          )}
        </View>
        {rows.length > ROW_LIMIT && (
          <Text style={styles.muted}>
            ...และอีก {rows.length - ROW_LIMIT} รายการ (ดูฉบับเต็มในไฟล์ Excel)
          </Text>
        )}

        <Text style={styles.footer}>
          รวมทั้งหมด {rows.length} รายการ · {FOOTER_TEXT}
        </Text>
      </Page>
    </Document>
  );
}
