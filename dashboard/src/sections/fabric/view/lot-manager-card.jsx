'use client';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import TableContainer from '@mui/material/TableContainer';

import { useBoolean } from 'src/hooks/use-boolean';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { LotFormDialog } from './lot-form-dialog';

// ----------------------------------------------------------------------

export function LotManagerCard({
  hospitalId,
  lots,
  lotsLoading,
  categories,
  onChanged,
  onWantNewCategory,
}) {
  const formDialog = useBoolean();

  return (
    <Card>
      <CardHeader
        title="ล็อตผ้าทั้งหมด"
        subheader="ล็อตที่ลงทะเบียนไว้ในโรงพยาบาลนี้ — สแกนเพิ่ม EPC รายชิ้นเข้าล็อตได้ทีหลังตอนติด RFID tag จริง"
        action={
          <Button
            variant="contained"
            startIcon={<Iconify icon="mingcute:add-line" />}
            onClick={formDialog.onTrue}
            disabled={!hospitalId}
          >
            เพิ่มล็อต
          </Button>
        }
      />
      <CardContent>
        {!hospitalId ? (
          <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 8 }} />
        ) : lotsLoading ? (
          <LoadingScreen sx={{ height: 200 }} />
        ) : lots.length === 0 ? (
          <EmptyContent
            title="ยังไม่มีล็อตผ้าในระบบ"
            description="เริ่มต้นด้วยการเพิ่มล็อตแรกตอนจัดซื้อ/นำเข้าผ้า"
            sx={{ py: 8 }}
          />
        ) : (
          <Scrollbar>
            <TableContainer sx={{ minWidth: 760 }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>รหัสล็อต</TableCell>
                    <TableCell>หมวดหมู่</TableCell>
                    <TableCell align="right">จำนวน</TableCell>
                    <TableCell>วันที่จัดซื้อ</TableCell>
                    <TableCell>เพิ่มโดย</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lots.map((lot) => (
                    <TableRow key={lot.id} hover>
                      <TableCell sx={{ fontWeight: 600 }}>{lot.lot_code}</TableCell>
                      <TableCell>
                        {lot.category_name ? (
                          <Chip size="small" variant="soft" label={lot.category_name} />
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell align="right">{lot.quantity}</TableCell>
                      <TableCell>
                        {lot.purchased_at && lot.purchased_at !== '0000-00-00'
                          ? new Date(lot.purchased_at).toLocaleDateString('th-TH')
                          : '—'}
                      </TableCell>
                      <TableCell>{lot.created_by_name ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Scrollbar>
        )}
      </CardContent>

      <LotFormDialog
        open={formDialog.value}
        onClose={formDialog.onFalse}
        categories={categories}
        onCreated={onChanged}
        onWantNewCategory={onWantNewCategory}
      />
    </Card>
  );
}
