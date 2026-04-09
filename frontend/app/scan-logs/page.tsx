"use client";

import { useQuery } from '@tanstack/react-query';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SimpleTable } from '@/components/ui/table';
import { localizeResultStatus } from '@/lib/localization';
import { listScanLogs } from '@/services/scan';

export default function ScanLogsPage() {
  const query = useQuery({
    queryKey: ['scan-logs'],
    queryFn: () => listScanLogs('')
  });
  const logs = (query.data?.data ?? []) as Array<{
    id: string;
    quantityUsed: number;
    resultStatus: 'SUCCESS' | 'WARNING' | 'ERROR';
    message: string;
    createdAt: string;
    batch?: { batchCode?: string | null } | null;
    user?: { fullName?: string | null } | null;
  }>;

  const rows =
    logs.map((item) => [
      item.batch?.batchCode ?? '-',
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
      new Date(item.createdAt).toLocaleString('vi-VN')
    ]);

  return (
    <ProtectedPage title="Lịch sử quét" allowedRoles={['STAFF', 'MANAGER', 'ADMIN']}>
      <Card>
        <h2 className="mb-4 text-xl font-semibold text-brand-900">Lịch sử quét</h2>
        <SimpleTable
          columns={['Lô', 'Nhân viên', 'Số lượng', 'Trạng thái', 'Thông báo', 'Thời gian']}
          rows={rows}
        />
      </Card>
    </ProtectedPage>
  );
}
