import { PDFDownloadLink } from '@react-pdf/renderer';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import NoSsr from '@mui/material/NoSsr';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { alpha } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import LinearProgress from '@mui/material/LinearProgress';
import CircularProgress from '@mui/material/CircularProgress';

import { fDate } from 'src/utils/format-time';
import { exportSheetsToExcel } from 'src/utils/export-excel';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { SectionAvatar } from './restock-section-avatar';
import { RestockWardReportPDF } from '../restock-ward-report-pdf';

// ----------------------------------------------------------------------

export function RestockWardSummaryCard({ wardGroups, range, getCategoryColor }) {
  const rangeLabel = range ? `${fDate(range.from)} — ${fDate(range.to)}` : '';

  const handleExportExcel = () => {
    if (wardGroups.length === 0) return;
    const sheets = wardGroups.map((group) => {
      const rows = [
        ...group.categories.map((c) => ({
          categoryName: c.categoryName,
          count: c.count,
          transferCount: c.transferCount,
        })),
        {
          categoryName: 'รวม',
          count: group.total,
          transferCount: group.categories.reduce((sum, c) => sum + c.transferCount, 0),
        },
      ];
      return {
        sheetName: group.wardName,
        title: `สรุปการเติมผ้า — ${group.wardName}`,
        subtitle: rangeLabel ? `ช่วงเวลา ${rangeLabel}` : '',
        columns: [
          { key: 'categoryName', label: 'หมวดหมู่ผ้า', width: 160 },
          { key: 'count', label: 'จำนวนครั้งที่เติม' },
          { key: 'transferCount', label: 'โอนข้ามตู้' },
        ],
        rows,
        totalRowIndexes: [rows.length - 1],
      };
    });
    exportSheetsToExcel({
      fileName: `สรุปตามวอร์ด-${range?.from ?? ''}-${range?.to ?? ''}`,
      sheets,
    });
  };

  return (
    <Card>
      <CardHeader
        avatar={<SectionAvatar icon="solar:hospital-bold-duotone" color="success" />}
        title="สรุปการเติมผ้าแยกตามวอร์ด"
        subheader={rangeLabel}
        action={
          wardGroups.length > 0 && (
            <Stack direction="row" spacing={1}>
              <NoSsr>
                <PDFDownloadLink
                  document={<RestockWardReportPDF range={range} wardGroups={wardGroups} />}
                  fileName={`สรุปตามวอร์ด-${range?.from ?? ''}-${range?.to ?? ''}.pdf`}
                  style={{ textDecoration: 'none' }}
                >
                  {({ loading }) => (
                    <Button
                      size="small"
                      variant="contained"
                      startIcon={
                        loading ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : (
                          <Iconify icon="solar:file-download-bold-duotone" />
                        )
                      }
                      disabled={loading}
                    >
                      Export PDF
                    </Button>
                  )}
                </PDFDownloadLink>
              </NoSsr>
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={<Iconify icon="solar:file-text-bold-duotone" />}
                onClick={handleExportExcel}
              >
                Export Excel
              </Button>
            </Stack>
          )
        }
      />
      {wardGroups.length === 0 ? (
        <EmptyContent
          title="ไม่มีข้อมูลการเติมผ้าในช่วงเวลานี้"
          description="ลองเลือกช่วงเวลาอื่น หรือรอให้มีการเติมผ้าเข้าตู้ก่อน"
          sx={{ py: 8 }}
        />
      ) : (
        <Box sx={{ p: 2.5, pt: 1 }}>
          <Grid container spacing={2}>
            {wardGroups.map((group) => (
              <Grid item xs={12} md={6} key={group.wardName}>
                <Card
                  variant="outlined"
                  sx={{
                    p: 2,
                    height: 1,
                    borderRadius: 1.5,
                    transition: (theme) => theme.transitions.create('box-shadow'),
                    '&:hover': { boxShadow: (theme) => theme.customShadows?.z8 ?? 4 },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
                    <Avatar
                      sx={{
                        width: 36,
                        height: 36,
                        bgcolor: 'success.lighter',
                        color: 'success.darker',
                        mr: 1.5,
                      }}
                    >
                      <Iconify icon="solar:hospital-bold-duotone" width={20} />
                    </Avatar>
                    <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                      {group.wardName}
                    </Typography>
                    <Chip size="small" variant="soft" color="default" label={`รวม ${group.total} ชิ้น`} />
                  </Box>
                  <Divider sx={{ mb: 1.5, borderStyle: 'dashed' }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {group.categories.map((c) => {
                      const color = getCategoryColor(c.categoryName);
                      const pct = group.total ? Math.round((c.count / group.total) * 100) : 0;
                      return (
                        <Box key={c.categoryId ?? c.categoryName}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                bgcolor: color,
                                mr: 1,
                                flexShrink: 0,
                              }}
                            />
                            <Typography variant="body2" sx={{ flexGrow: 1 }}>
                              {c.categoryName}
                            </Typography>
                            {c.transferCount > 0 && (
                              <Chip
                                size="small"
                                variant="soft"
                                color="warning"
                                icon={<Iconify icon="solar:transfer-horizontal-bold-duotone" width={12} />}
                                label={c.transferCount}
                                sx={{ mr: 1, height: 20, '& .MuiChip-label': { px: 0.75 } }}
                              />
                            )}
                            <Typography variant="subtitle2">{c.count} ครั้ง</Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{
                              height: 6,
                              borderRadius: 1,
                              bgcolor: alpha(color, 0.16),
                              '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 },
                            }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
    </Card>
  );
}
