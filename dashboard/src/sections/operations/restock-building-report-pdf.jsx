import { useMemo } from 'react';
import { Page, View, Text, Font, Document, StyleSheet } from '@react-pdf/renderer';

import { fDate, fDateTime } from 'src/utils/format-time';

// ----------------------------------------------------------------------

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
        rowHead: {
          flexDirection: 'row',
          backgroundColor: '#F4F6F8',
          padding: '6px 4px',
        },
        row: {
          flexDirection: 'row',
          padding: '6px 4px',
          borderBottomWidth: 1,
          borderStyle: 'solid',
          borderColor: '#F0F0F0',
        },
        rowTotal: {
          flexDirection: 'row',
          padding: '6px 4px',
          backgroundColor: '#DFF3E8',
        },
        cellHead: { fontSize: 8, fontWeight: 700, color: '#454F5B' },
        cell: { fontSize: 8, color: '#212B36' },
        cellTotal: { fontSize: 8, fontWeight: 700, color: '#1B806A' },
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

const COL = {
  name: '34%',
  num: '16.5%',
};

export function RestockBuildingReportPDF({ hospitalName, buildingName, range, rows, totals, totalPct }) {
  const styles = useStyles();

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.h1}>รายงานการเติมสต๊อก ตึก{buildingName}</Text>
            {hospitalName && <Text style={styles.muted}>{hospitalName}</Text>}
            <Text style={styles.muted}>
              ช่วงเวลา {range ? `${fDate(range.from)} — ${fDate(range.to)}` : '-'}
            </Text>
          </View>
          <View>
            <Text style={styles.muted}>สร้างเมื่อ {fDateTime(new Date())}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.rowHead}>
            <Text style={[styles.cellHead, { width: COL.name }]}>รายการ</Text>
            <Text style={[styles.cellHead, { width: COL.num, textAlign: 'right' }]}>จำนวนสต็อค (Par)</Text>
            <Text style={[styles.cellHead, { width: COL.num, textAlign: 'right' }]}>จำนวนที่เติม</Text>
            <Text style={[styles.cellHead, { width: COL.num, textAlign: 'right' }]}>สต็อคบนวอร์ด</Text>
            <Text style={[styles.cellHead, { width: COL.num, textAlign: 'right' }]}>รวมทั้งหมด</Text>
          </View>
          {rows.map((r) => (
            <View style={styles.row} key={r.categoryId ?? r.categoryName}>
              <Text style={[styles.cell, { width: COL.name }]}>{r.categoryName}</Text>
              <Text style={[styles.cell, { width: COL.num, textAlign: 'right' }]}>{r.parQty}</Text>
              <Text style={[styles.cell, { width: COL.num, textAlign: 'right' }]}>{r.restockedQty}</Text>
              <Text style={[styles.cell, { width: COL.num, textAlign: 'right' }]}>{r.onWardQty}</Text>
              <Text style={[styles.cell, { width: COL.num, textAlign: 'right' }]}>{r.totalQty}</Text>
            </View>
          ))}
          <View style={styles.rowTotal}>
            <Text style={[styles.cellTotal, { width: COL.name }]}>รวมจำนวนทั้งหมด</Text>
            <Text style={[styles.cellTotal, { width: COL.num, textAlign: 'right' }]}>{totals.parQty}</Text>
            <Text style={[styles.cellTotal, { width: COL.num, textAlign: 'right' }]}>
              {totals.restockedQty}
            </Text>
            <Text style={[styles.cellTotal, { width: COL.num, textAlign: 'right' }]}>{totals.onWardQty}</Text>
            <Text style={[styles.cellTotal, { width: COL.num, textAlign: 'right' }]}>{totals.totalQty}</Text>
          </View>
          <View style={styles.row}>
            <Text style={[styles.cell, { width: '84%' }]}>คิดเป็นเปอร์เซ็นต์ (รวมทั้งหมด / จำนวนสต็อค)</Text>
            <Text style={[styles.cellTotal, { width: COL.num, textAlign: 'right' }]}>
              {totalPct === null ? '—' : `${totalPct.toFixed(1)}%`}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>
          รายงานสร้างโดยระบบ WelGroup Laundry Management — ใช้เพื่อการวางแผนภายในเท่านั้น
        </Text>
      </Page>
    </Document>
  );
}
