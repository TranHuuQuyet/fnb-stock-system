"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SimpleTable } from '@/components/ui/table';
import { localizeRole, localizeUserStatus } from '@/lib/localization';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX
} from '@/lib/password-policy';
import {
  createUser,
  listUsers,
  lockUser,
  resetPassword,
  unlockUser,
  updateUser
} from '@/services/admin/users';
import { listStores } from '@/services/admin/stores';

const schema = z.object({
  username: z.string().min(1, 'Vui lòng nhập tên đăng nhập'),
  fullName: z.string().min(1, 'Vui lòng nhập họ tên'),
  role: z.enum(['MANAGER', 'STAFF']),
  storeId: z.string().min(1, 'Vui lòng chọn chi nhánh'),
  temporaryPassword: z
    .string()
    .min(PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE)
    .regex(PASSWORD_POLICY_REGEX, PASSWORD_POLICY_MESSAGE)
});

type FormValues = z.infer<typeof schema>;

const AVAILABLE_PERMISSIONS = [
  { value: 'view_scan', label: 'Quét nguyên liệu' },
  { value: 'scan_transfer', label: 'Chuyển kho' },
  { value: 'view_profile', label: 'Tài khoản' },
  { value: 'view_scan_logs', label: 'Lịch sử quét' },
  { value: 'manage_users', label: 'Người dùng' },
  { value: 'manage_stores', label: 'Cửa hàng' },
  { value: 'manage_ingredients', label: 'Nguyên liệu' },
  { value: 'manage_batches', label: 'Lô hàng' },
  { value: 'manage_adjustments', label: 'Điều chỉnh tồn' },
  { value: 'manage_config', label: 'Cấu hình' },
  { value: 'manage_whitelists', label: 'Mạng được phép' },
  { value: 'view_audit_logs', label: 'Nhật ký hệ thống' }
];

const DEFAULT_PERMISSIONS_BY_ROLE: Record<'STAFF' | 'MANAGER', string[]> = {
  STAFF: ['view_scan', 'view_profile'],
  MANAGER: ['view_scan', 'view_profile', 'view_scan_logs']
};

type UserRow = {
  id: string;
  username: string;
  fullName: string;
  role: string;
  status: string;
  permissions: string[];
  store?: { name: string } | null;
};

