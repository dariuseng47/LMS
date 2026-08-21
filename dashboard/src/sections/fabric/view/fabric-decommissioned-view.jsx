'use client';

import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableContainer from '@mui/material/TableContainer';

import { useEffectiveHospital } from 'src/hooks/use-effective-hospital';

import { useGetFabricItems } from 'src/actions/fabric';
import { DashboardContent } from 'src/layouts/dashboard';

import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';
import { HospitalSelector } from 'src/components/hospital-selector';
import { CustomBreadcrumbs } from 'src/components/custom-breadcrumbs';

// ----------------------------------------------------------------------

export function FabricDecommissionedView() {
  const { hospitalId, isSuperadmin, hospitals, selectedHospitalId, setSelectedHospitalId } =
    useEffectiveHospital();

  const { fabricItems, fabricItemsLoading, fabricItemsEmpty } = useGetFabricItems({
    hospitalId,
    status: 'DECOMMISSIONED',
  });

  return (
    <DashboardContent maxWidth="xl">
      <CustomBreadcrumbs
        heading="ประวัติผ้าที่จำหน่ายออก"
        links={[{ name: 'จัดการผ้าและล็อต' }, { name: 'ประวัติผ้าที่จำหน่ายออก' }]}
        action={
          isSuperadmin && (
            <HospitalSelector
              hospitals={hospitals}
              value={selectedHospitalId}
              onChange={setSelectedHospitalId}
            />
          )
        }
        sx={{ mb: { xs: 3, md: 5 } }}
      />

      <Card>
        {!hospitalId ? (
          <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 10 }} />
        ) : fabricItemsLoading ? (
          <LoadingScreen />
        ) : fabricItemsEmpty ? (
          <EmptyContent title="ยังไม่มีผ้าที่จำหน่ายออกจากระบบ" sx={{ py: 10 }} />
        ) : (
          <Scrollbar>
            <TableContainer sx={{ minWidth: 560 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>รหัส EPC</TableCell>
                    <TableCell>รอบซักก่อนแทงชำรุด</TableCell>
                    <TableCell>วันที่อัปเดตล่าสุด</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fabricItems.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell>{item.epc_code}</TableCell>
                      <TableCell>{item.wash_count}</TableCell>
                      <TableCell>{new Date(item.updated_at).toLocaleString('th-TH')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>
        )}
      </Card>
    </DashboardContent>
  );
}
