"use client";

import { useQuery } from '@tanstack/react-query';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Card } from '@/components/ui/card';
import { SimpleTable } from '@/components/ui/table';
import { listAuditLogs } from '@/services/config';

export default function AdminAuditLogsPage() {
  const query = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => listAuditLogs('')
  });

  const logs = (query.data?.data ?? []) as Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    actorUser?: { username: string } | null;
    createdAt: string;
  }>;

  return (
    <ProtectedPage title="Nhật ký hệ thống" allowedRoles={['ADMIN']}>
      <Card>
        <h2 className="mb-4 text-xl font-semibold text-brand-900">Nhật ký hệ thống</h2>
        <SimpleTable
          columns={['Hành động', 'Đối tượng', 'Mã đối tượng', 'Người thực hiện', 'Thời gian']}
          rows={logs.map((item) => [
            item.action,
            item.entityType,
            item.entityId,
            item.actorUser?.username ?? '-',
            new Date(item.createdAt).toLocaleString('vi-VN')
          ])}
        />
      </Card>
    </ProtectedPage>
  );
}
