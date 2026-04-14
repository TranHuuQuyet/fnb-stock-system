"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getSession } from '@/lib/auth';
import { localizeRole } from '@/lib/localization';
import { listStores } from '@/services/admin/stores';
import {
  getIngredientStockBoard,
  saveIngredientStockLayout
} from '@/services/ingredient-stock-board';

type OperationType = 'STORE_USAGE' | 'TRANSFER';

type BoardShift = {
  key: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  sortOrder: number;
};

type BoardCell = {
  day: number;
  shiftKey: string;
  quantity: number;
};

type BoardItem = {
  ingredientId: string;
  ingredientCode: string;
  ingredientName: string;
  unit: string;
  totalRemainingQty: number;
  dailyTotals: BoardCell[];
};

type BoardGroup = {
  groupId: string;
  groupName: string;
  sortOrder: number;
  items: BoardItem[];
};

type GroupOption = {
  id: string;
  name: string;
  usageCount: number;
};

type IngredientOption = {
  id: string;
  code: string;
  name: string;
  unit: string;
  isActive: boolean;
  groupId: string;
  groupName: string;
  totalRemainingQty: number;
};

type BoardPayload = {
  store: {
    id: string;
    code: string;
    name: string;
    timezone: string;
  };
  year: number;
  month: number;
  daysInMonth: number;
  operationType: OperationType;
  lowStockThreshold: number;
  canEdit: boolean;
  shifts: BoardShift[];
  summary: {
    groupCount: number;
    ingredientCount: number;
    lowStockCount: number;
  };
  alerts: Array<{
    ingredientId: string;
    ingredientCode: string;
    ingredientName: string;
    unit: string;
    totalRemainingQty: number;
    groupId: string;
    groupName: string;
  }>;
  layout: {
    id: string | null;
    groups: BoardGroup[];
  };
  options: {
    groups: GroupOption[];
    ingredients: IngredientOption[];
  };
};

type EditableState = {
  groups: BoardGroup[];
};

const todayInVietnam = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit'
}).format(new Date());

const [defaultYearString, defaultMonthString] = todayInVietnam.split('-');

const quantityFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

const buildEditorState = (payload?: BoardPayload): EditableState | null => {
  if (!payload) {
    return null;
  }

  return {
    groups: payload.layout.groups.map((group) => ({
      groupId: group.groupId,
      groupName: group.groupName,
      sortOrder: group.sortOrder,
      items: group.items.map((item) => ({
        ingredientId: item.ingredientId,
        ingredientCode: item.ingredientCode,
        ingredientName: item.ingredientName,
        unit: item.unit,
        totalRemainingQty: item.totalRemainingQty,
        dailyTotals: item.dailyTotals.map((cell) => ({ ...cell }))
      }))
    }))
  };
};

const normalizeGroups = (groups: BoardGroup[]) =>
  groups.map((group, groupIndex) => ({
    ...group,
    sortOrder: groupIndex,
    items: group.items.map((item, itemIndex) => ({
      ...item,
      sortOrder: itemIndex
    }))
  }));

const formatQuantity = (value: number) => quantityFormatter.format(value);
const formatDayLabel = (day: number, month: number) =>
  `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`;

const getCellQuantity = (item: BoardItem, day: number, shiftKey: string) =>
  item.dailyTotals.find((cell) => cell.day === day && cell.shiftKey === shiftKey)?.quantity ?? 0;

