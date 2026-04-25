"use client";

import { ProtectedPage } from '@/components/layout/protected-page';

export default function AdminRecipesPage() {
  return (
    <ProtectedPage title="Đang chuyển hướng" allowedRoles={['ADMIN']}>
      {null}
    </ProtectedPage>
  );
}