export default function AdminUsersPage() {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [lastResetResult, setLastResetResult] = useState<{
    username: string;
    temporaryPassword: string;
  } | null>(null);

  const storesQuery = useQuery({
    queryKey: ['stores-selector'],
    queryFn: () => listStores('')
  });
  const usersQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => listUsers('')
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: 'STAFF'
    }
  });

  const role = watch('role');

  useEffect(() => {
    setSelectedPermissions(DEFAULT_PERMISSIONS_BY_ROLE[role]);
  }, [role]);

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => createUser({ ...data, permissions: selectedPermissions }),
    onSuccess: () => {
      reset({
        role: 'STAFF',
        username: '',
        fullName: '',
        storeId: '',
        temporaryPassword: ''
      });
      setSelectedPermissions(DEFAULT_PERMISSIONS_BY_ROLE.STAFF);
      usersQuery.refetch();
    }
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      id,
      action,
      username
    }: {
      id: string;
      action: 'lock' | 'unlock' | 'reset';
      username: string;
    }) => {
      if (action === 'lock') {
        await lockUser(id);
        return { action, username };
      }

      if (action === 'unlock') {
        await unlockUser(id);
        return { action, username };
      }

      const resetResult = (await resetPassword(id)) as {
        userId: string;
        temporaryPassword: string;
      };

      return {
        action,
        username,
        userId: resetResult.userId,
        temporaryPassword: resetResult.temporaryPassword
      };
    },
    onSuccess: (data) => {
      if (
        data.action === 'reset' &&
        'temporaryPassword' in data &&
        typeof data.temporaryPassword === 'string'
      ) {
        setLastResetResult({
          username: data.username,
          temporaryPassword: data.temporaryPassword
        });
      } else {
        setLastResetResult(null);
      }

      usersQuery.refetch();
    }
  });

  const transferPermissionMutation = useMutation({
    mutationFn: async ({
      id,
      permissions
    }: {
      id: string;
      permissions: string[];
    }) => updateUser(id, { permissions }),
    onSuccess: () => usersQuery.refetch()
  });

  const stores = (storesQuery.data?.data ?? []) as Array<{ id: string; name: string }>;
  const users = (usersQuery.data?.data ?? []) as UserRow[];

  return (
    <ProtectedPage title="Quản lý người dùng" allowedRoles={['ADMIN']}>
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px),minmax(0,1fr)]">
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
              <select
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3"
                {...register('role')}
              >
                <option value="STAFF">Nhân viên</option>
                <option value="MANAGER">Quản lý</option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Cửa hàng</span>
              <select
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3"
                {...register('storeId')}
              >
                <option value="">Chọn cửa hàng</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="space-y-2">
              <span className="text-sm font-medium text-brand-900">Thêm quyền truy cập</span>
              <div className="space-y-2 rounded-xl border border-brand-100 bg-white p-3">
                {AVAILABLE_PERMISSIONS.map((permission) => (
                  <label key={permission.value} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedPermissions.includes(permission.value)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedPermissions((current) => [...current, permission.value]);
                          return;
                        }

                        setSelectedPermissions((current) =>
                          current.filter((item) => item !== permission.value)
                        );
                      }}
                      className="rounded border-brand-100"
                    />
                    <span className="text-sm text-brand-900">{permission.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Input
              label="Mật khẩu tạm thời"
              type="password"
              error={errors.temporaryPassword?.message}
              {...register('temporaryPassword')}
            />
            <p className="-mt-2 text-xs text-slate-500">
              Dùng ít nhất {PASSWORD_MIN_LENGTH} ký tự, có chữ hoa, chữ thường và số.
            </p>

            {createMutation.error ? (
              <p className="text-sm text-danger">{createMutation.error.message}</p>
            ) : null}

            <Button type="submit" fullWidth disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo người dùng'}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Danh sách tài khoản</h2>
          {lastResetResult ? (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Đã tạo mật khẩu tạm mới cho <span className="font-semibold">{lastResetResult.username}</span>:
              <span className="ml-2 rounded bg-white px-2 py-1 font-mono text-brand-900">
                {lastResetResult.temporaryPassword}
              </span>
            </div>
          ) : null}
          <SimpleTable
            columns={[
              'Tên đăng nhập',
              'Họ tên',
              'Vai trò',
              'Trạng thái',
              'Cửa hàng',
              'Chuyển kho',
              'Thao tác'
            ]}
            rows={users.map((user) => {
              const hasTransferPermission = user.permissions.includes('scan_transfer');
              const nextPermissions = hasTransferPermission
                ? user.permissions.filter((permission) => permission !== 'scan_transfer')
                : [...user.permissions, 'scan_transfer'];

              return [
                user.username,
                user.fullName,
                localizeRole(user.role),
                <Badge
                  key={`${user.id}-status`}
                  label={localizeUserStatus(user.status)}
                  tone={user.status === 'ACTIVE' ? 'success' : 'warning'}
                />,
                user.store?.name ?? '-',
                <div key={`${user.id}-transfer`} className="flex items-center gap-2">
                  <Badge
                    label={hasTransferPermission ? 'Đã cấp' : 'Chưa cấp'}
                    tone={hasTransferPermission ? 'success' : 'neutral'}
                  />
                  {user.role !== 'ADMIN' ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        transferPermissionMutation.mutate({
                          id: user.id,
                          permissions: nextPermissions
                        })
                      }
                      disabled={transferPermissionMutation.isPending}
                    >
                      {hasTransferPermission ? 'Thu hồi' : 'Cấp quyền'}
                    </Button>
                  ) : null}
                </div>,
                <div key={`${user.id}-actions`} className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      actionMutation.mutate({
                        id: user.id,
                        action: 'reset',
                        username: user.username
                      })
                    }
                    disabled={actionMutation.isPending}
                  >
                    Đặt lại mật khẩu
                  </Button>
                  {user.status === 'LOCKED' ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        actionMutation.mutate({
                          id: user.id,
                          action: 'unlock',
                          username: user.username
                        })
                      }
                      disabled={actionMutation.isPending}
                    >
                      Mở khóa
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={() =>
                        actionMutation.mutate({
                          id: user.id,
                          action: 'lock',
                          username: user.username
                        })
                      }
                      disabled={actionMutation.isPending}
                    >
                      Khóa
                    </Button>
                  )}
                </div>
              ];
            })}
          />
        </Card>
      </div>
    </ProtectedPage>
  );
}
