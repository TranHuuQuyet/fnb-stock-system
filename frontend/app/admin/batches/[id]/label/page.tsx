"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Card } from '@/components/ui/card';

export default function BatchLabelPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/admin/batches/${params.id}/print`);
  }, [params.id, router]);

  return (
    <ProtectedPage title="Tem nhãn lô hàng" allowedRoles={['ADMIN']}>
      <Card className="mx-auto max-w-xl rounded-[24px] border border-slate-200 p-6 text-sm text-slate-600">
        Đang chuyển sang màn in tem mới với Number tuần tự và QR riêng cho từng tem...
      </Card>
    </ProtectedPage>
  );
}
