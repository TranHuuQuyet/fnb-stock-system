"use client";

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SimpleTable } from '@/components/ui/table';
import { useResolvedSession } from '@/hooks/use-resolved-session';
import {
  localizeOperationType,
  localizeResultStatus,
  localizeTransferStatus
} from '@/lib/localization';
import { listStores } from '@/services/admin/stores';
import { listScanLogs } from '@/services/scan';
import { confirmTransfer, listTransfers } from '@/services/transfers';

type ScanView = 'STORE_USAGE' | 'TRANSFER';
type TransferDirection = 'ALL' | 'INCOMING' | 'OUTGOING';
type TransferStatus = 'IN_TRANSIT' | 'RECEIVED';

type ScanLogItem = {
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
};

type TransferItem = {
  id: string;
  batchCode: string;
  quantityRequested: number;
  quantityReceived: number | null;
  discrepancyQty: number | null;
  status: TransferStatus;
  requestedAt: string;
  confirmedAt: string | null;
  confirmationNote: string | null;
  canConfirm: boolean;
  ingredient?: { name?: string | null; unit?: string | null } | null;
  sourceStore?: { name?: string | null } | null;
  destinationStore?: { name?: string | null } | null;
  createdByUser?: { fullName?: string | null } | null;
  confirmedByUser?: { fullName?: string | null } | null;
};

const toStartDate = (value: string) =>
  value ? new Date(`${value}T00:00:00`).toISOString() : '';

const toEndDate = (value: string) =>
  value ? new Date(`${value}T23:59:59.999`).toISOString() : '';

const transferStatusTone = (status: TransferStatus) => {
  if (status === 'RECEIVED') {
    return 'success' as const;
  }

  return 'warning' as const;
};

