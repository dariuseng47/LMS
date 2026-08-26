'use client';

import dayjs from 'dayjs';
import { useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';

import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import NoSsr from '@mui/material/NoSsr';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';

import { useSocketEvent } from 'src/hooks/use-socket-event';
import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetWashReceiveReport } from 'src/actions/washReceiveReport';

import { Iconify } from 'src/components/iconify';
import { StatCard } from 'src/components/stat-card';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { WashReceiveScanCard } from './wash-receive-scan-card';
import { WashReceiveReportPDF } from '../wash-receive-report-pdf';
import { WashReceiveBatchesTable } from './wash-receive-batches-table';
import { WashReceiveDateFilterCard } from './wash-receive-date-filter-card';

// ----------------------------------------------------------------------

export function OperationsWashReceiveView() {
  const { hospitalId } = useEffectiveHospital();

  const [startDate, setStartDate] = useState(dayjs());
  const [endDate, setEndDate] = useState(dayjs());
  const [activePreset, setActivePreset] = useState('วันนี้');

  const { range, totals, byCategory, batches, reportLoading, refreshReport } =
    useGetWashReceiveReport(hospitalId, {
      startDate: startDate ? startDate.format('YYYY-MM-DD') : undefined,
      endDate: endDate ? endDate.format('YYYY-MM-DD') : undefined,
    });

  // ผ้าถูกสแกน+ชั่งเข้ามาจากที่ไหนก็ตาม (หน้านี้เอง หรืออุปกรณ์จริงในอนาคต) -> รีเฟรชสรุป/ตารางทันที
  useSocketEvent('scan:wash-receive', refreshReport);

  const handlePreset = (preset) => {
    const [from, to] = preset.getRange();
    setStartDate(from);
    setEndDate(to);
    setActivePreset(preset.label);
  };

  const maxCategoryCount = Math.max(...byCategory.map((c) => c.itemCount), 1);

  return (
    <DashboardContent maxWidth="xl">
      <HospitalContextChip sx={{ mb: 1.5 }} />

      <CustomBreadcrumbs
        heading="รับผ้าหลังซัก & ชั่งน้ำหนักผ้า"
        links={[{ name: 'การปฏิบัติงาน & ติดตาม' }, { name: 'รับผ้าหลังซัก & ชั่งน้ำหนักผ้า' }]}
        action={
          <NoSsr>
            <PDFDownloadLink
              document={
                <WashReceiveReportPDF
                  range={range}
                  totals={totals}
                  byCategory={byCategory}
                  batches={batches}
                />
              }
              fileName={`wash-receive-report-${range?.from ?? ''}-${range?.to ?? ''}.pdf`}
              style={{ textDecoration: 'none' }}
            >
              {({ loading }) => (
                <Button
                  variant="contained"
                  startIcon={
                    loading ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <Iconify icon="solar:file-download-bold-duotone" />
                    )
                  }
                  disabled={loading || !hospitalId}
                >
                  Export PDF
                </Button>
              )}
            </PDFDownloadLink>
          </NoSsr>
        }
        sx={{ mb: { xs: 3, md: 4 } }}
      />

      {!hospitalId ? (
        <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
      ) : (
        <Stack spacing={3}>
          <WashReceiveScanCard hospitalId={hospitalId} onSubmitted={() => refreshReport()} />

          <WashReceiveDateFilterCard
            startDate={startDate}
            endDate={endDate}
            activePreset={activePreset}
            onChangeStartDate={(v) => {
              setStartDate(v);
              setActivePreset(null);
            }}
            onChangeEndDate={(v) => {
              setEndDate(v);
              setActivePreset(null);
            }}
            onSelectPreset={handlePreset}
          />

          {reportLoading ? (
            <LoadingScreen />
          ) : (
            <>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <StatCard
                    icon="solar:clipboard-list-bold-duotone"
                    title="ชุดสแกน+ชั่ง"
                    value={totals.totalBatches}
                    color="info"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <StatCard
                    icon="solar:t-shirt-bold-duotone"
                    title="ผ้าที่รับเข้า (ชิ้น)"
                    value={totals.totalItems}
                    color="primary"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <StatCard
                    icon="solar:scale-bold-duotone"
                    title="น้ำหนักรวม (กก.)"
                    value={totals.totalWeightKg.toLocaleString('th-TH')}
                    color="warning"
                  />
                </Grid>
              </Grid>

              <Card>
                <CardHeader
                  title="สรุปยอดตามหมวดหมู่ผ้า"
                  subheader="นับจำนวนชิ้นที่รับเข้าในช่วงเวลาที่เลือกด้านบน"
                />
                <Stack spacing={1.5} sx={{ p: 2.5, pt: 0 }}>
                  {byCategory.length === 0 ? (
                    <EmptyContent title="ไม่มีข้อมูลในช่วงเวลาที่เลือก" sx={{ py: 4 }} />
                  ) : (
                    byCategory.map((row) => (
                      <Stack key={row.categoryId ?? row.categoryName} spacing={0.5}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">{row.categoryName}</Typography>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            {row.itemCount} ชิ้น
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={(row.itemCount / maxCategoryCount) * 100}
                          sx={{ height: 6, borderRadius: 1 }}
                        />
                      </Stack>
                    ))
                  )}
                </Stack>
              </Card>

              <WashReceiveBatchesTable batches={batches} />
            </>
          )}
        </Stack>
      )}
    </DashboardContent>
  );
}
