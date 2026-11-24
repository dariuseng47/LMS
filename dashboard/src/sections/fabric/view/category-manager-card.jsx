'use client';

import { useMemo, useState } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import CardHeader from '@mui/material/CardHeader';
import IconButton from '@mui/material/IconButton';
import LoadingButton from '@mui/lab/LoadingButton';
import CardContent from '@mui/material/CardContent';
import InputAdornment from '@mui/material/InputAdornment';
import TableSortLabel from '@mui/material/TableSortLabel';
import TableContainer from '@mui/material/TableContainer';

import { useBoolean } from 'src/hooks/use-boolean';

import { varAlpha } from 'src/theme/styles';
import { deleteFabricGroup, deleteFabricCategory } from 'src/actions/fabric';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';
import { Scrollbar } from 'src/components/scrollbar';
import { EmptyContent } from 'src/components/empty-content';
import { ConfirmDialog } from 'src/components/custom-dialog';
import { LoadingScreen } from 'src/components/loading-screen';

import { SectionAvatar } from 'src/sections/operations/view/restock-section-avatar';

import { GroupFormDialog } from './group-form-dialog';
import { CategoryFormDialog } from './category-form-dialog';

// ----------------------------------------------------------------------

// ตารางประเภทผ้า: คอลัมน์ที่กดเรียงได้ — name/group_name เรียงตามตัวอักษรไทย, item_count เรียงตามตัวเลข
const CATEGORY_SORT_FIELDS = {
  name: (c) => c.name || '',
  group_name: (c) => c.group_name || '',
  item_count: (c) => Number(c.item_count) || 0,
  max_wash_cycles: (c) => Number(c.max_wash_cycles) || 0,
};

const NO_GROUP_FILTER = 'none';

function compareValues(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'th');
}

