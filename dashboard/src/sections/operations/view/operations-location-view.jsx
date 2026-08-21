'use client';

import { useState, useCallback } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import CardHeader from '@mui/material/CardHeader';
import Typography from '@mui/material/Typography';
import CardContent from '@mui/material/CardContent';

import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { DashboardContent } from 'src/layouts/dashboard';
import { useGetLocationByEpc } from 'src/actions/tracking';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';
import { HospitalContextChip } from 'src/components/hospital-context-chip';

import { STATUS_LABEL, STATUS_COLOR } from '../../fabric/fabric-constants';

// ----------------------------------------------------------------------

export function OperationsLocationView() {
  const { hospitalId } = useEffectiveHospital();

  const [epcInput, setEpcInput] = useState('');
  const [searchedEpc, setSearchedEpc] = useState('');

  const { fabricItem, location, lastScan, locationLoading, locationError } = useGetLocationByEpc(
    searchedEpc || undefined,
    hospitalId
  );

  const handleSearch = useCallback(() => setSearchedEpc(epcInput.trim()), [epcInput]);

  return (
    <DashboardContent maxWidth="xl">
      <HospitalContextChip sx={{ mb: 1.5 }} />

      <CustomBreadcrumbs
        heading="ค้นหาตำแหน่งผ้า"
        links={[{ name: 'การปฏิบัติงาน & ติดตาม' }, { name: 'ค้นหาตำแหน่งผ้า' }]}
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Stack spacing={3} sx={{ maxWidth: 640 }}>
        <Card>
          <CardHeader title="ค้นหาด้วยรหัส EPC" />
          <CardContent>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                label="รหัส EPC"
                value={epcInput}
                disabled={!hospitalId}
                onChange={(e) => setEpcInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button
                variant="contained"
                onClick={handleSearch}
                disabled={!hospitalId || !epcInput.trim()}
                sx={{ flexShrink: 0 }}
              >
                ค้นหา
              </Button>
            </Stack>
          </CardContent>
        </Card>

        {!hospitalId && <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 8 }} />}

        {hospitalId && searchedEpc && locationLoading && <LoadingScreen sx={{ height: 160 }} />}

        {hospitalId && searchedEpc && !locationLoading && locationError && (
          <EmptyContent
            title="ไม่พบผ้ารหัสนี้"
            description={locationError?.message}
            sx={{ py: 8 }}
          />
        )}

        {hospitalId && !locationLoading && fabricItem && (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="h6">{fabricItem.epcCode}</Typography>
                  <Chip
                    size="small"
                    variant="soft"
                    color={STATUS_COLOR[fabricItem.status]}
                    label={STATUS_LABEL[fabricItem.status] ?? fabricItem.status}
                  />
                </Stack>

                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ p: 1.5, borderRadius: 1, bgcolor: 'background.neutral' }}
                >
                  <Iconify icon="solar:map-point-bold-duotone" width={20} />
                  <Typography variant="subtitle2">{location?.name || 'ไม่ทราบตำแหน่งปัจจุบัน'}</Typography>
                </Stack>

                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {lastScan
                    ? `สแกนล่าสุด: ${lastScan.event_type} — ${new Date(lastScan.scanned_at).toLocaleString('th-TH')}`
                    : 'ยังไม่มีประวัติการสแกน'}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Stack>
    </DashboardContent>
  );
}
