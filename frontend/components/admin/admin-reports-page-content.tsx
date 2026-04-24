"use client";

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SimpleTable } from '@/components/ui/table';
import { listStores } from '@/services/admin/stores';
import {
  type AdminReportPayload,
  getAdminReports
} from '@/services/admin/reports';

const DATE_INPUT_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

const MONTH_INPUT_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit'
});

const today = new Date();
const [
  currentYearString = String(today.getFullYear()),
  currentMonthString = String(today.getMonth() + 1).padStart(2, '0')
] = MONTH_INPUT_FORMATTER.format(today).split('-');
const currentYear = Number(currentYearString);
const currentMonth = Number(currentMonthString);
const startOfMonth = `${currentYearString}-${currentMonthString}-01`;
const todayValue = DATE_INPUT_FORMATTER.format(today);

const numberFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1
});

const currencyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0
});

const formatQty = (value: number) => numberFormatter.format(value);
const formatMoney = (value: number) => currencyFormatter.format(value);
const sanitizeFilename = (value: string) => value.replace(/[\\/:*?"<>|]/g, '-').trim();
const escapeXml = (value: string | number) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const buildExcelCell = (value: string | number, type: 'String' | 'Number' = 'String') =>
  `<Cell><Data ss:Type="${type}">${type === 'String' ? escapeXml(value) : value}</Data></Cell>`;

const buildSheetXml = (name: string, rows: Array<Array<string>>) => `
  <Worksheet ss:Name="${escapeXml(name)}">
    <Table>
      ${rows.map((row) => `<Row>${row.join('')}</Row>`).join('')}
    </Table>
  </Worksheet>
`;

const downloadExcelFile = (filename: string, content: string) => {
  const blob = new Blob([content], {
    type: 'application/vnd.ms-excel;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const buildReportsExcelXml = (payload: AdminReportPayload) => {
  const inventoryRows = [
    ['Mã', 'Nguyên liệu', 'Đơn vị', 'Tồn hiện tại', 'Số lô'].map((value) => buildExcelCell(value)),
    ...payload.inventorySnapshot.items.map((item) => [
      buildExcelCell(item.ingredientCode),
      buildExcelCell(item.ingredientName),
      buildExcelCell(item.unit ?? ''),
      buildExcelCell(Number(item.totalRemainingQty.toFixed(2)), 'Number'),
      buildExcelCell(item.batchCount, 'Number')
    ])
  ];

  const wastageRows = [
    ['Mã', 'Nguyên liệu', 'Đơn vị', 'Hao hụt', 'Số phiếu'].map((value) => buildExcelCell(value)),
    ...payload.wastage.items.map((item) => [
      buildExcelCell(item.ingredientCode),
      buildExcelCell(item.ingredientName),
      buildExcelCell(item.unit ?? ''),
      buildExcelCell(Number(item.totalQty.toFixed(2)), 'Number'),
      buildExcelCell(item.adjustmentCount, 'Number')
    ])
  ];

  const batchRows = [
    ['Mã lô', 'Nguyên liệu', 'SL đầu', 'SL còn', 'Trạng thái', 'Ngày nhận'].map((value) =>
      buildExcelCell(value)
    ),
    ...payload.batchHistory.items.map((item) => [
      buildExcelCell(item.batchCode),
      buildExcelCell(item.ingredientName),
      buildExcelCell(Number(item.initialQty.toFixed(2)), 'Number'),
      buildExcelCell(Number(item.remainingQty.toFixed(2)), 'Number'),
      buildExcelCell(item.status),
      buildExcelCell(new Date(item.receivedAt).toLocaleDateString('vi-VN'))
    ])
  ];

  const topRows = [
    ['Mã', 'Nguyên liệu', 'Đơn vị', 'SL dùng', 'Lượt quét'].map((value) => buildExcelCell(value)),
    ...payload.topIngredients.items.map((item) => [
      buildExcelCell(item.ingredientCode),
      buildExcelCell(item.ingredientName),
      buildExcelCell(item.unit ?? ''),
      buildExcelCell(Number(item.totalUsedQty.toFixed(2)), 'Number'),
      buildExcelCell(item.scanCount, 'Number')
    ])
  ];

  const payrollRows = [
    [
      'Nhân viên',
      'Vai trò',
      'Giờ TV',
      'Giờ CT',
      'Lương gốc',
      'Phụ cấp',
      'Đi trễ',
      'Về sớm',
      'Khấu trừ',
      'Thực nhận'
    ].map((value) => buildExcelCell(value)),
    ...payload.workScheduleSummary.employees.map((item) => [
      buildExcelCell(item.displayName),
      buildExcelCell(item.role),
      buildExcelCell(Number(item.trialHours.toFixed(2)), 'Number'),
      buildExcelCell(Number(item.officialHours.toFixed(2)), 'Number'),
      buildExcelCell(Math.round(item.grossSalary), 'Number'),
      buildExcelCell(Math.round(item.allowanceAmount), 'Number'),
      buildExcelCell(item.lateMinutes, 'Number'),
      buildExcelCell(item.earlyLeaveMinutes, 'Number'),
      buildExcelCell(Math.round(item.totalDeductions), 'Number'),
      buildExcelCell(Math.round(item.netSalary), 'Number')
    ])
  ];

  return `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  ${buildSheetXml('TonKho', inventoryRows)}
  ${buildSheetXml('HaoHut', wastageRows)}
  ${buildSheetXml('LoHang', batchRows)}
  ${buildSheetXml('TopNguyenLieu', topRows)}
  ${buildSheetXml('BangLuong', payrollRows)}
</Workbook>`;
};

export default function AdminReportsPageContent() {
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [startDate, setStartDate] = useState(startOfMonth);
  const [endDate, setEndDate] = useState(todayValue);
  const [payrollYear, setPayrollYear] = useState(currentYear);
  const [payrollMonth, setPayrollMonth] = useState(currentMonth);

  const storesQuery = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['admin-report-stores'],
    queryFn: async () => {
      const response = await listStores('');
      return response.data as Array<{ id: string; name: string }>;
    }
  });

  const stores = storesQuery.data ?? [];

  useEffect(() => {
    if (!selectedStoreId && stores.length > 0) {
      setSelectedStoreId(stores[0].id);
    }
  }, [selectedStoreId, stores]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedStoreId) {
      params.set('storeId', selectedStoreId);
    }
    if (startDate) {
      params.set('startDate', new Date(`${startDate}T00:00:00`).toISOString());
    }
    if (endDate) {
      params.set('endDate', new Date(`${endDate}T23:59:59.999`).toISOString());
    }
    params.set('year', String(payrollYear));
    params.set('month', String(payrollMonth));
    return `?${params.toString()}`;
  }, [endDate, payrollMonth, payrollYear, selectedStoreId, startDate]);

  const reportQuery = useQuery({
    queryKey: ['admin-reports', queryString],
    queryFn: () => getAdminReports(queryString),
    enabled: Boolean(selectedStoreId)
  });

  const payload = reportQuery.data;

  const handleExportExcel = () => {
    if (!payload) {
      return;
    }

    const xml = buildReportsExcelXml(payload);
    downloadExcelFile(
      `bao-cao-admin-${sanitizeFilename(payload.store.name)}-${payrollYear}-${String(payrollMonth).padStart(2, '0')}.xls`,
      xml
    );
  };

  return (
    <ProtectedPage title="Báo cáo quản trị" allowedRoles={['ADMIN']} wide>
      <div className="space-y-4">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-brand-900">Báo cáo admin</h2>
              <p className="text-sm text-slate-500">
                Tổng hợp tồn kho hiện tại, hao hụt, lô hàng, mức dùng nguyên liệu và bảng lương tháng.
              </p>
            </div>
            <Button variant="secondary" onClick={handleExportExcel} disabled={!payload}>
              Xuất Excel
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
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

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Từ ngày</span>
              <input
                type="date"
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Đến ngày</span>
              <input
                type="date"
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Năm bảng lương</span>
              <input
                type="number"
                min={2020}
                max={2100}
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3"
                value={payrollYear}
                onChange={(event) => setPayrollYear(Number(event.target.value) || currentYear)}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Tháng bảng lương</span>
              <select
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3"
                value={payrollMonth}
                onChange={(event) => setPayrollMonth(Number(event.target.value))}
              >
                {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                  <option key={month} value={month}>
                    Tháng {month}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Card>

        {reportQuery.isError ? (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {(reportQuery.error as Error).message}
          </p>
        ) : null}

        {payload ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <MetricCard
                label="Mặt hàng còn tồn"
                value={payload.summary.inventoryIngredientCount}
                hint={`Tổng tồn ${formatQty(payload.summary.inventoryTotalQty)}`}
              />
              <MetricCard
                label="Hao hụt"
                value={formatQty(payload.summary.wastageTotalQty)}
                hint="Tổng lượng giảm do điều chỉnh"
              />
              <MetricCard
                label="Lô phát sinh"
                value={payload.summary.batchHistoryCount}
                hint="Số lô trong kỳ lọc"
              />
              <MetricCard
                label="SL đã dùng"
                value={formatQty(payload.summary.topUsageTotalQty)}
                hint="Tổng nguyên liệu sử dụng"
              />
              <MetricCard
                label="Thực nhận lương"
                value={formatMoney(payload.summary.payrollNetTotal)}
                hint={`${String(payrollMonth).padStart(2, '0')}/${payrollYear}`}
              />
            </div>

            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-brand-900">Tồn kho hiện tại</h3>
                  <p className="text-sm text-slate-500">
                    Snapshot tại thời điểm mở báo cáo, phù hợp để kiểm tra nhanh mức tồn còn lại theo nguyên liệu.
                  </p>
                </div>
                <Badge
                  label={`Cập nhật ${new Date(payload.inventorySnapshot.generatedAt).toLocaleString('vi-VN')}`}
                  tone="neutral"
                />
              </div>
              <SimpleTable
                columns={['Mã', 'Nguyên liệu', 'Đơn vị', 'Tồn hiện tại', 'Số lô']}
                rows={payload.inventorySnapshot.items.map((item) => [
                  item.ingredientCode,
                  item.ingredientName,
                  item.unit ?? '-',
                  formatQty(item.totalRemainingQty),
                  item.batchCount
                ])}
              />
            </Card>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <h3 className="mb-4 text-lg font-semibold text-brand-900">Hao hụt</h3>
                <SimpleTable
                  columns={['Mã', 'Nguyên liệu', 'Đơn vị', 'Hao hụt', 'Số phiếu']}
                  rows={payload.wastage.items.map((item) => [
                    item.ingredientCode,
                    item.ingredientName,
                    item.unit ?? '-',
                    formatQty(item.totalQty),
                    item.adjustmentCount
                  ])}
                />
              </Card>

              <Card>
                <h3 className="mb-4 text-lg font-semibold text-brand-900">Top nguyên liệu dùng nhiều</h3>
                <SimpleTable
                  columns={['Mã', 'Nguyên liệu', 'Đơn vị', 'SL dùng', 'Lượt quét']}
                  rows={payload.topIngredients.items.map((item) => [
                    item.ingredientCode,
                    item.ingredientName,
                    item.unit ?? '-',
                    formatQty(item.totalUsedQty),
                    item.scanCount
                  ])}
                />
              </Card>
            </div>

            <Card>
              <h3 className="mb-4 text-lg font-semibold text-brand-900">Lịch sử batch</h3>
              <SimpleTable
                columns={['Mã lô', 'Nguyên liệu', 'SL đầu', 'SL còn', 'Trạng thái', 'Ngày nhận']}
                rows={payload.batchHistory.items.map((item) => [
                  item.batchCode,
                  item.ingredientName,
                  formatQty(item.initialQty),
                  formatQty(item.remainingQty),
                  item.status,
                  new Date(item.receivedAt).toLocaleDateString('vi-VN')
                ])}
              />
            </Card>

            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-brand-900">Tổng hợp ca làm và lương</h3>
                  <p className="text-sm text-slate-500">
                    {payload.workScheduleSummary.title
                      ? `${payload.workScheduleSummary.title}`
                      : `Chưa có bảng chấm công cho ${String(payrollMonth).padStart(2, '0')}/${payrollYear}`}
                  </p>
                </div>
                {payload.workScheduleSummary.status ? (
                  <Badge label={payload.workScheduleSummary.status} tone="neutral" />
                ) : null}
              </div>
              <SimpleTable
                columns={[
                  'Nhân viên',
                  'Vai trò',
                  'Giờ TV',
                  'Giờ CT',
                  'Phụ cấp',
                  'Khấu trừ',
                  'Thực nhận'
                ]}
                rows={payload.workScheduleSummary.employees.map((item) => [
                  item.displayName,
                  item.role,
                  formatQty(item.trialHours),
                  formatQty(item.officialHours),
                  formatMoney(item.allowanceAmount),
                  formatMoney(item.totalDeductions),
                  formatMoney(item.netSalary)
                ])}
              />
            </Card>
          </>
        ) : null}
      </div>
    </ProtectedPage>
  );
}

function MetricCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <Card>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-brand-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </Card>
  );
}
