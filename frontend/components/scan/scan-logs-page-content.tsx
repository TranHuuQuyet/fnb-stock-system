"use client";

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SimpleTable } from '@/components/ui/table';
import { getSession } from '@/lib/auth';
import {
  localizeOperationType,
  localizeResultStatus
} from '@/lib/localization';
import { listStores } from '@/services/admin/stores';
import { listScanLogs } from '@/services/scan';

type ScanView = 'STORE_USAGE' | 'TRANSFER';

const toStartDate = (value: string) =>
  value ? new Date(`${value}T00:00:00`).toISOString() : '';

const toEndDate = (value: string) =>
  value ? new Date(`${value}T23:59:59.999`).toISOString() : '';

export default function ScanLogsPageContent() {
  const session = getSession();
  const isAdmin = session?.user.role === 'ADMIN';
  const availableViews: ScanView[] = isAdmin ? ['STORE_USAGE', 'TRANSFER'] : ['STORE_USAGE'];
  const [activeView, setActiveView] = useState<ScanView>('STORE_USAGE');
  const [batchCode, setBatchCode] = useState('');
  const [resultStatus, setResultStatus] = useState('');
  const [storeId, setStoreId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const storesQuery = useQuery({
    queryKey: ['scan-log-stores'],
    queryFn: () => listStores(''),
    enabled: isAdmin
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('operationType', activeView);
    if (batchCode.trim()) {
      params.set('batchCode', batchCode.trim());
    }
    if (resultStatus) {
      params.set('resultStatus', resultStatus);
    }
    if (isAdmin && storeId) {
      params.set('storeId', storeId);
    }
    if (startDate) {
      params.set('startDate', toStartDate(startDate));
    }
    if (endDate) {
      params.set('endDate', toEndDate(endDate));
    }
    return `?${params.toString()}`;
  }, [activeView, batchCode, endDate, isAdmin, resultStatus, startDate, storeId]);

  const query = useQuery({
    queryKey: ['scan-logs', queryString],
    queryFn: () => listScanLogs(queryString)
  });

  const logs = (query.data?.data ?? []) as Array<{
    id: string;
    operationType: ScanView;
    quantityUsed: number;
    resultStatus: 'SUCCESS' | 'WARNING' | 'ERROR';
    message: string;
    scannedAt: string;
    batch?: {
      batchCode?: string | null;
      ingredient?: { name?: string | null } | null;
    } | null;
    user?: { fullName?: string | null } | null;
    store?: { name?: string | null } | null;
    destinationStore?: { name?: string | null } | null;
  }>;

  const stores = (storesQuery.data?.data ?? []) as Array<{ id: string; name: string }>;

  const rows =
    activeView === 'TRANSFER'
      ? logs.map((item) => [
          item.batch?.batchCode ?? '-',
          item.batch?.ingredient?.name ?? '-',
          item.user?.fullName ?? '-',
          item.quantityUsed,
          <Badge
            key={item.id}
            label={localizeResultStatus(item.resultStatus)}
            tone={
              item.resultStatus === 'SUCCESS'
                ? 'success'
                : item.resultStatus === 'WARNING'
                  ? 'warning'
                  : 'danger'
            }
          />,
          item.message,
          item.store?.name ?? '-',
          item.destinationStore?.name ?? '-',
          new Date(item.scannedAt).toLocaleString('vi-VN')
        ])
      : logs.map((item) => [
          item.batch?.batchCode ?? '-',
          item.batch?.ingredient?.name ?? '-',
          item.user?.fullName ?? '-',
          item.quantityUsed,
          <Badge
            key={item.id}
            label={localizeResultStatus(item.resultStatus)}
            tone={
              item.resultStatus === 'SUCCESS'
                ? 'success'
                : item.resultStatus === 'WARNING'
                  ? 'warning'
                  : 'danger'
            }
          />,
          item.message,
          item.store?.name ?? '-',
          new Date(item.scannedAt).toLocaleString('vi-VN')
        ]);

  return (
    <ProtectedPage title="Lịch sử quét" allowedRoles={['STAFF', 'MANAGER', 'ADMIN']}>
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap gap-3">
            {availableViews.map((view) => (
              <ButtonLike
                key={view}
                active={activeView === view}
                onClick={() => setActiveView(view)}
                label={localizeOperationType(view)}
              />
            ))}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {activeView === 'STORE_USAGE'
              ? 'Mặc định hiển thị lịch sử nguyên liệu được sử dụng tại quán.'
              : 'Hiển thị các lượt quét chuyển kho, gồm cả chi nhánh thực hiện và chi nhánh nhận.'}
          </p>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Bộ lọc lịch sử</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Mã lô</span>
              <input
                value={batchCode}
                onChange={(event) => setBatchCode(event.target.value)}
                placeholder="BATCH-TRA-001"
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Trạng thái</span>
              <select
                value={resultStatus}
                onChange={(event) => setResultStatus(event.target.value)}
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
              >
                <option value="">Tất cả trạng thái</option>
                <option value="SUCCESS">Thành công</option>
                <option value="WARNING">Cảnh báo</option>
                <option value="ERROR">Lỗi</option>
              </select>
            </label>

            {isAdmin ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-brand-900">Chi nhánh</span>
                <select
                  value={storeId}
                  onChange={(event) => setStoreId(event.target.value)}
                  className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
                >
                  <option value="">Tất cả chi nhánh</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Từ ngày</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Đến ngày</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
              />
            </label>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">
            {activeView === 'TRANSFER'
              ? 'Lịch sử nguyên liệu chuyển kho'
              : 'Lịch sử nguyên liệu sử dụng tại quán'}
          </h2>
          {query.isError ? (
            <p className="mb-4 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">
              {(query.error as Error).message}
            </p>
          ) : null}
          <SimpleTable
            columns={
              activeView === 'TRANSFER'
                ? ['Lô', 'Nguyên liệu', 'Người quét', 'Số lượng', 'Trạng thái', 'Thông báo', 'Chi nhánh thực hiện', 'Chi nhánh nhận', 'Thời gian']
                : ['Lô', 'Nguyên liệu', 'Người quét', 'Số lượng', 'Trạng thái', 'Thông báo', 'Chi nhánh thực hiện', 'Thời gian']
            }
            rows={rows}
          />
        </Card>
      </div>
    </ProtectedPage>
  );
}

function ButtonLike({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? 'rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white'
          : 'rounded-xl bg-white px-4 py-3 text-sm font-semibold text-brand-900 ring-1 ring-brand-100'
      }
    >
      {label}
    </button>
  );
}
