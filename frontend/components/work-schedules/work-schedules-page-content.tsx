"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Fragment, useEffect, useMemo, useState } from 'react';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getSession, Role } from '@/lib/auth';
import { listStores } from '@/services/admin/stores';
import { getWorkSchedule, saveWorkSchedule } from '@/services/work-schedules';

type WorkScheduleStatus = 'DRAFT' | 'PUBLISHED' | 'LOCKED';
type WorkEntryType = 'TRIAL' | 'OFFICIAL';

type WorkShift = {
  key: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  sortOrder: number;
};

type WorkEntry = {
  day: number;
  shiftKey: string;
  entryType: WorkEntryType;
};

type WorkEmployee = {
  userId: string;
  displayName: string;
  username: string;
  role: Role;
  sortOrder: number;
  trialHourlyRate: number;
  officialHourlyRate: number;
  entries: WorkEntry[];
  totals: {
    trialHours: number;
    officialHours: number;
    totalWorkingDays: number;
    totalSalary: number;
  };
};

type WorkSchedulePayload = {
  store: {
    id: string;
    code: string;
    name: string;
  };
  year: number;
  month: number;
  daysInMonth: number;
  weekendDays: number[];
  canEdit: boolean;
  schedule: {
    id: string | null;
    title: string;
    notes: string;
    status: WorkScheduleStatus;
    shifts: WorkShift[];
    employees: WorkEmployee[];
  };
};

type EditableEmployee = Omit<WorkEmployee, 'totals'>;

type EditableState = {
  title: string;
  notes: string;
  status: WorkScheduleStatus;
  shifts: WorkShift[];
  employees: EditableEmployee[];
};

const numberFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0
});

const todayInVietnam = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit'
}).format(new Date());

const [defaultYearString, defaultMonthString] = todayInVietnam.split('-');

const createShiftKey = () => `shift-${Math.random().toString(36).slice(2, 10)}`;

const buildWeekendDays = (year: number, month: number, totalDays: number) => {
  const weekendDays: number[] = [];
  for (let day = 1; day <= totalDays; day += 1) {
    if (new Date(year, month - 1, day).getDay() === 0) {
      weekendDays.push(day);
    }
  }
  return weekendDays;
};

const buildEditorState = (payload?: WorkSchedulePayload): EditableState | null => {
  if (!payload) {
    return null;
  }

  return {
    title: payload.schedule.title,
    notes: payload.schedule.notes,
    status: payload.schedule.status,
    shifts: payload.schedule.shifts.map((shift) => ({ ...shift })),
    employees: payload.schedule.employees.map((employee) => ({
      userId: employee.userId,
      displayName: employee.displayName,
      username: employee.username,
      role: employee.role,
      sortOrder: employee.sortOrder,
      trialHourlyRate: employee.trialHourlyRate,
      officialHourlyRate: employee.officialHourlyRate,
      entries: employee.entries.map((entry) => ({ ...entry }))
    }))
  };
};

const normalizeEmployeeOrdering = (employees: EditableEmployee[]) =>
  employees.map((employee, index) => ({
    ...employee,
    sortOrder: index
  }));

const normalizeShiftOrdering = (shifts: WorkShift[]) =>
  shifts.map((shift, index) => ({
    ...shift,
    sortOrder: index
  }));

const getEntryValue = (employee: EditableEmployee, shiftKey: string, day: number) =>
  employee.entries.find((entry) => entry.shiftKey === shiftKey && entry.day === day)?.entryType ?? null;

const upsertEntryValue = (
  employee: EditableEmployee,
  shiftKey: string,
  day: number,
  entryType: WorkEntryType | null
) => {
  const nextEntries = employee.entries.filter(
    (entry) => !(entry.shiftKey === shiftKey && entry.day === day)
  );

  if (entryType) {
    nextEntries.push({ shiftKey, day, entryType });
  }

  return nextEntries.sort(
    (left, right) => left.day - right.day || left.shiftKey.localeCompare(right.shiftKey)
  );
};

const cycleEntryType = (value: WorkEntryType | null): WorkEntryType | null => {
  if (!value) return 'OFFICIAL';
  if (value === 'OFFICIAL') return 'TRIAL';
  return null;
};

const computeEmployeeTotals = (employee: EditableEmployee, shifts: WorkShift[]) => {
  const shiftMap = new Map(shifts.map((shift) => [shift.key, shift]));
  let trialHours = 0;
  let officialHours = 0;
  const workedDays = new Set<number>();
  const dailyHours = new Map<number, number>();

  for (const entry of employee.entries) {
    const shift = shiftMap.get(entry.shiftKey);
    if (!shift) continue;

    workedDays.add(entry.day);
    dailyHours.set(entry.day, (dailyHours.get(entry.day) ?? 0) + shift.durationHours);

    if (entry.entryType === 'TRIAL') {
      trialHours += shift.durationHours;
    } else {
      officialHours += shift.durationHours;
    }
  }

  return {
    trialHours,
    officialHours,
    totalWorkingDays: workedDays.size,
    totalSalary: trialHours * employee.trialHourlyRate + officialHours * employee.officialHourlyRate,
    dailyHours
  };
};

const formatHours = (value: number) => numberFormatter.format(value);
const formatCurrency = (value: number) => currencyFormatter.format(value);

const roleLabels: Record<Role, string> = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  STAFF: 'Nhân viên'
};

const statusOptions: Array<{
  value: WorkScheduleStatus;
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}> = [
  { value: 'DRAFT', label: 'Nháp', tone: 'neutral' },
  { value: 'PUBLISHED', label: 'Đã công bố', tone: 'success' },
  { value: 'LOCKED', label: 'Đã chốt', tone: 'danger' }
];

