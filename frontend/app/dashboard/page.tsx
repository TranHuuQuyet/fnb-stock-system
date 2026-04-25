"use client";

import { ProtectedPage } from '@/components/layout/protected-page';

export default function DashboardPage() {
  return (
    <ProtectedPage title="Đang chuyển hướng" allowedRoles={['MANAGER', 'ADMIN']}>
      {null}
    </ProtectedPage>
  );
}
