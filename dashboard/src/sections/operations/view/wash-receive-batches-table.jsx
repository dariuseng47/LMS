'use client';

import { useState } from 'react';

import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Collapse from '@mui/material/Collapse';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import IconButton from '@mui/material/IconButton';
import CardHeader from '@mui/material/CardHeader';
import TableContainer from '@mui/material/TableContainer';

import { fDateTime } from 'src/utils/format-time';

import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';

// ----------------------------------------------------------------------

function BatchRow({ batch }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <TableRow hover>
        <TableCell width={48}>
          <IconButton size="small" onClick={() => setOpen((v) => !v)}>
            <Iconify icon={open ? 'eva:chevron-up-fill' : 'eva:chevron-down-fill'} />
          </IconButton>
        </TableCell>
        <TableCell>{fDateTime(batch.createdAt)}</TableCell>
        <TableCell align="right">{batch.itemCount} ชิ้น</TableCell>
        <TableCell align="right">{batch.weightKg.toLocaleString('th-TH')} กก.</TableCell>
        <TableCell>{batch.userName}</TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={5} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
          <Collapse in={open} unmountOnExit>
            <Stack direction="row" flexWrap="wrap" gap={1} sx={{ py: 1.5 }}>
              {batch.items.map((item) => (
                <Chip
                  key={item.epcCode}
                  size="small"
                  variant="soft"
                  label={`${item.epcCode} · ${item.categoryName}`}
                />
              ))}
            </Stack>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export function WashReceiveBatchesTable({ batches }) {
  return (
    <Card>
      <CardHeader
        title="ประวัติชุดสแกน + ชั่งน้ำหนัก"
        subheader="แต่ละแถว = 1 ชุดที่สแกนพร้อมกัน — กดลูกศรเพื่อดูรายชิ้นในชุด"
      />
      {batches.length === 0 ? (
        <EmptyContent title="ไม่มีข้อมูลในช่วงเวลาที่เลือก" sx={{ py: 8 }} />
      ) : (
        <Scrollbar>
          <TableContainer sx={{ minWidth: 640 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={48} />
                  <TableCell>เวลา</TableCell>
                  <TableCell align="right">จำนวนชิ้น</TableCell>
                  <TableCell align="right">น้ำหนัก</TableCell>
                  <TableCell>บันทึกโดย</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {batches.map((batch) => (
                  <BatchRow key={batch.id} batch={batch} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      )}
    </Card>
  );
}
