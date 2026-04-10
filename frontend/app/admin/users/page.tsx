"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useEffect, useState } from 'react';

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
  temporaryPassword: z.string().min(6),
  permissions: z.array(z.string()).default([])
});

type FormValues = z.infer<typeof schema>;


const AVAILABLE_PERMISSIONS = [
  { value: 'view_scan', label: 'Quét nguyên liệu' },
  { value: 'view_profile', label: 'Tài khoản' },
  { value: 'view_scan_logs', label: 'Lịch sử quét' },
  { value: 'view_dashboard', label: 'Bảng điều khiển' },
  { value: 'manage_users', label: 'Người dùng' },
  { value: 'manage_stores', label: 'Cửa hàng' },
  { value: 'manage_ingredients', label: 'Nguyên liệu' },
  { value: 'manage_batches', label: 'Lô hàng' },
  { value: 'manage_adjustments', label: 'Điều chỉnh tồn' },
  { value: 'manage_recipes', label: 'Công thức & POS' },
  { value: 'manage_config', label: 'Cấu hình' },
  { value: 'manage_whitelists', label: 'Mạng được phép' },
  { value: 'view_audit_logs', label: 'Nhật ký hệ thống' }
];

const DEFAULT_PERMISSIONS_BY_ROLE: Record<'STAFF' | 'MANAGER', string[]> = {
  STAFF: ['view_scan', 'view_profile'],
  MANAGER: ['view_scan', 'view_profile', 'view_scan_logs', 'view_dashboard']
};

export default function AdminUsersPage() {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const storesQuery = useQuery({
    queryKey: ['stores-selector'],
    queryFn: () => listStores('')
  });
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => listUsers('')
  });

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'STAFF',
      permissions: []
    }
  });

  const role = watch('role');

  useEffect(() => {
    setSelectedPermissions(DEFAULT_PERMISSIONS_BY_ROLE[role]);
  }, [role]);

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => createUser({ ...data, permissions: selectedPermissions }),
    onSuccess: () => {
      reset();
      setSelectedPermissions([]);
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
            <div className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Thêm quyền truy cập</span>
              <div className="space-y-2 rounded-xl border border-brand-100 bg-white p-3">
                {AVAILABLE_PERMISSIONS.map((permission) => (
                  <label key={permission.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(permission.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPermissions([...selectedPermissions, permission.value]);
                        } else {
                          setSelectedPermissions(selectedPermissions.filter((p) => p !== permission.value));
                        }
                      }}
                      className="rounded border-brand-100"
                    />
                    <span className="text-sm text-brand-900">{permission.label}</span>
                  </label>
                ))}
              </div>
            </div>
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