export default function ScanLogsPageContent() {
  const sessionQuery = useResolvedSession();
  const session = sessionQuery.session;
  const isAdmin = session?.user.role === 'ADMIN';
  const isManager = session?.user.role === 'MANAGER';
  const canViewTransfers =
    isAdmin || isManager || (session?.user.permissions ?? []).includes('scan_transfer');

  const availableViews: ScanView[] = canViewTransfers
    ? ['STORE_USAGE', 'TRANSFER']
    : ['STORE_USAGE'];

  const [activeView, setActiveView] = useState<ScanView>('STORE_USAGE');
  const [batchCode, setBatchCode] = useState('');
  const [resultStatus, setResultStatus] = useState('');
  const [transferStatus, setTransferStatus] = useState<TransferStatus | ''>('');
  const [direction, setDirection] = useState<TransferDirection>('ALL');
  const [storeId, setStoreId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeTransferId, setActiveTransferId] = useState<string | null>(null);
  const [receivedQty, setReceivedQty] = useState('');
  const [confirmationNote, setConfirmationNote] = useState('');

  const storesQuery = useQuery({
    queryKey: ['scan-log-stores'],
    queryFn: () => listStores(''),
    enabled: sessionQuery.isSuccess && isAdmin
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();

    if (batchCode.trim()) {
      params.set('batchCode', batchCode.trim());
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

    if (activeView === 'TRANSFER') {
      if (transferStatus) {
        params.set('status', transferStatus);
      }
      if (direction !== 'ALL') {
        params.set('direction', direction);
      }
    } else {
      params.set('operationType', activeView);
      if (resultStatus) {
        params.set('resultStatus', resultStatus);
      }
    }

    return `?${params.toString()}`;
  }, [
    activeView,
    batchCode,
    direction,
    endDate,
    isAdmin,
    resultStatus,
    startDate,
    storeId,
    transferStatus
  ]);

  const query = useQuery({
    queryKey: [activeView === 'TRANSFER' ? 'transfers' : 'scan-logs', queryString],
    queryFn: () =>
      activeView === 'TRANSFER' ? listTransfers(queryString) : listScanLogs(queryString),
    enabled: sessionQuery.isSuccess
  });

  const confirmMutation = useMutation({
    mutationFn: (payload: { id: string; receivedQty: number; note?: string }) =>
      confirmTransfer(payload.id, {
        receivedQty: payload.receivedQty,
        note: payload.note
      }),
    onSuccess: async () => {
      setActiveTransferId(null);
      setReceivedQty('');
      setConfirmationNote('');
      await query.refetch();
    }
  });

  const scanLogs = (query.data?.data ?? []) as ScanLogItem[];
  const transfers = (query.data?.data ?? []) as TransferItem[];
  const stores = (storesQuery.data?.data ?? []) as Array<{ id: string; name: string }>;

  const startConfirming = (item: TransferItem) => {
    setActiveTransferId(item.id);
    setReceivedQty(String(item.quantityRequested));
    setConfirmationNote(item.confirmationNote ?? '');
  };

  const cancelConfirming = () => {
    setActiveTransferId(null);
    setReceivedQty('');
    setConfirmationNote('');
  };

  const handleConfirmTransfer = (item: TransferItem) => {
    const parsedQty = Number(receivedQty);
    if (!Number.isFinite(parsedQty) || parsedQty < 0) {
      return;
    }

    confirmMutation.mutate({
      id: item.id,
      receivedQty: parsedQty,
      note: confirmationNote.trim() || undefined
    });
  };

  const rows =
    activeView === 'TRANSFER'
      ? transfers.map((item) => [
          item.id.slice(0, 8).toUpperCase(),
          item.batchCode,
          item.ingredient?.name ?? '-',
          item.sourceStore?.name ?? '-',
          item.destinationStore?.name ?? '-',
          `${item.quantityRequested}${item.ingredient?.unit ? ` ${item.ingredient.unit}` : ''}`,
          item.quantityReceived === null
            ? '-'
            : `${item.quantityReceived}${item.ingredient?.unit ? ` ${item.ingredient.unit}` : ''}`,
          <div key={`${item.id}-status`} className="space-y-2">
            <Badge
              label={localizeTransferStatus(item.status)}
              tone={transferStatusTone(item.status)}
            />
            {item.discrepancyQty && item.discrepancyQty > 0 ? (
              <p className="text-xs text-amber-700">
                Lệch {item.discrepancyQty}
                {item.ingredient?.unit ? ` ${item.ingredient.unit}` : ''}
              </p>
            ) : null}
          </div>,
          item.createdByUser?.fullName ?? '-',
          new Date(item.requestedAt).toLocaleString('vi-VN'),
          <div key={`${item.id}-action`} className="min-w-[260px] space-y-2">
            {item.canConfirm ? (
              activeTransferId === item.id ? (
                <>
                  <Input
                    label="Số lượng nhận"
                    type="number"
                    min={0}
                    max={item.quantityRequested}
                    value={receivedQty}
                    onChange={(event) => setReceivedQty(event.target.value)}
                  />
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-brand-900">
                      Ghi chú nếu nhận lệch
                    </span>
                    <textarea
                      value={confirmationNote}
                      onChange={(event) => setConfirmationNote(event.target.value)}
                      className="min-h-24 w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900 shadow-sm outline-none"
                      placeholder="Ví dụ: thiếu 1 chai do hỏng khi vận chuyển"
                    />
                  </label>
                  {confirmMutation.isError ? (
                    <p className="text-xs text-danger">
                      {(confirmMutation.error as Error).message}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => handleConfirmTransfer(item)}
                      disabled={confirmMutation.isPending}
                    >
                      {confirmMutation.isPending ? 'Đang xác nhận...' : 'Xác nhận nhận hàng'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={cancelConfirming}
                      disabled={confirmMutation.isPending}
                    >
                      Hủy
                    </Button>
                  </div>
                </>
              ) : (
                <Button type="button" onClick={() => startConfirming(item)}>
                  Xác nhận nhận hàng
                </Button>
              )
            ) : item.status === 'RECEIVED' ? (
              <div className="space-y-1 text-sm text-slate-600">
                <p>
                  Đã xác nhận bởi {item.confirmedByUser?.fullName ?? '-'} lúc{' '}
                  {item.confirmedAt
                    ? new Date(item.confirmedAt).toLocaleString('vi-VN')
                    : '-'}
                </p>
                <p>{item.confirmationNote ? `Ghi chú: ${item.confirmationNote}` : 'Không có ghi chú.'}</p>
              </div>
            ) : (
              <span className="text-sm text-slate-500">Chờ chi nhánh nhận xử lý</span>
            )}
          </div>
        ])
      : scanLogs.map((item) => [
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
              : 'Theo dõi phiếu chuyển kho đang vận chuyển, lịch sử đã nhận và xác nhận số lượng thực nhận tại chi nhánh đích.'}
          </p>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Bộ lọc lịch sử</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Mã lô</span>
              <input
                value={batchCode}
                onChange={(event) => setBatchCode(event.target.value)}
                placeholder="BATCH-TRA-001"
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
              />
            </label>

            {activeView === 'TRANSFER' ? (
              <>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-brand-900">Trạng thái phiếu</span>
                  <select
                    value={transferStatus}
                    onChange={(event) =>
                      setTransferStatus((event.target.value as TransferStatus | '') ?? '')
                    }
                    className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="IN_TRANSIT">Đang vận chuyển</option>
                    <option value="RECEIVED">Đã nhận</option>
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-brand-900">Hướng phiếu</span>
                  <select
                    value={direction}
                    onChange={(event) => setDirection(event.target.value as TransferDirection)}
                    className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="INCOMING">Phiếu nhận vào</option>
                    <option value="OUTGOING">Phiếu gửi đi</option>
                  </select>
                </label>
              </>
            ) : (
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
            )}

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
              ? 'Phiếu chuyển kho'
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
                ? [
                    'Mã phiếu',
                    'Lô',
                    'Nguyên liệu',
                    'Chi nhánh gửi',
                    'Chi nhánh nhận',
                    'SL gửi',
                    'SL nhận',
                    'Trạng thái',
                    'Người tạo',
                    'Thời gian',
                    'Xử lý'
                  ]
                : [
                    'Lô',
                    'Nguyên liệu',
                    'Người quét',
                    'Số lượng',
                    'Trạng thái',
                    'Thông báo',
                    'Chi nhánh thực hiện',
                    'Thời gian'
                  ]
            }
            rows={rows}
            emptyMessage={
              activeView === 'TRANSFER'
                ? 'Chưa có phiếu chuyển kho nào khớp bộ lọc.'
                : 'Chưa có lịch sử quét nào khớp bộ lọc.'
            }
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