// จัดการหมวดหมู่ผ้า (เช่น ผ้าเสตอไลส์ / ผ้าสามัญ) และประเภทผ้าที่สังกัดอยู่ใต้หมวดหมู่ (เช่น ชุดผ่าตัด /
// ผ้าปูเตียง / ผ้าปลอกหมอน) — โชว์ลิสต์ทั้งหมด กดแก้ไขได้ ลบได้เฉพาะรายการที่ไม่มีผ้าผูกอยู่
// (เช็คซ้ำที่ backend อีกชั้น ดู fabricCategories/fabricGroups controller)
export function CategoryManagerCard({
  hospitalId,
  groups,
  groupsLoading,
  categories,
  categoriesLoading,
  canEdit,
  onGroupsChanged,
  onCategoriesChanged,
}) {
  const groupDialog = useBoolean();
  const [groupMode, setGroupMode] = useState('create');
  const [activeGroup, setActiveGroup] = useState(null);

  const categoryDialog = useBoolean();
  const [categoryMode, setCategoryMode] = useState('create');
  const [activeCategory, setActiveCategory] = useState(null);

  // ค้นหา / กรองหมวดหมู่ / เรียงตารางประเภทผ้า (ทำฝั่ง client — รายการประเภทผ้าโหลดมาครบอยู่แล้ว)
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryGroupFilter, setCategoryGroupFilter] = useState('');
  const [categorySort, setCategorySort] = useState({ orderBy: 'name', order: 'asc' });

  const visibleCategories = useMemo(() => {
    const keyword = categorySearch.trim().toLowerCase();
    const filtered = categories.filter((category) => {
      if (categoryGroupFilter) {
        const key = category.group_id ?? NO_GROUP_FILTER;
        if (String(key) !== String(categoryGroupFilter)) return false;
      }
      if (!keyword) return true;
      return [category.name, category.description, category.group_name].some((text) =>
        (text || '').toLowerCase().includes(keyword)
      );
    });

    const getValue = CATEGORY_SORT_FIELDS[categorySort.orderBy];
    const direction = categorySort.order === 'asc' ? 1 : -1;
    return [...filtered].sort(
      (a, b) =>
        direction * compareValues(getValue(a), getValue(b)) ||
        compareValues(a.name || '', b.name || '')
    );
  }, [categories, categorySearch, categoryGroupFilter, categorySort]);

  const handleCategorySort = (orderBy) => {
    setCategorySort((prev) => ({
      orderBy,
      order: prev.orderBy === orderBy && prev.order === 'asc' ? 'desc' : 'asc',
    }));
  };

  const renderSortCell = (field, label, align) => (
    <TableCell
      align={align}
      sortDirection={categorySort.orderBy === field ? categorySort.order : false}
    >
      <TableSortLabel
        active={categorySort.orderBy === field}
        direction={categorySort.orderBy === field ? categorySort.order : 'asc'}
        onClick={() => handleCategorySort(field)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

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
        if (String(categoryGroupFilter) === String(pendingDelete.record.id)) {
          setCategoryGroupFilter('');
        }
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

  const renderGroupTile = ({ value, name, description, count, group }) => {
    const selected = String(categoryGroupFilter) === String(value);
    return (
      <Box
        key={value || 'all'}
        sx={(theme) => ({
          gap: 0.5,
          pr: 1,
          display: 'flex',
          alignItems: 'center',
          borderRadius: 1.5,
          border: `1px solid ${varAlpha(theme.vars.palette.grey['500Channel'], 0.2)}`,
          ...(selected && {
            borderColor: 'primary.main',
            bgcolor: varAlpha(theme.vars.palette.primary.mainChannel, 0.08),
          }),
        })}
      >
        <ButtonBase
          aria-pressed={selected}
          onClick={() => setCategoryGroupFilter(value)}
          sx={{
            px: 2,
            py: 1.25,
            gap: 1.5,
            flex: 1,
            minWidth: 0,
            minHeight: 56,
            textAlign: 'left',
            borderRadius: 1.5,
            justifyContent: 'flex-start',
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>
              {name}
            </Typography>
            {description && (
              <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary' }}>
                {description}
              </Typography>
            )}
          </Box>
          <Label color={selected ? 'primary' : 'default'}>{count}</Label>
        </ButtonBase>
        {group && canEdit && (
          <Stack direction="row">
            <Tooltip title="แก้ไข">
              <IconButton onClick={() => openGroupForm('edit', group)}>
                <Iconify icon="solar:pen-2-bold-duotone" width={18} />
              </IconButton>
            </Tooltip>
            {renderDeleteButton(groupBlockReason(group), () =>
              setPendingDelete({ kind: 'group', record: group })
            )}
          </Stack>
        )}
      </Box>
    );
  };

  const noGroupCount = categories.filter((c) => !c.group_id).length;
  const activeGroupName = groups.find((g) => String(g.id) === String(categoryGroupFilter))?.name;

  return (
    <>
      <Grid container spacing={3} alignItems="flex-start">
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader
              avatar={<SectionAvatar icon="solar:folder-with-files-bold-duotone" color="warning" />}
              title="หมวดหมู่ผ้า"
              subheader="แตะเพื่อดูประเภทผ้าในหมวดนั้น"
              action={
                canEdit && (
                  <Tooltip title="เพิ่มหมวดหมู่">
                    <IconButton
                      color="primary"
                      aria-label="เพิ่มหมวดหมู่"
                      onClick={() => openGroupForm('create')}
                    >
                      <Iconify icon="solar:add-circle-bold" width={28} />
                    </IconButton>
                  </Tooltip>
                )
              }
            />
            <CardContent>
              {groupsLoading ? (
                <LoadingScreen sx={{ height: 160 }} />
              ) : groups.length === 0 ? (
                <EmptyContent
                  title="ยังไม่มีหมวดหมู่ผ้า"
                  description="เริ่มต้นด้วยการเพิ่มหมวดหมู่แรก เช่น ผ้าเสตอไลส์, ผ้าสามัญ"
                  sx={{ py: 4 }}
                  slotProps={{ img: { maxWidth: 96 } }}
                />
              ) : (
                <Stack spacing={1}>
                  {renderGroupTile({ value: '', name: 'ทุกหมวดหมู่', count: categories.length })}
                  {groups.map((group) =>
                    renderGroupTile({
                      value: group.id,
                      name: group.name,
                      description: group.description,
                      count: group.category_count,
                      group,
                    })
                  )}
                  {noGroupCount > 0 &&
                    renderGroupTile({
                      value: NO_GROUP_FILTER,
                      name: 'ยังไม่ระบุหมวดหมู่',
                      count: noGroupCount,
                    })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader
              avatar={<SectionAvatar icon="solar:tag-bold-duotone" color="primary" />}
              title={activeGroupName ? `ประเภทผ้า · ${activeGroupName}` : 'ประเภทผ้า'}
              subheader="ผ้าที่ลงทะเบียนใหม่จะผูกกับประเภทผ้า เช่น ชุดผ่าตัด, ผ้าปูเตียง"
              action={
                canEdit && (
                  <Button
                    variant="contained"
                    startIcon={<Iconify icon="mingcute:add-line" />}
                    onClick={() => openCategoryForm('create')}
                    disabled={groups.length === 0}
                    sx={{ minHeight: 44 }}
                  >
                    เพิ่มประเภทผ้า
                  </Button>
                )
              }
            />
            <CardContent>
              {categoriesLoading ? (
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
                <>
                  <TextField
                    fullWidth
                    size="small"
                    value={categorySearch}
                    onChange={(event) => setCategorySearch(event.target.value)}
                    placeholder="ค้นหาประเภทผ้า (ชื่อ / รายละเอียด / หมวดหมู่)"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Iconify icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
                        </InputAdornment>
                      ),
                      endAdornment: categorySearch ? (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setCategorySearch('')}>
                            <Iconify icon="mingcute:close-line" width={16} />
                          </IconButton>
                        </InputAdornment>
                      ) : null,
                    }}
                    sx={{ mb: 2.5 }}
                  />
                  <Scrollbar>
                    <TableContainer sx={{ minWidth: 640 }}>
                      <Table>
                        <TableHead>
                          <TableRow>
                            {renderSortCell('name', 'ชื่อประเภท')}
                            {renderSortCell('group_name', 'หมวดหมู่')}
                            {renderSortCell('item_count', 'จำนวนผ้า', 'right')}
                            {renderSortCell('max_wash_cycles', 'รอบซักไม่เกิน', 'right')}
                            {canEdit && <TableCell align="right">การจัดการ</TableCell>}
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {visibleCategories.length === 0 && (
                            <TableRow>
                              <TableCell
                                colSpan={5}
                                align="center"
                                sx={{ py: 6, color: 'text.secondary' }}
                              >
                                ไม่พบประเภทผ้าที่ตรงกับการค้นหา
                              </TableCell>
                            </TableRow>
                          )}
                          {visibleCategories.map((category) => (
                            <TableRow
                              key={category.id}
                              hover
                              onClick={
                                canEdit ? () => openCategoryForm('edit', category) : undefined
                              }
                              sx={canEdit ? { cursor: 'pointer' } : undefined}
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
                                  <Label color="warning">ยังไม่ระบุหมวดหมู่</Label>
                                )}
                              </TableCell>
                              <TableCell align="right">
                                {Number(category.item_count).toLocaleString('th-TH')}
                              </TableCell>
                              <TableCell align="right">
                                {category.max_wash_cycles ? (
                                  `${category.max_wash_cycles.toLocaleString('th-TH')} ครั้ง`
                                ) : (
                                  <Box component="span" sx={{ color: 'text.disabled' }}>
                                    ไม่ได้ตั้ง
                                  </Box>
                                )}
                              </TableCell>
                              {canEdit && (
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
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Scrollbar>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
    </>
  );
}
