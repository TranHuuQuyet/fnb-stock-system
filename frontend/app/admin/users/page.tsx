"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SimpleTable } from '@/components/ui/table';
import { localizeRole, localizeUserStatus } from '@/lib/localization';
import { createUser, listUsers, lockUser, resetPassword, unlockUser } from '@/services/admin/users';
import { listStores } from '@/services/admin/stores';

const schema = z.object({
  username: z.string().min(1),
  fullName: z.string().min(1),
  role: z.enum(['MANAGER', 'STAFF']),
  storeId: z.string().min(1),
  temporaryPassword: z.string().min(6)
});

type FormValues = z.infer<typeof schema>;

export default function AdminUsersPage() {
  const storesQuery = useQuery({
    queryKey: ['stores-selector'],
    queryFn: () => listStores('')
  });
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => listUsers('')
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'STAFF'
    }
  });

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      reset();
      usersQuery.refetch();
    }
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'lock' | 'unlock' | 'reset' }) => {
      if (action === 'lock') return lockUser(id);
      if (action === 'unlock') return unlockUser(id);
      return resetPassword(id, '123456');
    },
    onSuccess: () => usersQuery.refetch()
  });

  const stores = (storesQuery.data?.data ?? []) as Array<{ id: string; name: string }>;
  const users = (usersQuery.data?.data ?? []) as Array<{
    id: string;
    username: string;
    fullName: string;
    role: string;
    status: string;
    store?: { name: string } | null;
  }>;

  return (
    <ProtectedPage title="Quản lý người dùng" allowedRoles={['ADMIN']}>
      <div className="grid gap-4 xl:grid-cols-[420px,1fr]">
        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Tạo người dùng mới</h2>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          >
            <Input label="Tên đăng nhập" error={errors.username?.message} {...register('username')} />
            <Input label="Họ tên" error={errors.fullName?.message} {...register('fullName')} />
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Vai trò</span>
              <select className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3" {...register('role')}>
                <option value="STAFF">Nhân viên</option>
                <option value="MANAGER">Quản lý</option>
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Cửa hàng</span>
              <select className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3" {...register('storeId')}>
                <option value="">Chọn cửa hàng</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Mật khẩu tạm thời"
              type="password"
              error={errors.temporaryPassword?.message}
              {...register('temporaryPassword')}
            />
            <Button type="submit" fullWidth disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo người dùng'}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Danh sách tài khoản</h2>
          <SimpleTable
            columns={['Tên đăng nhập', 'Họ tên', 'Vai trò', 'Trạng thái', 'Cửa hàng', 'Thao tác']}
            rows={users.map((user) => [
              user.username,
              user.fullName,
              localizeRole(user.role),
              <Badge
                key={`${user.id}-status`}
                label={localizeUserStatus(user.status)}
                tone={user.status === 'ACTIVE' ? 'success' : 'warning'}
              />,
              user.store?.name ?? '-',
              <div key={`${user.id}-actions`} className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => actionMutation.mutate({ id: user.id, action: 'reset' })}
                >
                  Đặt lại mật khẩu
                </Button>
                {user.status === 'LOCKED' ? (
                  <Button
                    variant="secondary"
                    onClick={() => actionMutation.mutate({ id: user.id, action: 'unlock' })}
                  >
                    Mở khóa
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    onClick={() => actionMutation.mutate({ id: user.id, action: 'lock' })}
                  >
                    Khóa
                  </Button>
                )}
              </div>
            ])}
          />
        </Card>
      </div>
    </ProtectedPage>
  );
}
