'use client';

import { useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import CardContent from '@mui/material/CardContent';
import LoadingButton from '@mui/lab/LoadingButton';
import TableContainer from '@mui/material/TableContainer';

import { useBoolean } from 'src/hooks/use-boolean';

import { deleteFabricGroup, deleteFabricCategory } from 'src/actions/fabric';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { EmptyContent } from 'src/components/empty-content';
import { LoadingScreen } from 'src/components/loading-screen';

import { GroupFormDialog } from './group-form-dialog';
import { CategoryFormDialog } from './category-form-dialog';

// ----------------------------------------------------------------------

// จัดการหมวดหมู่ผ้า (เช่น ผ้าเสตอไลส์ / ผ้าสามัญ) และประเภทผ้าที่สังกัดอยู่ใต้หมวดหมู่ (เช่น ชุดผ่าตัด /
// ผ้าปูเตียง / ผ้าปลอกหมอน) — โชว์ลิสต์ทั้งหมด กดแก้ไขได้ ลบได้เฉพาะรายการที่ไม่มีผ้าผูกอยู่
// (เช็คซ้ำที่ backend อีกชั้น ดู fabricCategories/fabricGroups controller)
export function CategoryManagerCard({
  hospitalId,
  groups,
  groupsLoading,
  categories,
  categoriesLoading,
  onGroupsChanged,
  onCategoriesChanged,
}) {
  const groupDialog = useBoolean();
  const [groupMode, setGroupMode] = useState('create');
  const [activeGroup, setActiveGroup] = useState(null);

  const categoryDialog = useBoolean();
  const [categoryMode, setCategoryMode] = useState('create');
  const [activeCategory, setActiveCategory] = useState(null);

  // รายการที่รอยืนยันลบ: { kind: 'group' | 'category', record }
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const openGroupForm = (mode, group = null) => {
    setGroupMode(mode);
    setActiveGroup(group);
    groupDialog.onTrue();
  };

  const openCategoryForm = (mode, category = null) => {
    setCategoryMode(mode);
    setActiveCategory(category);
    categoryDialog.onTrue();
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === 'group') {
        await deleteFabricGroup(pendingDelete.record.id);
        toast.success('ลบหมวดหมู่ผ้าสำเร็จ');
        onGroupsChanged();
      } else {
        await deleteFabricCategory(pendingDelete.record.id);
        toast.success('ลบประเภทผ้าสำเร็จ');
        // นับประเภทผ้าในหมวดหมู่เปลี่ยนด้วย ต้องรีเฟรชทั้งสองรายการ
        onCategoriesChanged();
        onGroupsChanged();
      }
      setPendingDelete(null);
    } catch (error) {
      toast.error(error?.message || 'ลบไม่สำเร็จ');
    } finally {
      setDeleting(false);
    }
  };

  // เหตุผลที่ลบไม่ได้ (null = ลบได้) — ใช้ทั้ง disable ปุ่มและ tooltip
  const groupBlockReason = (group) =>
    Number(group.category_count) > 0
      ? `ยังมีประเภทผ้า ${group.category_count} ประเภทในหมวดหมู่นี้ — ลบประเภทผ้าก่อน`
      : null;

  const categoryBlockReason = (category) => {
    const itemCount = Number(category.item_count);
    const lotCount = Number(category.lot_count);
    if (itemCount > 0) return `มีผ้าผูกอยู่ ${itemCount} ชิ้น`;
    if (lotCount > 0) return `มีล็อตผูกอยู่ ${lotCount} ล็อต`;
    return null;
  };

  const renderDeleteButton = (blockReason, onClick) => (
    <Tooltip title={blockReason ?? 'ลบ'}>
      {/* span ครอบไว้ ให้ tooltip ยังทำงานตอนปุ่มถูก disable */}
      <span>
        <IconButton
          color="error"
          disabled={!!blockReason}
          onClick={(event) => {
            event.stopPropagation();
            onClick();
          }}
        >
          <Iconify icon="solar:trash-bin-trash-bold-duotone" width={18} />
        </IconButton>
      </span>
    </Tooltip>
  );

  const pendingName = pendingDelete?.record?.name;

  return (
    <Stack spacing={3}>
      <Card>
        <CardHeader
          title="หมวดหมู่ผ้า"
          subheader="เช่น ผ้าเสตอไลส์, ผ้าสามัญ — ประเภทผ้าแต่ละประเภทจะสังกัดอยู่ในหมวดหมู่ใดหมวดหมู่หนึ่ง"
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => openGroupForm('create')}
              disabled={!hospitalId}
            >
              เพิ่มหมวดหมู่
            </Button>
          }
        />
        <CardContent>
          {!hospitalId ? (
            <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 8 }} />
          ) : groupsLoading ? (
            <LoadingScreen sx={{ height: 160 }} />
          ) : groups.length === 0 ? (
            <EmptyContent
              title="ยังไม่มีหมวดหมู่ผ้า"
              description="เริ่มต้นด้วยการเพิ่มหมวดหมู่แรก เช่น ผ้าเสตอไลส์, ผ้าสามัญ"
              sx={{ py: 8 }}
            />
          ) : (
            <Scrollbar>
              <TableContainer sx={{ minWidth: 480 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ชื่อหมวดหมู่</TableCell>
                      <TableCell align="right">จำนวนประเภทผ้า</TableCell>
                      <TableCell align="right">การจัดการ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {groups.map((group) => (
                      <TableRow
                        key={group.id}
                        hover
                        onClick={() => openGroupForm('edit', group)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {group.name}
                          </Typography>
                          {group.description && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {group.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{group.category_count}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <IconButton
                            onClick={(event) => {
                              event.stopPropagation();
                              openGroupForm('edit', group);
                            }}
                          >
                            <Iconify icon="solar:pen-2-bold-duotone" width={18} />
                          </IconButton>
                          {renderDeleteButton(groupBlockReason(group), () =>
                            setPendingDelete({ kind: 'group', record: group })
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title="ประเภทผ้า"
          subheader="เช่น ชุดผ่าตัด, ผ้าปูเตียง, ผ้าปลอกหมอน — ผ้าที่ลงทะเบียนใหม่จะผูกกับประเภทผ้า"
          action={
            <Button
              variant="contained"
              startIcon={<Iconify icon="mingcute:add-line" />}
              onClick={() => openCategoryForm('create')}
              disabled={!hospitalId || groups.length === 0}
            >
              เพิ่มประเภทผ้า
            </Button>
          }
        />
        <CardContent>
          {!hospitalId ? (
            <EmptyContent title="กรุณาเลือกโรงพยาบาลก่อน" sx={{ py: 8 }} />
          ) : categoriesLoading ? (
            <LoadingScreen sx={{ height: 160 }} />
          ) : categories.length === 0 ? (
            <EmptyContent
              title="ยังไม่มีประเภทผ้า"
              description={
                groups.length === 0
                  ? 'สร้างหมวดหมู่ผ้าก่อน แล้วค่อยเพิ่มประเภทผ้า'
                  : 'เริ่มต้นด้วยการเพิ่มประเภทผ้าแรก เช่น ผ้าปูเตียง, ชุดผ่าตัด'
              }
              sx={{ py: 8 }}
            />
          ) : (
            <Scrollbar>
              <TableContainer sx={{ minWidth: 560 }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ชื่อประเภท</TableCell>
                      <TableCell>หมวดหมู่</TableCell>
                      <TableCell align="right">จำนวนผ้า</TableCell>
                      <TableCell align="right">การจัดการ</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categories.map((category) => (
                      <TableRow
                        key={category.id}
                        hover
                        onClick={() => openCategoryForm('edit', category)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {category.name}
                          </Typography>
                          {category.description && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {category.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {category.group_name ? (
                            category.group_name
                          ) : (
                            <Chip size="small" color="warning" variant="soft" label="ยังไม่ระบุหมวดหมู่" />
                          )}
                        </TableCell>
                        <TableCell align="right">{category.item_count}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <IconButton
                            onClick={(event) => {
                              event.stopPropagation();
                              openCategoryForm('edit', category);
                            }}
                          >
                            <Iconify icon="solar:pen-2-bold-duotone" width={18} />
                          </IconButton>
                          {renderDeleteButton(categoryBlockReason(category), () =>
                            setPendingDelete({ kind: 'category', record: category })
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Scrollbar>
          )}
        </CardContent>
      </Card>

      <GroupFormDialog
        open={groupDialog.value}
        onClose={groupDialog.onFalse}
        mode={groupMode}
        group={activeGroup}
        hospitalId={hospitalId}
        onSaved={() => {
          onGroupsChanged();
          // ชื่อหมวดหมู่ที่แสดงในตารางประเภทผ้ามาจาก join — รีเฟรชด้วยเมื่อมีการแก้ชื่อ
          onCategoriesChanged();
        }}
      />

      <CategoryFormDialog
        open={categoryDialog.value}
        onClose={categoryDialog.onFalse}
        mode={categoryMode}
        category={activeCategory}
        groups={groups}
        hospitalId={hospitalId}
        onSaved={() => {
          onCategoriesChanged();
          onGroupsChanged();
        }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => (deleting ? null : setPendingDelete(null))}
        title={pendingDelete?.kind === 'group' ? 'ลบหมวดหมู่ผ้า' : 'ลบประเภทผ้า'}
        content={
          <Box>
            ยืนยันลบ{pendingDelete?.kind === 'group' ? 'หมวดหมู่ผ้า' : 'ประเภทผ้า'} &quot;
            {pendingName}&quot; ? การลบนี้ย้อนกลับไม่ได้
          </Box>
        }
        action={
          <LoadingButton variant="contained" color="error" loading={deleting} onClick={handleDelete}>
            ลบ
          </LoadingButton>
        }
      />
    </Stack>
  );
}