export function IngredientStockPageContent() {
  const session = getSession();
  const queryClient = useQueryClient();
  const isAdmin = session?.user.role === 'ADMIN';
  const baseStoreId = session?.user.store?.id ?? '';
  const [selectedYear, setSelectedYear] = useState(Number(defaultYearString));
  const [selectedMonth, setSelectedMonth] = useState(Number(defaultMonthString));
  const [selectedStoreId, setSelectedStoreId] = useState(baseStoreId);
  const [operationType, setOperationType] = useState<OperationType>('STORE_USAGE');
  const [editorState, setEditorState] = useState<EditableState | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedGroupFilterId, setSelectedGroupFilterId] = useState('all');
  const [focusedIngredientId, setFocusedIngredientId] = useState('all');
  const [expandedIngredientId, setExpandedIngredientId] = useState<string | null>(null);
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [showAllDaysOnMobile, setShowAllDaysOnMobile] = useState(false);
  const [groupToAdd, setGroupToAdd] = useState('');
  const [ingredientToAddByGroup, setIngredientToAddByGroup] = useState<Record<string, string>>({});

  const storesQuery = useQuery({
    queryKey: ['stores-selector-for-ingredient-stock'],
    queryFn: () => listStores(''),
    enabled: isAdmin
  });

  const stores = useMemo(
    () => ((storesQuery.data?.data ?? []) as Array<{ id: string; name: string }>),
    [storesQuery.data]
  );

  useEffect(() => {
    if (!isAdmin) {
      setSelectedStoreId(baseStoreId);
      return;
    }

    if (selectedStoreId) return;
    if (baseStoreId) {
      setSelectedStoreId(baseStoreId);
      return;
    }

    if (stores.length > 0) {
      setSelectedStoreId(stores[0].id);
    }
  }, [baseStoreId, isAdmin, selectedStoreId, stores]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const syncViewport = () => setIsMobile(mediaQuery.matches);
    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);

    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  const activeStoreId = isAdmin ? selectedStoreId : baseStoreId;

  const boardQuery = useQuery({
    queryKey: ['ingredient-stock-board', activeStoreId, selectedYear, selectedMonth, operationType],
    queryFn: () =>
      getIngredientStockBoard({
        storeId: activeStoreId || undefined,
        year: selectedYear,
        month: selectedMonth,
        operationType
      }) as Promise<BoardPayload>,
    enabled: Boolean(activeStoreId)
  });

  useEffect(() => {
    setEditorState(buildEditorState(boardQuery.data));
  }, [boardQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (state: EditableState) =>
      saveIngredientStockLayout({
        storeId: activeStoreId || undefined,
        operationType,
        groups: normalizeGroups(state.groups).map((group) => ({
          groupId: group.groupId,
          sortOrder: group.sortOrder,
          items: group.items.map((item, itemIndex) => ({
            ingredientId: item.ingredientId,
            sortOrder: itemIndex
          }))
        }))
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['ingredient-stock-board', activeStoreId, selectedYear, selectedMonth, operationType]
      });
      await boardQuery.refetch();
    }
  });

  const totalDays =
    boardQuery.data?.daysInMonth ?? new Date(selectedYear, selectedMonth, 0).getDate();
  const days = useMemo(() => Array.from({ length: totalDays }, (_, index) => index + 1), [totalDays]);
  const shifts = boardQuery.data?.shifts ?? [];
  const canEdit = Boolean(boardQuery.data?.canEdit && editorState);
  const lowStockThreshold = boardQuery.data?.lowStockThreshold ?? 2;
  const summary = boardQuery.data?.summary;
  const ingredientOptions = boardQuery.data?.options.ingredients ?? [];
  const groupOptions = boardQuery.data?.options.groups ?? [];

  const updateEditorState = (updater: (draft: EditableState) => EditableState) => {
    setEditorState((current) => (current ? updater(current) : current));
  };

  const configuredIngredientIds = useMemo(
    () =>
      new Set(
        editorState?.groups.flatMap((group) => group.items.map((item) => item.ingredientId)) ?? []
      ),
    [editorState]
  );

  const availableGroups = useMemo(() => {
    const existingGroupIds = new Set(editorState?.groups.map((group) => group.groupId) ?? []);
    return groupOptions.filter((group) => !existingGroupIds.has(group.id));
  }, [editorState, groupOptions]);

  useEffect(() => {
    if (!availableGroups.length) {
      setGroupToAdd('');
      return;
    }

    if (!groupToAdd || !availableGroups.some((group) => group.id === groupToAdd)) {
      setGroupToAdd(availableGroups[0].id);
    }
  }, [availableGroups, groupToAdd]);

  const boardGroupFilters = useMemo(
    () =>
      (editorState?.groups ?? []).map((group) => ({
        id: group.groupId,
        name: group.groupName,
        ingredientCount: group.items.length
      })),
    [editorState]
  );

  useEffect(() => {
    if (
      selectedGroupFilterId !== 'all' &&
      !boardGroupFilters.some((group) => group.id === selectedGroupFilterId)
    ) {
      setSelectedGroupFilterId('all');
    }
  }, [boardGroupFilters, selectedGroupFilterId]);

  const ingredientFilterOptions = useMemo(() => {
    const groups = editorState?.groups ?? [];
    const scopedGroups =
      selectedGroupFilterId === 'all'
        ? groups
        : groups.filter((group) => group.groupId === selectedGroupFilterId);

    return scopedGroups.flatMap((group) =>
      group.items.map((item) => ({
        ingredientId: item.ingredientId,
        ingredientName: item.ingredientName,
        ingredientCode: item.ingredientCode,
        unit: item.unit,
        groupId: group.groupId,
        groupName: group.groupName,
        totalRemainingQty: item.totalRemainingQty
      }))
    );
  }, [editorState, selectedGroupFilterId]);

  useEffect(() => {
    if (
      focusedIngredientId !== 'all' &&
      !ingredientFilterOptions.some((item) => item.ingredientId === focusedIngredientId)
    ) {
      setFocusedIngredientId('all');
    }
  }, [focusedIngredientId, ingredientFilterOptions]);

  const filteredGroups = useMemo(() => {
    let groups = editorState?.groups ?? [];

    if (selectedGroupFilterId !== 'all') {
      groups = groups.filter((group) => group.groupId === selectedGroupFilterId);
    }

    if (focusedIngredientId !== 'all') {
      groups = groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => item.ingredientId === focusedIngredientId)
        }))
        .filter((group) => group.items.length > 0);
    }

    if (showLowStockOnly) {
      groups = groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => item.totalRemainingQty < lowStockThreshold)
        }))
        .filter((group) => group.items.length > 0);
    }

    return groups;
  }, [editorState, focusedIngredientId, lowStockThreshold, selectedGroupFilterId, showLowStockOnly]);

  const flatVisibleItems = useMemo(
    () => filteredGroups.flatMap((group) => group.items),
    [filteredGroups]
  );

  useEffect(() => {
    if (!flatVisibleItems.length) {
      setExpandedIngredientId(null);
      return;
    }

    if (!isMobile) {
      setExpandedIngredientId(null);
      return;
    }

    if (focusedIngredientId !== 'all') {
      setExpandedIngredientId(focusedIngredientId);
      return;
    }

    if (
      expandedIngredientId &&
      !flatVisibleItems.some((item) => item.ingredientId === expandedIngredientId)
    ) {
      setExpandedIngredientId(null);
    }
  }, [expandedIngredientId, flatVisibleItems, focusedIngredientId, isMobile]);

  const visibleGroups = filteredGroups;

  const mobileVisibleItems = useMemo(
    () =>
      visibleGroups.flatMap((group) =>
        group.items.map((item) => {
          const activeDays = days.filter((day) =>
            shifts.some((shift) => getCellQuantity(item, day, shift.key) > 0)
          );

          return {
            ...item,
            groupName: group.groupName,
            activeDays,
            renderedDays: showAllDaysOnMobile ? days : activeDays,
            totalScannedQty: item.dailyTotals.reduce((total, cell) => total + cell.quantity, 0)
          };
        })
      ),
    [days, shifts, showAllDaysOnMobile, visibleGroups]
  );

  const storeName =
    boardQuery.data?.store.name ??
    stores.find((store) => store.id === activeStoreId)?.name ??
    session?.user.store?.name ??
    '-';

  const handleAddGroup = () => {
    const selectedGroup = availableGroups.find((group) => group.id === groupToAdd);
    if (!selectedGroup) return;

    updateEditorState((state) => ({
      ...state,
      groups: [
        ...state.groups,
        {
          groupId: selectedGroup.id,
          groupName: selectedGroup.name,
          sortOrder: state.groups.length,
          items: []
        }
      ]
    }));
  };

  const handleAddIngredient = (groupId: string) => {
    const ingredientId = ingredientToAddByGroup[groupId];
    if (!ingredientId) return;

    const ingredient = ingredientOptions.find((item) => item.id === ingredientId);
    if (!ingredient) return;

    updateEditorState((state) => ({
      ...state,
      groups: state.groups.map((group) =>
        group.groupId === groupId
          ? {
              ...group,
              items: [
                ...group.items,
                {
                  ingredientId: ingredient.id,
                  ingredientCode: ingredient.code,
                  ingredientName: ingredient.name,
                  unit: ingredient.unit,
                  totalRemainingQty: ingredient.totalRemainingQty,
                  dailyTotals: []
                }
              ]
            }
          : group
      )
    }));

    setIngredientToAddByGroup((current) => ({ ...current, [groupId]: '' }));
  };

  const handleSave = () => {
    if (!editorState) return;
    saveMutation.mutate(editorState);
  };

  return (
    <ProtectedPage title="Kho nguyên liệu" allowedRoles={['ADMIN', 'MANAGER', 'STAFF']} wide>
      <div className="space-y-4">
        <Card className="overflow-hidden border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-slate-50 p-0">
          <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold text-brand-900">
                  Kho nguyên liệu tháng {selectedMonth}/{selectedYear}
                </h2>
                <Badge
                  label={operationType === 'TRANSFER' ? 'Chuyển kho' : 'Sử dụng tại quán'}
                  tone={operationType === 'TRANSFER' ? 'warning' : 'success'}
                />
                {showLowStockOnly ? (
                  <Badge label={`Đang lọc tồn < ${lowStockThreshold}`} tone="danger" />
                ) : null}
              </div>
              <p className="text-sm text-slate-600">
                Chi nhánh: <span className="font-semibold text-brand-900">{storeName}</span>
              </p>
              <p className="max-w-3xl text-sm text-slate-600">
                Dữ liệu từng ô được lấy tự động từ lịch sử quét hợp lệ. Khi quét nguyên liệu tại
                quán hoặc chuyển kho, số lượng ở đúng ngày và ca sẽ tự tăng, còn tồn kho tổng sẽ tự
                giảm hoặc cộng theo chi nhánh.
              </p>
            </div>

            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <Button
                variant="secondary"
                fullWidth={isMobile}
                onClick={() => setIsConfigOpen((current) => !current)}
              >
                {isConfigOpen ? 'Ẩn cấu hình' : 'Cấu hình'}
              </Button>
              <Button
                variant="secondary"
                fullWidth={isMobile}
                onClick={() => boardQuery.refetch()}
                disabled={boardQuery.isFetching}
              >
                {boardQuery.isFetching ? 'Đang tải lại...' : 'Tải lại'}
              </Button>
              {canEdit ? (
                <Button fullWidth={isMobile} onClick={handleSave} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Đang lưu...' : 'Lưu bố cục'}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 border-t border-brand-100 bg-white/80 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-brand-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-brand-700">Nhóm hiển thị</p>
              <p className="mt-2 text-2xl font-semibold text-brand-900">
                {summary?.groupCount ?? 0}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-brand-100">
              <p className="text-xs uppercase tracking-[0.18em] text-brand-700">
                Nguyên liệu hiển thị
              </p>
              <p className="mt-2 text-2xl font-semibold text-brand-900">
                {summary?.ingredientCount ?? 0}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-brand-100">
              <p className="text-xs uppercase tracking-[0.18em] text-brand-700">Cảnh báo tồn thấp</p>
              <p className="mt-2 text-2xl font-semibold text-brand-900">
                {summary?.lowStockCount ?? 0}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-brand-100">
              <p className="text-xs uppercase tracking-[0.18em] text-brand-700">Quyền truy cập</p>
              <p className="mt-2 text-lg font-semibold text-brand-900">
                {localizeRole(session?.user.role ?? 'STAFF')}
              </p>
            </div>
          </div>
        </Card>
        {boardQuery.data?.alerts.length ? (
          <Card className="border border-amber-200 bg-amber-50">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-amber-900">
                  Có {boardQuery.data.alerts.length} nguyên liệu tồn thấp
                </h3>
                <p className="text-sm text-amber-800">
                  Những nguyên liệu có tồn dưới {lowStockThreshold} sẽ được làm nổi bật để bạn dễ
                  lọc và theo dõi.
                </p>
                <div className="flex flex-wrap gap-2">
                  {boardQuery.data.alerts.slice(0, 6).map((alert) => (
                    <Badge
                      key={alert.ingredientId}
                      label={`${alert.ingredientName}: ${formatQuantity(alert.totalRemainingQty)} ${alert.unit}`}
                      tone="warning"
                    />
                  ))}
                </div>
              </div>
              <Button
                variant="secondary"
                onClick={() => setShowLowStockOnly((current) => !current)}
              >
                {showLowStockOnly ? 'Hiện toàn bộ' : 'Xem thêm'}
              </Button>
            </div>
          </Card>
        ) : null}

        {saveMutation.isError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {(saveMutation.error as Error).message}
          </p>
        ) : null}

        {boardQuery.isError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {(boardQuery.error as Error).message}
          </p>
        ) : null}

        <Card className="space-y-4 border border-brand-100 bg-white">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-brand-900">Bộ lọc quan sát</h3>
              <p className="text-sm text-slate-500">
                Chọn loại nguyên liệu hoặc nguyên liệu cụ thể để bảng gọn hơn và dễ quan sát hơn.
              </p>
            </div>
            <Badge label={`${flatVisibleItems.length} nguyên liệu đang hiển thị`} tone="neutral" />
          </div>

          <div className="grid gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Loại nguyên liệu</span>
              <select
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
                value={selectedGroupFilterId}
                onChange={(event) => {
                  setSelectedGroupFilterId(event.target.value);
                  setFocusedIngredientId('all');
                  setExpandedIngredientId(null);
                }}
              >
                <option value="all">Tất cả loại nguyên liệu</option>
                {boardGroupFilters.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name} ({group.ingredientCount})
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Nguyên liệu</span>
              <select
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
                value={focusedIngredientId}
                onChange={(event) => {
                  setFocusedIngredientId(event.target.value);
                  setExpandedIngredientId(event.target.value === 'all' ? null : event.target.value);
                }}
              >
                <option value="all">
                  {selectedGroupFilterId === 'all'
                    ? 'Tất cả nguyên liệu'
                    : 'Hiện tất cả nguyên liệu của loại đã chọn'}
                </option>
                {ingredientFilterOptions.map((item) => (
                  <option key={item.ingredientId} value={item.ingredientId}>
                    {item.ingredientName} ({item.ingredientCode})
                  </option>
                ))}
              </select>
            </label>

            {isMobile ? (
              <div className="space-y-2">
                <span className="text-sm font-medium text-brand-900">Hiển thị ngày trên mobile</span>
                <Button
                  type="button"
                  variant={showAllDaysOnMobile ? 'primary' : 'secondary'}
                  fullWidth
                  onClick={() => setShowAllDaysOnMobile((current) => !current)}
                >
                  {showAllDaysOnMobile ? 'Chỉ xem ngày có phát sinh' : 'Hiện đủ ngày trong tháng'}
                </Button>
              </div>
            ) : (
              <div className="rounded-2xl bg-brand-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-brand-700">Mẹo quan sát</p>
                <p className="mt-2 text-sm text-brand-900">
                  Khi chọn một loại nguyên liệu, bảng desktop sẽ gọn hơn rất nhiều và dễ đọc hơn.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2 lg:justify-end">
              <Button
                type="button"
                variant={showLowStockOnly ? 'primary' : 'secondary'}
                onClick={() => setShowLowStockOnly((current) => !current)}
              >
                {showLowStockOnly ? 'Bỏ lọc tồn thấp' : 'Chỉ xem tồn thấp'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSelectedGroupFilterId('all');
                  setFocusedIngredientId('all');
                  setExpandedIngredientId(null);
                  setShowLowStockOnly(false);
                }}
              >
                Xóa bộ lọc
              </Button>
            </div>
          </div>
        </Card>

        {editorState && isConfigOpen ? (
          <Card className="space-y-4 border border-brand-100 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-brand-900">Cấu hình</h3>
                <p className="text-sm text-slate-500">
                  Chọn tháng, năm, chi nhánh, phạm vi và sắp xếp nhóm nguyên liệu theo ý.
                </p>
              </div>
              <Badge
                label={boardQuery.data?.canEdit ? 'Có thể chỉnh sửa' : 'Chỉ xem'}
                tone={boardQuery.data?.canEdit ? 'success' : 'neutral'}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(300px,400px),minmax(0,1fr)]">
              <Card className="space-y-4 border border-brand-100 bg-brand-50/40">
                <div>
                  <h4 className="text-lg font-semibold text-brand-900">Bộ lọc kho nguyên liệu</h4>
                  <p className="text-sm text-slate-500">
                    Số ngày tự đổi theo tháng, các cột ca giữ cố định theo hệ thống.
                  </p>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-brand-900">Tháng</span>
                  <select
                    className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3"
                    value={selectedMonth}
                    onChange={(event) => setSelectedMonth(Number(event.target.value))}
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                      <option key={month} value={month}>
                        Tháng {month}
                      </option>
                    ))}
                  </select>
                </label>

                <Input
                  label="Năm"
                  type="number"
                  min={2020}
                  max={2100}
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(Number(event.target.value))}
                />

                {isAdmin ? (
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-brand-900">Chi nhánh</span>
                    <select
                      className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3"
                      value={selectedStoreId}
                      onChange={(event) => setSelectedStoreId(event.target.value)}
                    >
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="rounded-2xl border border-brand-100 bg-white px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-brand-700">Chi nhánh</p>
                    <p className="mt-2 text-sm font-semibold text-brand-900">{storeName}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <span className="text-sm font-medium text-brand-900">Phạm vi sử dụng</span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      fullWidth
                      variant={operationType === 'STORE_USAGE' ? 'primary' : 'secondary'}
                      onClick={() => setOperationType('STORE_USAGE')}
                    >
                      Sử dụng tại quán
                    </Button>
                    <Button
                      type="button"
                      fullWidth
                      variant={operationType === 'TRANSFER' ? 'primary' : 'secondary'}
                      onClick={() => setOperationType('TRANSFER')}
                    >
                      Chuyển kho
                    </Button>
                  </div>
                </div>

                <div className="rounded-2xl border border-brand-100 bg-white px-4 py-4 text-sm text-slate-600">
                  <p className="font-semibold text-brand-900">Ca áp dụng trong bảng</p>
                  <div className="mt-2 space-y-1">
                    {shifts.map((shift) => (
                      <p key={shift.key}>
                        {shift.name}: {shift.startTime} - {shift.endTime}
                      </p>
                    ))}
                  </div>
                </div>
              </Card>

              <Card className="space-y-4 border border-brand-100 bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-brand-900">Bố cục hiển thị</h4>
                    <p className="text-sm text-slate-500">
                      Chọn nhóm nguyên liệu rồi thêm các nguyên liệu thuộc đúng nhóm đó vào bảng.
                    </p>
                  </div>

                  {boardQuery.data?.canEdit ? (
                    <div className="flex flex-wrap gap-2">
                      <select
                        className="rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
                        value={groupToAdd}
                        onChange={(event) => setGroupToAdd(event.target.value)}
                      >
                        {availableGroups.length ? (
                          availableGroups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))
                        ) : (
                          <option value="">Không còn nhóm để thêm</option>
                        )}
                      </select>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleAddGroup}
                        disabled={!availableGroups.length}
                      >
                        Thêm nhóm
                      </Button>
                    </div>
                  ) : null}
                </div>

                {editorState.groups.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-brand-100 bg-brand-50 p-6 text-sm text-brand-700">
                    Chưa có nhóm nào trong bố cục. Hãy thêm nhóm nguyên liệu để bắt đầu hiển thị bảng.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {editorState.groups.map((group, groupIndex) => {
                      const availableIngredients = ingredientOptions.filter(
                        (ingredient) =>
                          ingredient.groupId === group.groupId &&
                          !configuredIngredientIds.has(ingredient.id)
                      );
                      const selectedIngredientToAdd =
                        ingredientToAddByGroup[group.groupId] ??
                        availableIngredients[0]?.id ??
                        '';

                      return (
                        <div
                          key={group.groupId}
                          className="rounded-3xl border border-brand-100 bg-brand-50/40 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h5 className="text-lg font-semibold text-brand-900">
                                {group.groupName}
                              </h5>
                              <p className="text-sm text-slate-500">
                                {group.items.length} nguyên liệu trong nhóm này.
                              </p>
                            </div>

                            {boardQuery.data?.canEdit ? (
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() =>
                                    updateEditorState((state) => {
                                      if (groupIndex === 0) return state;
                                      const next = [...state.groups];
                                      [next[groupIndex - 1], next[groupIndex]] = [
                                        next[groupIndex],
                                        next[groupIndex - 1]
                                      ];
                                      return { ...state, groups: normalizeGroups(next) as BoardGroup[] };
                                    })
                                  }
                                  disabled={groupIndex === 0}
                                >
                                  Lên
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() =>
                                    updateEditorState((state) => {
                                      if (groupIndex === state.groups.length - 1) return state;
                                      const next = [...state.groups];
                                      [next[groupIndex + 1], next[groupIndex]] = [
                                        next[groupIndex],
                                        next[groupIndex + 1]
                                      ];
                                      return { ...state, groups: normalizeGroups(next) as BoardGroup[] };
                                    })
                                  }
                                  disabled={groupIndex === editorState.groups.length - 1}
                                >
                                  Xuống
                                </Button>
                                <Button
                                  type="button"
                                  variant="danger"
                                  onClick={() =>
                                    updateEditorState((state) => ({
                                      ...state,
                                      groups: normalizeGroups(
                                        state.groups.filter((item) => item.groupId !== group.groupId)
                                      ) as BoardGroup[]
                                    }))
                                  }
                                >
                                  Xóa nhóm
                                </Button>
                              </div>
                            ) : null}
                          </div>
                          <div className="mt-4 space-y-3">
                            {group.items.length ? (
                              group.items.map((item, itemIndex) => (
                                <div
                                  key={item.ingredientId}
                                  className="flex flex-col gap-3 rounded-2xl border border-brand-100 bg-white px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                                >
                                  <div>
                                    <p className="font-semibold text-brand-900">
                                      {item.ingredientName}
                                    </p>
                                    <p className="text-sm text-slate-500">
                                      {item.ingredientCode} • {item.unit} • Tồn hiện tại:{' '}
                                      {formatQuantity(item.totalRemainingQty)}
                                    </p>
                                  </div>
                                  {boardQuery.data?.canEdit ? (
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() =>
                                          updateEditorState((state) => {
                                            const nextGroups = state.groups.map((currentGroup) => {
                                              if (currentGroup.groupId !== group.groupId || itemIndex === 0) {
                                                return currentGroup;
                                              }
                                              const nextItems = [...currentGroup.items];
                                              [nextItems[itemIndex - 1], nextItems[itemIndex]] = [
                                                nextItems[itemIndex],
                                                nextItems[itemIndex - 1]
                                              ];
                                              return { ...currentGroup, items: nextItems };
                                            });
                                            return { ...state, groups: nextGroups };
                                          })
                                        }
                                        disabled={itemIndex === 0}
                                      >
                                        Lên
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        onClick={() =>
                                          updateEditorState((state) => {
                                            const nextGroups = state.groups.map((currentGroup) => {
                                              if (
                                                currentGroup.groupId !== group.groupId ||
                                                itemIndex === currentGroup.items.length - 1
                                              ) {
                                                return currentGroup;
                                              }
                                              const nextItems = [...currentGroup.items];
                                              [nextItems[itemIndex + 1], nextItems[itemIndex]] = [
                                                nextItems[itemIndex],
                                                nextItems[itemIndex + 1]
                                              ];
                                              return { ...currentGroup, items: nextItems };
                                            });
                                            return { ...state, groups: nextGroups };
                                          })
                                        }
                                        disabled={itemIndex === group.items.length - 1}
                                      >
                                        Xuống
                                      </Button>
                                      <Button
                                        type="button"
                                        variant="danger"
                                        onClick={() =>
                                          updateEditorState((state) => ({
                                            ...state,
                                            groups: state.groups.map((currentGroup) =>
                                              currentGroup.groupId === group.groupId
                                                ? {
                                                    ...currentGroup,
                                                    items: currentGroup.items.filter(
                                                      (currentItem) =>
                                                        currentItem.ingredientId !== item.ingredientId
                                                    )
                                                  }
                                                : currentGroup
                                            )
                                          }))
                                        }
                                      >
                                        Bỏ khỏi bảng
                                      </Button>
                                    </div>
                                  ) : null}
                                </div>
                              ))
                            ) : (
                              <div className="rounded-2xl border border-dashed border-brand-100 bg-white px-4 py-4 text-sm text-slate-500">
                                Nhóm này chưa có nguyên liệu nào trong bảng.
                              </div>
                            )}

                            {boardQuery.data?.canEdit ? (
                              <div className="flex flex-col gap-2 rounded-2xl border border-brand-100 bg-white px-4 py-4 lg:flex-row">
                                <select
                                  className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
                                  value={selectedIngredientToAdd}
                                  onChange={(event) =>
                                    setIngredientToAddByGroup((current) => ({
                                      ...current,
                                      [group.groupId]: event.target.value
                                    }))
                                  }
                                >
                                  {availableIngredients.length ? (
                                    availableIngredients.map((ingredient) => (
                                      <option key={ingredient.id} value={ingredient.id}>
                                        {ingredient.name} ({ingredient.code})
                                      </option>
                                    ))
                                  ) : (
                                    <option value="">Không còn nguyên liệu để thêm</option>
                                  )}
                                </select>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  onClick={() => handleAddIngredient(group.groupId)}
                                  disabled={!availableIngredients.length}
                                >
                                  Thêm nguyên liệu
                                </Button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            <Card className="space-y-3 border border-brand-100 bg-brand-50/50">
              <h4 className="text-lg font-semibold text-brand-900">Quy ước hiển thị</h4>
              <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                <p>Mỗi ô là tổng số lượng đã quét trong đúng ngày và đúng ca.</p>
                <p>Số lượng tồn là tổng tồn của tất cả lô còn lại tại chi nhánh đang chọn.</p>
                <p>Bấm “Xem thêm” để lọc riêng những nguyên liệu tồn thấp.</p>
                <p>Phạm vi “Chuyển kho” thể hiện lượng xuất khỏi chi nhánh đang chọn.</p>
              </div>
            </Card>

          </Card>
        ) : null}

        <Card className="space-y-4 overflow-hidden border border-brand-100 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-brand-900">
                Kho nguyên liệu tháng {selectedMonth}/{selectedYear}
              </h2>
              <p className="text-sm text-slate-500">
                Chi nhánh: <span className="font-medium text-brand-900">{storeName}</span>
              </p>
            </div>
            <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              <p className="font-semibold">Nguyên liệu đang hiển thị</p>
              <p className="mt-1 text-2xl font-semibold text-brand-900">{flatVisibleItems.length}</p>
            </div>
          </div>

          {boardQuery.isPending || !editorState ? (
            <div className="rounded-2xl border border-dashed border-brand-100 bg-brand-50 p-8 text-center text-sm text-brand-700">
              Đang tải kho nguyên liệu...
            </div>
          ) : visibleGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-brand-100 bg-brand-50 p-8 text-center text-sm text-brand-700">
              Không có nguyên liệu nào phù hợp với bộ lọc hiện tại.
            </div>
          ) : isMobile ? (
            <div className="space-y-3">
              {mobileVisibleItems.map((item) => {
                const isExpanded = expandedIngredientId === item.ingredientId;
                const previewDays = item.activeDays.slice(0, 3);

                return (
                  <Card
                    key={item.ingredientId}
                    className="overflow-hidden border border-brand-100 bg-white p-0"
                  >
                    <button
                      type="button"
                      className="w-full px-4 py-3 text-left"
                      onClick={() =>
                        setExpandedIngredientId((current) =>
                          current === item.ingredientId ? null : item.ingredientId
                        )
                      }
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <Badge label={item.groupName} tone="neutral" />
                            {item.totalRemainingQty < lowStockThreshold ? (
                              <Badge label={`Tồn < ${lowStockThreshold}`} tone="danger" />
                            ) : null}
                          </div>
                          <div>
                            <h3 className="truncate text-base font-semibold text-brand-900">
                              {item.ingredientName}
                            </h3>
                            <p className="truncate text-xs text-slate-500">
                              {item.ingredientCode} • {item.unit}
                            </p>
                          </div>
                        </div>

                        <div
                          className={clsx(
                            'min-w-[92px] rounded-2xl px-3 py-2 text-right',
                            item.totalRemainingQty < lowStockThreshold
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-brand-50 text-brand-900'
                          )}
                        >
                          <p className="text-[11px] uppercase tracking-[0.12em]">Tồn</p>
                          <p className="mt-1 text-lg font-semibold">
                            {formatQuantity(item.totalRemainingQty)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className="rounded-2xl bg-brand-50 px-3 py-2 text-center">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-brand-700">
                            Ngày quét
                          </p>
                          <p className="mt-1 text-sm font-semibold text-brand-900">
                            {item.activeDays.length}/{days.length}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white px-3 py-2 text-center ring-1 ring-brand-100">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-brand-700">
                            Tổng quét
                          </p>
                          <p className="mt-1 text-sm font-semibold text-brand-900">
                            {formatQuantity(item.totalScannedQty)}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white px-3 py-2 text-center ring-1 ring-brand-100">
                          <p className="text-[11px] uppercase tracking-[0.12em] text-brand-700">
                            Chi tiết
                          </p>
                          <p className="mt-1 text-sm font-semibold text-brand-900">
                            {isExpanded ? 'Đang mở' : 'Chạm để xem'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                        {previewDays.length ? (
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            Ngày có phát sinh: {previewDays.map((day) => formatDayLabel(day, selectedMonth)).join(', ')}
                            {item.activeDays.length > previewDays.length
                              ? ` +${item.activeDays.length - previewDays.length}`
                              : ''}
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-3 py-1">
                            Chưa có phát sinh trong tháng
                          </span>
                        )}
                      </div>
                    </button>

                    {isExpanded ? (
                      <div className="border-t border-brand-100 bg-gradient-to-b from-white to-brand-50/30 px-4 py-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-brand-900">Chi tiết ngày / ca</p>
                            <p className="text-xs text-slate-500">
                              {showAllDaysOnMobile
                                ? 'Đang hiển thị toàn bộ ngày trong tháng.'
                                : 'Đang hiển thị các ngày có phát sinh.'}
                            </p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-brand-800 ring-1 ring-brand-100">
                            {showAllDaysOnMobile ? 'Đủ ngày' : 'Ngày có phát sinh'}
                          </span>
                        </div>

                        {item.renderedDays.length ? (
                          <div className="space-y-2">
                            {item.renderedDays.map((day) => {
                              const dayHasValue = shifts.some(
                                (shift) => getCellQuantity(item, day, shift.key) > 0
                              );

                              return (
                                <div
                                  key={`${item.ingredientId}-${day}`}
                                  className={clsx(
                                    'rounded-2xl border px-3 py-3',
                                    dayHasValue
                                      ? 'border-brand-200 bg-brand-50/60'
                                      : 'border-brand-100 bg-slate-50'
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="font-semibold text-brand-900">
                                        Ngày {formatDayLabel(day, selectedMonth)}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {dayHasValue
                                          ? 'Đã có quét nguyên liệu trong ngày này'
                                          : 'Chưa có phát sinh quét trong ngày này'}
                                      </p>
                                    </div>
                                    <Badge
                                      label={dayHasValue ? 'Có phát sinh' : 'Chưa phát sinh'}
                                      tone={dayHasValue ? 'success' : 'neutral'}
                                    />
                                  </div>

                                  <div className="mt-3 grid grid-cols-3 gap-2">
                                    {shifts.map((shift) => {
                                      const quantity = getCellQuantity(item, day, shift.key);
                                      const hasValue = quantity > 0;

                                      return (
                                        <div
                                          key={`${item.ingredientId}-${day}-${shift.key}-mobile`}
                                          className={clsx(
                                            'rounded-2xl px-2 py-3 text-center',
                                            hasValue
                                              ? 'bg-white text-brand-900 ring-1 ring-brand-200'
                                              : 'bg-white/70 text-slate-400 ring-1 ring-slate-200'
                                          )}
                                        >
                                          <p className="text-xs font-semibold uppercase tracking-[0.14em]">
                                            {shift.code}
                                          </p>
                                          <p className="mt-2 text-sm font-semibold">
                                            {hasValue ? formatQuantity(quantity) : '-'}
                                          </p>
                                          <p className="mt-1 text-[11px]">
                                            {shift.startTime} - {shift.endTime}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-brand-100 bg-brand-50 px-4 py-4 text-sm text-brand-700">
                            Chưa có phát sinh nào trong tháng này. Bật hiển thị đủ ngày nếu bạn muốn
                            xem toàn bộ lịch ca.
                          </div>
                        )}
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="overflow-auto rounded-3xl border border-brand-100 bg-white shadow-sm">
              <table className="min-w-max border-separate border-spacing-0 text-sm text-slate-800">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th rowSpan={3} className={clsx('min-w-[160px] border border-brand-100 bg-brand-900 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-white', !isMobile && 'sticky left-0 z-30')}>
                      Loại nguyên liệu
                    </th>
                    <th rowSpan={3} className={clsx('min-w-[260px] border border-brand-100 bg-brand-900 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-white', !isMobile && 'sticky left-[160px] z-30')}>
                      Tên nguyên liệu
                    </th>
                    <th rowSpan={3} className={clsx('min-w-[140px] border border-brand-100 bg-brand-900 px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-white', !isMobile && 'sticky left-[420px] z-30')}>
                      Số lượng tồn
                    </th>
                    <th rowSpan={3} className={clsx('min-w-[110px] border border-brand-100 bg-brand-900 px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-white', !isMobile && 'sticky left-[560px] z-30')}>
                      Đơn vị
                    </th>
                    <th colSpan={days.length * shifts.length} className="border border-brand-100 bg-brand-900 px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-white">
                      Ngày trong tháng
                    </th>
                  </tr>
                  <tr>
                    {days.map((day) => (
                      <th key={`day-${day}`} colSpan={Math.max(shifts.length, 1)} className="border border-brand-100 bg-brand-700 px-2 py-3 text-center text-xs font-semibold text-white">
                        {String(day).padStart(2, '0')}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {days.flatMap((day) =>
                      shifts.map((shift) => (
                        <th key={`shift-${day}-${shift.key}`} className="border border-brand-100 bg-brand-50 px-2 py-3 text-center text-xs font-semibold text-brand-900">
                          {shift.code}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visibleGroups.map((group, groupIndex) => {
                    const surfaceClass = groupIndex % 2 === 0 ? 'bg-white' : 'bg-[#f8faf7]';
                    return (
                      <Fragment key={group.groupId}>
                        {group.items.map((item, itemIndex) => (
                          <tr key={`${group.groupId}-${item.ingredientId}`}>
                            {itemIndex === 0 ? (
                              <td rowSpan={group.items.length} className={clsx('border border-brand-100 px-3 py-3 align-top font-semibold text-brand-900', surfaceClass, !isMobile && 'sticky left-0 z-10')}>
                                <div className="space-y-1">
                                  <p>{group.groupName}</p>
                                  <p className="text-xs font-normal uppercase tracking-[0.14em] text-slate-500">
                                    {group.items.length} dòng
                                  </p>
                                </div>
                              </td>
                            ) : null}
                            <td className={clsx('border border-brand-100 px-3 py-3', surfaceClass, !isMobile && 'sticky left-[160px] z-10')}>
                              <div className="space-y-1">
                                <p className="font-semibold text-brand-900">{item.ingredientName}</p>
                                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                  {item.ingredientCode}
                                </p>
                              </div>
                            </td>
                            <td className={clsx('border border-brand-100 px-3 py-3 text-center font-semibold', item.totalRemainingQty < lowStockThreshold ? 'bg-rose-50 text-rose-700' : surfaceClass, !isMobile && 'sticky left-[420px] z-10')}>
                              {formatQuantity(item.totalRemainingQty)}
                            </td>
                            <td className={clsx('border border-brand-100 px-3 py-3 text-center text-slate-600', surfaceClass, !isMobile && 'sticky left-[560px] z-10')}>
                              {item.unit}
                            </td>
                            {days.flatMap((day) =>
                              shifts.map((shift) => {
                                const quantity = getCellQuantity(item, day, shift.key);
                                const hasValue = quantity > 0;
                                return (
                                  <td key={`${item.ingredientId}-${day}-${shift.key}`} className={clsx('border border-brand-100 px-2 py-3 text-center text-xs font-semibold', hasValue ? 'bg-brand-100 text-brand-900' : day % 2 === 0 ? 'bg-white text-slate-300' : 'bg-brand-50/40 text-slate-300')}>
                                    {hasValue ? formatQuantity(quantity) : ''}
                                  </td>
                                );
                              })
                            )}
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </ProtectedPage>
  );
}