const escapeCsvValue = (value: string | number) => {
  const normalized = String(value ?? '');
  if (/[",\r\n]/.test(normalized)) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }
  return normalized;
};

const downloadTextFile = (filename: string, content: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const sanitizeFilename = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-').trim();

const buildCsvContent = ({
  state,
  days,
  employees,
  storeName,
  selectedMonth,
  selectedYear
}: {
  state: EditableState;
  days: number[];
  employees: EditableEmployee[];
  storeName: string;
  selectedMonth: number;
  selectedYear: number;
}) => {
  const rows: Array<Array<string | number>> = [
    [state.title],
    ['Chi nhánh', storeName],
    ['Tháng', `${selectedMonth}/${selectedYear}`],
    []
  ];

  if (state.notes.trim()) {
    rows.push(['Ghi chú']);
    state.notes
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => rows.push([line]));
    rows.push([]);
  }

  rows.push([
    'STT',
    'Tên nhân viên',
    'Ca làm',
    ...days.map((day) => String(day).padStart(2, '0')),
    'Số giờ thử việc',
    'Số giờ chính thức',
    'Tổng số ngày làm việc',
    'Tổng lương'
  ]);

  employees.forEach((employee) => {
    const totals = computeEmployeeTotals(employee, state.shifts);

    state.shifts.forEach((shift) => {
      rows.push([
        employee.sortOrder + 1,
        `${employee.displayName} (${roleLabels[employee.role]})`,
        `${shift.name} (${shift.startTime} - ${shift.endTime})`,
        ...days.map((day) => {
          const value = getEntryValue(employee, shift.key, day);
          return value === 'OFFICIAL' ? 'C' : value === 'TRIAL' ? 'T' : '';
        }),
        '',
        '',
        '',
        ''
      ]);
    });

    rows.push([
      '',
      '',
      'Tổng cộng',
      ...days.map((day) =>
        totals.dailyHours.get(day) ? formatHours(totals.dailyHours.get(day) ?? 0) : '0'
      ),
      formatHours(totals.trialHours),
      formatHours(totals.officialHours),
      totals.totalWorkingDays,
      formatCurrency(totals.totalSalary)
    ]);

    rows.push([
      '',
      '',
      'Lương',
      ...Array.from({ length: days.length }, () => ''),
      formatCurrency(employee.trialHourlyRate),
      formatCurrency(employee.officialHourlyRate),
      '',
      formatCurrency(totals.totalSalary)
    ]);
  });

  return `\uFEFF${rows.map((row) => row.map(escapeCsvValue).join(',')).join('\r\n')}`;
};

const buildPrintHtml = ({
  state,
  days,
  weekendDays,
  employees,
  storeName
}: {
  state: EditableState;
  days: number[];
  weekendDays: number[];
  employees: EditableEmployee[];
  storeName: string;
}) => {
  const notesHtml = state.notes
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join('');

  const rowsHtml = employees
    .map((employee) => {
      const totals = computeEmployeeTotals(employee, state.shifts);
      const rowSpan = state.shifts.length + 2;

      const shiftRows = state.shifts
        .map(
          (shift, shiftIndex) => `
            <tr>
              ${
                shiftIndex === 0
                  ? `<td rowspan="${rowSpan}" class="sticky-col cell employee-order">${employee.sortOrder + 1}</td>
                     <td rowspan="${rowSpan}" class="sticky-col cell employee-name">
                       <div class="employee-title">${escapeHtml(employee.displayName)}</div>
                       <div class="employee-meta">${escapeHtml(roleLabels[employee.role])} • ${escapeHtml(employee.username)}</div>
                     </td>`
                  : ''
              }
              <td class="sticky-col cell shift-cell">
                <div class="shift-title">${escapeHtml(shift.name)}</div>
                <div class="shift-meta">${escapeHtml(shift.startTime)} - ${escapeHtml(shift.endTime)} • ${escapeHtml(formatHours(shift.durationHours))} giờ</div>
              </td>
              ${days
                .map((day) => {
                  const value = getEntryValue(employee, shift.key, day);
                  return `<td class="cell day-cell ${weekendDays.includes(day) ? 'weekend' : ''}">${value === 'OFFICIAL' ? 'C' : value === 'TRIAL' ? 'T' : ''}</td>`;
                })
                .join('')}
              <td class="cell summary-cell">-</td>
              <td class="cell summary-cell">-</td>
              <td class="cell summary-cell">-</td>
            </tr>
          `
        )
        .join('');

      const totalRow = `
        <tr class="total-row">
          <td class="cell total-label">Tổng cộng</td>
          ${days
            .map((day) => {
              const hours = totals.dailyHours.get(day);
              return `<td class="cell">${hours ? escapeHtml(formatHours(hours)) : '0'}</td>`;
            })
            .join('')}
          <td class="cell">${escapeHtml(formatHours(totals.trialHours))}</td>
          <td class="cell">${escapeHtml(formatHours(totals.officialHours))}</td>
          <td class="cell">${totals.totalWorkingDays}</td>
        </tr>
      `;

      const salaryRow = `
        <tr class="salary-row">
          <td class="cell salary-label">Lương</td>
          <td class="cell salary-note" colspan="${days.length}">Lương thử việc và chính thức được tính tự động theo đơn giá hiện tại.</td>
          <td class="cell">${escapeHtml(formatCurrency(employee.trialHourlyRate))}</td>
          <td class="cell">${escapeHtml(formatCurrency(employee.officialHourlyRate))}</td>
          <td class="cell salary-total">${escapeHtml(formatCurrency(totals.totalSalary))}</td>
        </tr>
      `;

      return `${shiftRows}${totalRow}${salaryRow}`;
    })
    .join('');

  return `
    <!doctype html>
    <html lang="vi">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(state.title)}</title>
        <style>
          @page { size: A3 landscape; margin: 10mm; }
          body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; }
          h1 { margin: 0 0 6px; font-size: 24px; }
          .meta { margin-bottom: 6px; font-size: 13px; }
          .notes { margin: 10px 0 16px; font-size: 13px; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #94a3b8; padding: 6px; text-align: center; }
          thead th { background: #1a2b21; color: #fff; }
          thead .subhead { background: #42634a; }
          thead .weekend { background: #fbbf24; color: #78350f; }
          .employee-order { background: #edf4ea; font-weight: 700; }
          .employee-name, .shift-cell { background: #f8fafc; text-align: left; }
          .employee-title, .shift-title { font-weight: 700; }
          .employee-meta, .shift-meta { font-size: 10px; color: #475569; margin-top: 4px; }
          .day-cell { min-width: 24px; }
          .day-cell.weekend { background: #fff7ed; }
          .summary-cell { background: #f8fafc; color: #94a3b8; }
          .total-row td { background: #edf4ea; font-weight: 700; }
          .salary-row td { background: #2d4635; color: #fff; }
          .salary-note { text-align: left; }
          .salary-total { font-size: 14px; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(state.title)}</h1>
        <div class="meta"><strong>Chi nhánh:</strong> ${escapeHtml(storeName)}</div>
        <div class="meta"><strong>Trạng thái:</strong> ${escapeHtml(statusOptions.find((option) => option.value === state.status)?.label ?? '')}</div>
        <div class="notes">${notesHtml}</div>
        <table>
          <thead>
            <tr>
              <th rowspan="2">STT</th>
              <th rowspan="2">Tên nhân viên</th>
              <th rowspan="2">Ca làm</th>
              <th colspan="${days.length}">Ngày làm</th>
              <th rowspan="2">Số giờ thử việc</th>
              <th rowspan="2">Số giờ chính thức</th>
              <th rowspan="2">Tổng số ngày làm việc</th>
            </tr>
            <tr>
              ${days
                .map(
                  (day) =>
                    `<th class="${weekendDays.includes(day) ? 'weekend' : 'subhead'}">${String(day).padStart(2, '0')}</th>`
                )
                .join('')}
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
    </html>
  `;
};

export function WorkSchedulesPageContent() {
  const session = getSession();
  const queryClient = useQueryClient();
  const isAdmin = session?.user.role === 'ADMIN';
  const baseStoreId = session?.user.store?.id ?? '';
  const [selectedYear, setSelectedYear] = useState(Number(defaultYearString));
  const [selectedMonth, setSelectedMonth] = useState(Number(defaultMonthString));
  const [selectedStoreId, setSelectedStoreId] = useState(baseStoreId);
  const [editorState, setEditorState] = useState<EditableState | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [focusedEmployeeId, setFocusedEmployeeId] = useState('all');

  const storesQuery = useQuery({
    queryKey: ['stores-selector-for-work-schedules'],
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

  const activeStoreId = isAdmin ? selectedStoreId : baseStoreId;

  const scheduleQuery = useQuery({
    queryKey: ['work-schedules', activeStoreId, selectedYear, selectedMonth],
    queryFn: () =>
      getWorkSchedule({
        storeId: activeStoreId || undefined,
        year: selectedYear,
        month: selectedMonth
      }) as Promise<WorkSchedulePayload>,
    enabled: Boolean(activeStoreId)
  });

  useEffect(() => {
    setEditorState(buildEditorState(scheduleQuery.data));
  }, [scheduleQuery.data]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const syncViewport = () => setIsMobile(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);

    return () => mediaQuery.removeEventListener('change', syncViewport);
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (state: EditableState) =>
      (saveWorkSchedule({
        storeId: activeStoreId || undefined,
        year: selectedYear,
        month: selectedMonth,
        title: state.title,
        notes: state.notes,
        status: state.status,
        shifts: normalizeShiftOrdering(state.shifts).map((shift) => ({
          key: shift.key,
          code: shift.code,
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          durationHours: shift.durationHours,
          sortOrder: shift.sortOrder
        })),
        employees: normalizeEmployeeOrdering(state.employees).map((employee) => ({
          userId: employee.userId,
          sortOrder: employee.sortOrder,
          trialHourlyRate: employee.trialHourlyRate,
          officialHourlyRate: employee.officialHourlyRate,
          entries: employee.entries.map((entry) => ({
            day: entry.day,
            shiftKey: entry.shiftKey,
            entryType: entry.entryType
          }))
        }))
      }) as Promise<WorkSchedulePayload>),
    onSuccess: (payload) => {
      queryClient.setQueryData(['work-schedules', activeStoreId, selectedYear, selectedMonth], payload);
      setEditorState(buildEditorState(payload));
    }
  });

  const totalDays =
    scheduleQuery.data?.daysInMonth ?? new Date(selectedYear, selectedMonth, 0).getDate();
  const days = useMemo(() => Array.from({ length: totalDays }, (_, index) => index + 1), [totalDays]);
  const weekendDays = useMemo(
    () => scheduleQuery.data?.weekendDays ?? buildWeekendDays(selectedYear, selectedMonth, totalDays),
    [scheduleQuery.data?.weekendDays, selectedMonth, selectedYear, totalDays]
  );

  const persistedLocked = scheduleQuery.data?.schedule.status === 'LOCKED';
  const canManageSchedule = Boolean(isAdmin && editorState && !persistedLocked);
  const canEditGrid = Boolean(canManageSchedule && editorState?.status !== 'LOCKED');
  const orderedEmployees = useMemo(
    () => (editorState ? normalizeEmployeeOrdering(editorState.employees) : []),
    [editorState]
  );

  const storeName =
    scheduleQuery.data?.store.name ??
    stores.find((store) => store.id === activeStoreId)?.name ??
    session?.user.store?.name ??
    '-';

  useEffect(() => {
    if (!orderedEmployees.length) {
      setFocusedEmployeeId('all');
      return;
    }

    if (!isMobile) {
      setFocusedEmployeeId('all');
      return;
    }

    const selectedExists = orderedEmployees.some((employee) => employee.userId === focusedEmployeeId);
    if (focusedEmployeeId === 'all' || !selectedExists) {
      setFocusedEmployeeId(orderedEmployees[0].userId);
    }
  }, [focusedEmployeeId, isMobile, orderedEmployees]);

  const visibleEmployees = useMemo(() => {
    if (!isMobile || focusedEmployeeId === 'all') {
      return orderedEmployees;
    }

    return orderedEmployees.filter((employee) => employee.userId === focusedEmployeeId);
  }, [focusedEmployeeId, isMobile, orderedEmployees]);

  const statusOption = editorState
    ? statusOptions.find((option) => option.value === editorState.status)
    : undefined;

  const updateEditorState = (updater: (draft: EditableState) => EditableState) => {
    setEditorState((current) => (current ? updater(current) : current));
  };

  const handleSave = () => {
    if (!editorState) return;

    const existingStatus = scheduleQuery.data?.schedule.status;
    if (
      editorState.status === 'LOCKED' &&
      existingStatus !== 'LOCKED' &&
      !window.confirm('Sau khi chốt tháng, bảng chấm công sẽ bị khóa và không thể chỉnh sửa nữa. Bạn có chắc chắn muốn tiếp tục?')
    ) {
      return;
    }

    saveMutation.mutate(editorState);
  };

  const handleExportCsv = () => {
    if (!editorState) return;

    const content = buildCsvContent({
      state: editorState,
      days,
      employees: visibleEmployees,
      storeName,
      selectedMonth,
      selectedYear
    });

    downloadTextFile(
      `bang-cham-cong-${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${sanitizeFilename(storeName)}.csv`,
      content,
      'text/csv;charset=utf-8;'
    );
  };

  const handlePrint = () => {
    if (!editorState) return;

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1440,height=900');
    if (!printWindow) return;

    printWindow.document.write(
      buildPrintHtml({
        state: editorState,
        days,
        weekendDays,
        employees: visibleEmployees,
        storeName
      })
    );
    printWindow.document.close();
  };

  return (
    <ProtectedPage title="Ca làm việc" allowedRoles={['ADMIN', 'MANAGER', 'STAFF']} wide>
      <div className="space-y-4">
        <Card className="overflow-hidden border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-slate-50 p-0">
          <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold text-brand-900">
                  {editorState?.title ?? `Bảng chấm công tháng ${selectedMonth}/${selectedYear}`}
                </h2>
                {statusOption ? <Badge label={statusOption.label} tone={statusOption.tone} /> : null}
                {persistedLocked ? <Badge label="Khóa chỉnh sửa" tone="danger" /> : null}
              </div>
              <p className="text-sm text-slate-600">
                Chi nhánh: <span className="font-semibold text-brand-900">{storeName}</span>
              </p>
              <p className="max-w-3xl text-sm text-slate-600">
                Sắp ca, theo dõi giờ thử việc và giờ chính thức trên một bảng chấm công lớn, dễ
                xem cho cả quản lý lẫn nhân viên.
              </p>
              {persistedLocked ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  Bảng chấm công tháng này đã được chốt. Hệ thống sẽ khóa toàn bộ thao tác chỉnh
                  sửa để đảm bảo dữ liệu lương không bị thay đổi.
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setIsConfigOpen((current) => !current)}>
                {isConfigOpen ? 'Ẩn cấu hình' : 'Cấu hình'}
              </Button>
              <Button variant="secondary" onClick={handlePrint} disabled={!editorState}>
                In bảng chấm công
              </Button>
              <Button variant="secondary" onClick={handleExportCsv} disabled={!editorState}>
                Xuất CSV
              </Button>
              <Button
                variant="secondary"
                onClick={() => scheduleQuery.refetch()}
                disabled={scheduleQuery.isFetching}
              >
                {scheduleQuery.isFetching ? 'Đang tải lại...' : 'Tải lại'}
              </Button>
              {isAdmin && editorState ? (
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending || !canManageSchedule}
                >
                  {saveMutation.isPending
                    ? 'Đang lưu...'
                    : persistedLocked
                      ? 'Bảng đã chốt'
                      : 'Lưu thay đổi'}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 border-t border-brand-100 bg-white/80 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl bg-brand-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-brand-700">Nhân viên hiển thị</p>
              <p className="mt-2 text-2xl font-semibold text-brand-900">{visibleEmployees.length}</p>
              <p className="mt-1 text-xs text-slate-500">
                Tổng toàn chi nhánh: {orderedEmployees.length}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-brand-100">
              <p className="text-xs uppercase tracking-[0.18em] text-brand-700">Số ca đang áp dụng</p>
              <p className="mt-2 text-2xl font-semibold text-brand-900">
                {editorState?.shifts.length ?? 0}
              </p>
              <p className="mt-1 text-xs text-slate-500">Có thể thêm bớt linh hoạt theo tháng.</p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-brand-100">
              <p className="text-xs uppercase tracking-[0.18em] text-brand-700">Kỳ bảng chấm công</p>
              <p className="mt-2 text-2xl font-semibold text-brand-900">
                {String(selectedMonth).padStart(2, '0')}/{selectedYear}
              </p>
              <p className="mt-1 text-xs text-slate-500">{days.length} ngày trong tháng này.</p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-brand-100">
              <p className="text-xs uppercase tracking-[0.18em] text-brand-700">Quyền truy cập</p>
              <p className="mt-2 text-lg font-semibold text-brand-900">
                {roleLabels[session?.user.role ?? 'STAFF']}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {isAdmin
                  ? 'Được chọn chi nhánh, sắp ca, chỉnh lương và chốt tháng.'
                  : 'Chỉ xem bảng chấm công của chi nhánh hiện tại.'}
              </p>
            </div>
          </div>
        </Card>

        {saveMutation.isError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {(saveMutation.error as Error).message}
          </p>
        ) : null}

        {scheduleQuery.isError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {(scheduleQuery.error as Error).message}
          </p>
        ) : null}

        {editorState && isConfigOpen ? (
          <Card className="space-y-4 border border-brand-100 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-brand-900">Cấu hình</h3>
                <p className="text-sm text-slate-500">
                  Gộp bộ lọc, ghi chú ca làm, cấu hình ca và quy ước hiển thị để dành không gian
                  rộng hơn cho bảng chấm công.
                </p>
              </div>
              {statusOption ? <Badge label={statusOption.label} tone={statusOption.tone} /> : null}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
          <Card className="space-y-4 border border-brand-100 bg-brand-50/40">
            <div>
              <h2 className="text-lg font-semibold text-brand-900">Bộ lọc bảng chấm công</h2>
              <p className="text-sm text-slate-500">
                Chọn tháng, năm và chi nhánh để xem hoặc cập nhật lịch làm.
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
              <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-700">Chi nhánh</p>
                <p className="mt-2 text-sm font-semibold text-brand-900">{storeName}</p>
                <p className="mt-2 text-xs text-slate-500">
                  Nhân viên và quản lý chỉ xem bảng chấm công trong chi nhánh của mình.
                </p>
              </div>
            )}
          </Card>

          {editorState ? (
            <Card className="space-y-4 border border-brand-100 bg-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-brand-900">Ghi chú ca làm</h2>
                  <p className="text-sm text-slate-500">
                    Tiêu đề bảng, trạng thái và ghi chú tổng quan của tháng.
                  </p>
                </div>
                {statusOption ? <Badge label={statusOption.label} tone={statusOption.tone} /> : null}
              </div>

              <Input
                label="Tiêu đề bảng"
                value={editorState.title}
                onChange={(event) =>
                  updateEditorState((state) => ({
                    ...state,
                    title: event.target.value
                  }))
                }
                disabled={!canManageSchedule || editorState.status === 'LOCKED'}
              />

              {isAdmin ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-brand-900">Trạng thái</span>
                  <select
                    className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3"
                    value={editorState.status}
                    onChange={(event) =>
                      updateEditorState((state) => ({
                        ...state,
                        status: event.target.value as WorkScheduleStatus
                      }))
                    }
                    disabled={!canManageSchedule}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-medium text-brand-900">Nội dung ghi chú</span>
                <textarea
                  className="min-h-36 w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900 outline-none focus:border-brand-500"
                  value={editorState.notes}
                  onChange={(event) =>
                    updateEditorState((state) => ({
                      ...state,
                      notes: event.target.value
                    }))
                  }
                  disabled={!canManageSchedule || editorState.status === 'LOCKED'}
                />
              </label>
            </Card>
          ) : null}

          {editorState ? (
            <Card className="space-y-4 border border-brand-100 bg-white xl:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-brand-900">Cấu hình ca</h2>
                  <p className="text-sm text-slate-500">
                    Thêm bớt linh hoạt số ca và số giờ tính lương của từng ca trong tháng.
                  </p>
                </div>
                {isAdmin ? (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      updateEditorState((state) => ({
                        ...state,
                        shifts: normalizeShiftOrdering([
                          ...state.shifts,
                          {
                            key: createShiftKey(),
                            code: `CA${state.shifts.length + 1}`,
                            name: `Ca ${state.shifts.length + 1}`,
                            startTime: '08:00',
                            endTime: '13:00',
                            durationHours: 5,
                            sortOrder: state.shifts.length
                          }
                        ])
                      }))
                    }
                    disabled={!canManageSchedule || editorState.status === 'LOCKED'}
                  >
                    Thêm ca
                  </Button>
                ) : null}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {editorState.shifts.map((shift, index) => (
                  <div key={shift.key} className="rounded-3xl border border-brand-100 bg-brand-50/40 p-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Input
                        label="Mã ca"
                        value={shift.code}
                        onChange={(event) =>
                          updateEditorState((state) => ({
                            ...state,
                            shifts: state.shifts.map((item) =>
                              item.key === shift.key ? { ...item, code: event.target.value } : item
                            )
                          }))
                        }
                        disabled={!canManageSchedule || editorState.status === 'LOCKED'}
                      />
                      <Input
                        label="Tên ca"
                        value={shift.name}
                        onChange={(event) =>
                          updateEditorState((state) => ({
                            ...state,
                            shifts: state.shifts.map((item) =>
                              item.key === shift.key ? { ...item, name: event.target.value } : item
                            )
                          }))
                        }
                        disabled={!canManageSchedule || editorState.status === 'LOCKED'}
                      />
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <Input
                        label="Bắt đầu"
                        value={shift.startTime}
                        onChange={(event) =>
                          updateEditorState((state) => ({
                            ...state,
                            shifts: state.shifts.map((item) =>
                              item.key === shift.key ? { ...item, startTime: event.target.value } : item
                            )
                          }))
                        }
                        disabled={!canManageSchedule || editorState.status === 'LOCKED'}
                      />
                      <Input
                        label="Kết thúc"
                        value={shift.endTime}
                        onChange={(event) =>
                          updateEditorState((state) => ({
                            ...state,
                            shifts: state.shifts.map((item) =>
                              item.key === shift.key ? { ...item, endTime: event.target.value } : item
                            )
                          }))
                        }
                        disabled={!canManageSchedule || editorState.status === 'LOCKED'}
                      />
                      <Input
                        label="Số giờ tính lương"
                        type="number"
                        step="0.5"
                        min="0"
                        value={shift.durationHours}
                        onChange={(event) =>
                          updateEditorState((state) => ({
                            ...state,
                            shifts: state.shifts.map((item) =>
                              item.key === shift.key ? { ...item, durationHours: Number(event.target.value) || 0 } : item
                            )
                          }))
                        }
                        disabled={!canManageSchedule || editorState.status === 'LOCKED'}
                      />
                    </div>

                    {isAdmin ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() =>
                            updateEditorState((state) => ({
                              ...state,
                              shifts: normalizeShiftOrdering(
                                state.shifts.filter((item) => item.key !== shift.key)
                              ),
                              employees: state.employees.map((employee) => ({
                                ...employee,
                                entries: employee.entries.filter((entry) => entry.shiftKey !== shift.key)
                              }))
                            }))
                          }
                          disabled={
                            editorState.shifts.length <= 1 ||
                            !canManageSchedule ||
                            editorState.status === 'LOCKED'
                          }
                        >
                          Xóa ca
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            updateEditorState((state) => {
                              if (index === 0) return state;
                              const next = [...state.shifts];
                              [next[index - 1], next[index]] = [next[index], next[index - 1]];
                              return { ...state, shifts: normalizeShiftOrdering(next) };
                            })
                          }
                          disabled={index === 0 || !canManageSchedule || editorState.status === 'LOCKED'}
                        >
                          Lên
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() =>
                            updateEditorState((state) => {
                              if (index === state.shifts.length - 1) return state;
                              const next = [...state.shifts];
                              [next[index + 1], next[index]] = [next[index], next[index + 1]];
                              return { ...state, shifts: normalizeShiftOrdering(next) };
                            })
                          }
                          disabled={
                            index === editorState.shifts.length - 1 ||
                            !canManageSchedule ||
                            editorState.status === 'LOCKED'
                          }
                        >
                          Xuống
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          <Card className="space-y-3 border border-brand-100 bg-brand-50/50 xl:col-span-2">
            <h2 className="text-lg font-semibold text-brand-900">Quy ước hiển thị</h2>
            <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
              <p><span className="font-semibold text-brand-900">C</span>: Giờ chính thức</p>
              <p><span className="font-semibold text-amber-700">T</span>: Giờ thử việc</p>
              <p>Mỗi lần bấm vào ô sẽ xoay vòng: trống → chính thức → thử việc.</p>
              <p>Hàng Tổng cộng tự động tính tổng giờ theo từng ngày và tổng giờ theo tháng.</p>
              <p>Dòng Lương tự động tính theo đơn giá thử việc và chính thức của từng nhân viên.</p>
              <p>Khi bảng đã chốt tháng, mọi thao tác chỉnh sửa sẽ bị khóa hoàn toàn.</p>
            </div>
          </Card>
            </div>
          </Card>
        ) : null}

        {isMobile && editorState && orderedEmployees.length > 1 ? (
          <Card className="space-y-3 border border-brand-100 bg-white">
            <div>
              <h3 className="text-base font-semibold text-brand-900">Chế độ xem trên điện thoại</h3>
              <p className="text-sm text-slate-500">
                Chọn một nhân viên để bảng gọn hơn và dễ theo dõi khi dùng màn hình nhỏ.
              </p>
            </div>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Nhân viên hiển thị</span>
              <select
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3"
                value={focusedEmployeeId}
                onChange={(event) => setFocusedEmployeeId(event.target.value)}
              >
                {orderedEmployees.map((employee) => (
                  <option key={employee.userId} value={employee.userId}>
                    {employee.displayName} - {employee.username}
                  </option>
                ))}
              </select>
            </label>
          </Card>
        ) : null}

        <Card className="space-y-4 overflow-hidden border border-brand-100 bg-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-brand-900">
                {editorState?.title ?? `Bảng chấm công tháng ${selectedMonth}/${selectedYear}`}
              </h2>
              <p className="text-sm text-slate-500">
                Chi nhánh: <span className="font-medium text-brand-900">{storeName}</span>
              </p>
            </div>
            <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
              <p className="font-semibold">Tổng số nhân viên đang hiển thị</p>
              <p className="mt-1 text-2xl font-semibold text-brand-900">
                {visibleEmployees.length}
              </p>
            </div>
          </div>

          {scheduleQuery.isPending || !editorState ? (
            <div className="rounded-2xl border border-dashed border-brand-100 bg-brand-50 p-8 text-center text-sm text-brand-700">
              Đang tải bảng chấm công...
            </div>
          ) : (
            <div className="overflow-auto rounded-3xl border border-brand-100 bg-white shadow-sm">
              <table className="min-w-max border-separate border-spacing-0 text-sm text-slate-800">
                <thead className="sticky top-0 z-20">
                  <tr>
                    <th
                      className={clsx(
                        'border border-brand-100 bg-brand-900 px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-white',
                        !isMobile && 'sticky left-0 z-30'
                      )}
                      rowSpan={2}
                    >
                      STT
                    </th>
                    <th
                      className={clsx(
                        'min-w-[220px] border border-brand-100 bg-brand-900 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-white',
                        !isMobile && 'sticky left-[72px] z-30'
                      )}
                      rowSpan={2}
                    >
                      Tên nhân viên
                    </th>
                    <th
                      className={clsx(
                        'min-w-[150px] border border-brand-100 bg-brand-900 px-3 py-3 text-left text-xs font-semibold uppercase tracking-[0.14em] text-white',
                        !isMobile && 'sticky left-[292px] z-30'
                      )}
                      rowSpan={2}
                    >
                      Ca làm
                    </th>
                    <th
                      className="border border-brand-100 bg-brand-900 px-3 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-white"
                      colSpan={days.length}
                    >
                      Ngày làm
                    </th>
                    <th className="min-w-[140px] border border-brand-100 bg-brand-900 px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white" rowSpan={2}>Số giờ thử việc</th>
                    <th className="min-w-[150px] border border-brand-100 bg-brand-900 px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white" rowSpan={2}>Số giờ chính thức</th>
                    <th className="min-w-[160px] border border-brand-100 bg-brand-900 px-3 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-white" rowSpan={2}>Tổng số ngày làm việc</th>
                  </tr>
                  <tr>
                    {days.map((day) => (
                      <th
                        key={day}
                        className={clsx(
                          'border border-brand-100 px-2 py-3 text-center text-xs font-semibold',
                          weekendDays.includes(day)
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-brand-700 text-white'
                        )}
                      >
                        {String(day).padStart(2, '0')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleEmployees.map((employee) => {
                    const totals = computeEmployeeTotals(employee, editorState.shifts);
                    const rowSpan = editorState.shifts.length + 2;
                    const employeeIndex = employee.sortOrder;
                    const surfaceClass = employeeIndex % 2 === 0 ? 'bg-white' : 'bg-[#f8faf7]';

                    return (
                      <Fragment key={employee.userId}>
                        {editorState.shifts.map((shift, shiftIndex) => (
                          <tr key={`${employee.userId}-${shift.key}`}>
                            {shiftIndex === 0 ? (
                              <td
                                className={clsx(
                                  'border border-brand-100 px-3 py-3 align-top',
                                  surfaceClass,
                                  !isMobile && 'sticky left-0 z-10'
                                )}
                                rowSpan={rowSpan}
                              >
                                <div className="space-y-2">
                                  <span className="text-lg font-semibold text-brand-900">{employeeIndex + 1}</span>
                                  {isAdmin ? (
                                    <div className="grid gap-1">
                                      <button
                                        type="button"
                                        className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-900 transition hover:bg-brand-100 disabled:opacity-40"
                                        onClick={() =>
                                          updateEditorState((state) => {
                                            if (employeeIndex === 0) return state;
                                            const next = [...state.employees];
                                            [next[employeeIndex - 1], next[employeeIndex]] = [
                                              next[employeeIndex],
                                              next[employeeIndex - 1]
                                            ];
                                            return { ...state, employees: normalizeEmployeeOrdering(next) };
                                          })
                                        }
                                        disabled={employeeIndex === 0 || !canEditGrid}
                                      >
                                        Lên
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-lg bg-brand-50 px-2 py-1 text-xs font-medium text-brand-900 transition hover:bg-brand-100 disabled:opacity-40"
                                        onClick={() =>
                                          updateEditorState((state) => {
                                            if (employeeIndex === state.employees.length - 1) return state;
                                            const next = [...state.employees];
                                            [next[employeeIndex + 1], next[employeeIndex]] = [
                                              next[employeeIndex],
                                              next[employeeIndex + 1]
                                            ];
                                            return { ...state, employees: normalizeEmployeeOrdering(next) };
                                          })
                                        }
                                        disabled={
                                          employeeIndex === editorState.employees.length - 1 ||
                                          !canEditGrid
                                        }
                                      >
                                        Xuống
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </td>
                            ) : null}

                            {shiftIndex === 0 ? (
                              <td
                                className={clsx(
                                  'border border-brand-100 px-3 py-3 align-top',
                                  surfaceClass,
                                  !isMobile && 'sticky left-[72px] z-10'
                                )}
                                rowSpan={rowSpan}
                              >
                                <div className="space-y-2">
                                  <p className="text-base font-semibold text-brand-900">{employee.displayName}</p>
                                  <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                    {roleLabels[employee.role]} - {employee.username}
                                  </p>
                                </div>
                              </td>
                            ) : null}

                            <td
                              className={clsx(
                                'border border-brand-100 px-3 py-3 text-slate-700',
                                surfaceClass,
                                !isMobile && 'sticky left-[292px] z-10'
                              )}
                            >
                              <p className="font-semibold text-brand-900">{shift.name}</p>
                              <p className="text-xs text-slate-500">
                                {shift.startTime} - {shift.endTime} • {formatHours(shift.durationHours)} giờ
                              </p>
                            </td>

                            {days.map((day) => {
                              const value = getEntryValue(employee, shift.key, day);
                              return (
                                <td
                                  key={`${employee.userId}-${shift.key}-${day}`}
                                  className={clsx(
                                    'border border-brand-100 p-0',
                                    weekendDays.includes(day) ? 'bg-amber-50' : 'bg-white'
                                  )}
                                >
                                  <button
                                    type="button"
                                    className={clsx(
                                      isMobile ? 'h-10 w-10 text-xs' : 'h-11 w-11 text-sm',
                                      'font-semibold transition-colors',
                                      value === 'OFFICIAL' &&
                                        'bg-brand-100 text-brand-900 hover:bg-brand-200',
                                      value === 'TRIAL' &&
                                        'bg-amber-100 text-amber-800 hover:bg-amber-200',
                                      !value && 'text-slate-400 hover:bg-brand-50',
                                      !canEditGrid && 'cursor-default'
                                    )}
                                    onClick={() => {
                                      if (!canEditGrid) return;
                                      updateEditorState((state) => ({
                                        ...state,
                                        employees: state.employees.map((item) =>
                                          item.userId === employee.userId
                                            ? {
                                                ...item,
                                                entries: upsertEntryValue(
                                                  item,
                                                  shift.key,
                                                  day,
                                                  cycleEntryType(getEntryValue(item, shift.key, day))
                                                )
                                              }
                                            : item
                                        )
                                      }));
                                    }}
                                    disabled={!canEditGrid}
                                  >
                                    {value === 'OFFICIAL' ? 'C' : value === 'TRIAL' ? 'T' : ''}
                                  </button>
                                </td>
                              );
                            })}

                            <td className="border border-brand-100 bg-slate-50 px-3 py-3 text-center text-slate-300">-</td>
                            <td className="border border-brand-100 bg-slate-50 px-3 py-3 text-center text-slate-300">-</td>
                            <td className="border border-brand-100 bg-slate-50 px-3 py-3 text-center text-slate-300">-</td>
                          </tr>
                        ))}

                        <tr key={`${employee.userId}-total`} className="bg-[#edf4ea] text-brand-900">
                          <td
                            className={clsx(
                              'border border-brand-100 px-3 py-3 font-semibold',
                              !isMobile && 'sticky left-[292px] z-10 bg-[#edf4ea]'
                            )}
                          >
                            Tổng cộng
                          </td>
                          {days.map((day) => (
                            <td key={`${employee.userId}-daily-${day}`} className="border border-brand-100 px-3 py-3 text-center font-medium">
                              {totals.dailyHours.get(day) ? formatHours(totals.dailyHours.get(day) ?? 0) : '0'}
                            </td>
                          ))}
                          <td className="border border-brand-100 px-3 py-3 text-center font-semibold">{formatHours(totals.trialHours)}</td>
                          <td className="border border-brand-100 px-3 py-3 text-center font-semibold">{formatHours(totals.officialHours)}</td>
                          <td className="border border-brand-100 px-3 py-3 text-center font-semibold">{totals.totalWorkingDays}</td>
                        </tr>

                        <tr key={`${employee.userId}-salary`} className="bg-brand-900 text-white">
                          <td
                            className={clsx(
                              'border border-brand-100 px-3 py-3 font-semibold text-white',
                              !isMobile && 'sticky left-[292px] z-10 bg-brand-900'
                            )}
                          >
                            Lương
                          </td>
                          <td className="border border-brand-100 px-3 py-3 text-sm text-brand-50" colSpan={days.length}>
                            {employee.displayName} được tính lương tự động theo tổng giờ thử việc, giờ chính thức và đơn giá hiện tại.
                          </td>
                          <td className="border border-brand-100 px-3 py-3 text-center text-white">
                            {isAdmin ? (
                              <input
                                className="w-full rounded-lg border border-brand-100/40 bg-white px-3 py-2 text-right text-sm text-brand-900"
                                type="number"
                                min="0"
                                step="1000"
                                value={employee.trialHourlyRate}
                                onChange={(event) =>
                                  updateEditorState((state) => ({
                                    ...state,
                                    employees: state.employees.map((item) =>
                                      item.userId === employee.userId
                                        ? { ...item, trialHourlyRate: Number(event.target.value) || 0 }
                                        : item
                                    )
                                  }))
                                }
                                disabled={!canEditGrid}
                              />
                            ) : (
                              formatCurrency(employee.trialHourlyRate)
                            )}
                          </td>
                          <td className="border border-brand-100 px-3 py-3 text-center text-white">
                            {isAdmin ? (
                              <input
                                className="w-full rounded-lg border border-brand-100/40 bg-white px-3 py-2 text-right text-sm text-brand-900"
                                type="number"
                                min="0"
                                step="1000"
                                value={employee.officialHourlyRate}
                                onChange={(event) =>
                                  updateEditorState((state) => ({
                                    ...state,
                                    employees: state.employees.map((item) =>
                                      item.userId === employee.userId
                                        ? { ...item, officialHourlyRate: Number(event.target.value) || 0 }
                                        : item
                                    )
                                  }))
                                }
                                disabled={!canEditGrid}
                              />
                            ) : (
                              formatCurrency(employee.officialHourlyRate)
                            )}
                          </td>
                          <td className="border border-brand-100 px-3 py-3 text-center text-lg font-semibold text-white">
                            {formatCurrency(totals.totalSalary)}
                          </td>
                        </tr>
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
