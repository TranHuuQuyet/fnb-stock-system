"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SimpleTable } from '@/components/ui/table';
import { localizeUserStatus } from '@/lib/localization';
import { createStore, deleteStore, listStores, updateStore } from '@/services/admin/stores';

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().min(1),
  isActive: z.boolean().default(true)
});

type FormValues = z.infer<typeof schema>;

type StoreRow = {
  id: string;
  code: string;
  name: string;
  timezone: string;
  isActive: boolean;
};

export default function AdminStoresPage() {
  const [deleteTarget, setDeleteTarget] = useState<StoreRow | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: () => listStores('')
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      timezone: 'Asia/Ho_Chi_Minh',
      isActive: true
    }
  });

  const createMutation = useMutation({
    mutationFn: createStore,
    onSuccess: () => {
      reset();
      storesQuery.refetch();
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateStore(id, { isActive }),
    onSuccess: () => storesQuery.refetch()
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id, adminPassword }: { id: string; adminPassword: string }) =>
      deleteStore(id, adminPassword),
    onSuccess: () => {
      setDeleteTarget(null);
      setDeletePassword('');
      storesQuery.refetch();
    }
  });

  const openDeleteDialog = (store: StoreRow) => {
    deleteMutation.reset();
    setDeleteTarget(store);
    setDeletePassword('');
  };

  const closeDeleteDialog = () => {
    if (deleteMutation.isPending) {
      return;
    }

    setDeleteTarget(null);
    setDeletePassword('');
  };

  const stores = (storesQuery.data?.data ?? []) as StoreRow[];

  return (
    <ProtectedPage title="Quản lý cửa hàng" allowedRoles={['ADMIN']}>
      <div className="grid gap-4 xl:grid-cols-[minmax(300px,380px),minmax(0,1fr)]">
        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Tạo cửa hàng</h2>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          >
            <Input label="Mã cửa hàng" error={errors.code?.message} {...register('code')} />
            <Input label="Tên cửa hàng" error={errors.name?.message} {...register('name')} />
            <Input label="Múi giờ" error={errors.timezone?.message} {...register('timezone')} />
            <Button type="submit" fullWidth disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo cửa hàng'}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Danh sách cửa hàng</h2>
          <SimpleTable
            columns={['Mã', 'Tên', 'Múi giờ', 'Trạng thái', 'Thao tác']}
            rows={stores.map((store) => [
              store.code,
              store.name,
              store.timezone,
              <Badge
                key={store.id}
                label={localizeUserStatus(store.isActive ? 'ACTIVE' : 'INACTIVE')}
                tone={store.isActive ? 'success' : 'warning'}
              />,
              <Button
                key={`${store.id}-toggle`}
                variant={store.isActive ? 'danger' : 'secondary'}
                onClick={() => {
                  if (store.isActive) {
                    openDeleteDialog(store);
                    return;
                  }

                  toggleMutation.mutate({ id: store.id, isActive: true });
                }}
                disabled={deleteMutation.isPending || toggleMutation.isPending}
              >
                {store.isActive ? 'Xóa' : 'Kích hoạt'}
              </Button>
            ])}
          />
        </Card>
      </div>
      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-store-title"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h3 id="delete-store-title" className="text-lg font-semibold text-brand-900">
              Xóa mềm cửa hàng
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Cửa hàng <span className="font-semibold text-brand-900">{deleteTarget.name}</span> sẽ chuyển sang không hoạt động. Lịch sử lô, quét, audit và dữ liệu cũ vẫn được giữ lại.
            </p>
            <div className="mt-4">
              <Input
                label="Mật khẩu Admin"
                type="password"
                value={deletePassword}
                onChange={(event) => setDeletePassword(event.target.value)}
                autoComplete="current-password"
                autoFocus
              />
            </div>
            {deleteMutation.error ? (
              <p className="mt-3 text-sm text-danger">{deleteMutation.error.message}</p>
            ) : null}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={closeDeleteDialog} disabled={deleteMutation.isPending}>
                Hủy
              </Button>
              <Button
                variant="danger"
                onClick={() =>
                  deleteMutation.mutate({
                    id: deleteTarget.id,
                    adminPassword: deletePassword
                  })
                }
                disabled={deleteMutation.isPending || deletePassword.trim().length === 0}
              >
                {deleteMutation.isPending ? 'Đang xóa...' : 'Xác nhận xóa'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </ProtectedPage>
  );
}
