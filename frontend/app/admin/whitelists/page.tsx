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
import { listStores } from '@/services/admin/stores';
import { getScanNetworkStatus } from '@/services/scan';
import {
  createWhitelist,
  deleteWhitelist,
  listNetworkBypasses,
  listWhitelists,
  updateNetworkBypass
} from '@/services/config';

const schema = z.object({
  storeId: z.string().min(1),
  type: z.literal('IP'),
  value: z.string().min(1)
});

const bypassSchema = z.object({
  storeId: z.string().min(1),
  expiresAt: z.string().min(1),
  reason: z.string().optional()
});

type FormValues = z.infer<typeof schema>;
type BypassFormValues = z.infer<typeof bypassSchema>;

export default function AdminWhitelistsPage() {
  const storesQuery = useQuery({
    queryKey: ['whitelist-stores'],
    queryFn: () => listStores('')
  });
  const whitelistsQuery = useQuery({
    queryKey: ['whitelists'],
    queryFn: () => listWhitelists('')
  });
  const networkBypassesQuery = useQuery({
    queryKey: ['network-bypasses'],
    queryFn: () => listNetworkBypasses()
  });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'IP'
    }
  });
  const selectedStoreId = watch('storeId');
  const selectedType = watch('type');
  const {
    register: registerBypass,
    handleSubmit: handleSubmitBypass,
    reset: resetBypass,
    formState: { errors: bypassErrors }
  } = useForm<BypassFormValues>({
    resolver: zodResolver(bypassSchema),
    defaultValues: {
      storeId: '',
      expiresAt: '',
      reason: ''
    }
  });

  const createMutation = useMutation({
    mutationFn: createWhitelist,
    onSuccess: () => {
      reset();
      whitelistsQuery.refetch();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWhitelist,
    onSuccess: () => whitelistsQuery.refetch()
  });

  const detectNetworkMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStoreId) {
        throw new Error('Hay chon cua hang truoc khi lay IP hien tai');
      }

      return getScanNetworkStatus(`?storeId=${encodeURIComponent(selectedStoreId)}`);
    },
    onSuccess: (data) => {
      setValue('value', data.normalizedIpAddress, {
        shouldDirty: true,
        shouldValidate: true
      });
    }
  });

  const enableBypassMutation = useMutation({
    mutationFn: (values: BypassFormValues) =>
      updateNetworkBypass(values.storeId, {
        enabled: true,
        expiresAt: new Date(values.expiresAt).toISOString(),
        reason: values.reason?.trim() || null
      }),
    onSuccess: () => {
      resetBypass();
      networkBypassesQuery.refetch();
    }
  });

  const disableBypassMutation = useMutation({
    mutationFn: (storeId: string) =>
      updateNetworkBypass(storeId, {
        enabled: false,
        expiresAt: null,
        reason: null
      }),
    onSuccess: () => networkBypassesQuery.refetch()
  });

  const stores = (storesQuery.data?.data ?? []) as Array<{ id: string; name: string }>;
  const whitelists = (whitelistsQuery.data?.data ?? []) as Array<{
    id: string;
    type: string;
    value: string;
    isActive: boolean;
    store: { name: string };
  }>;
  const networkBypasses = (networkBypassesQuery.data?.data ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    networkBypassEnabled: boolean;
    networkBypassExpiresAt: string | null;
    networkBypassReason: string | null;
    bypassActive: boolean;
  }>;

  return (
    <ProtectedPage title="Mạng được phép" allowedRoles={['ADMIN']}>
      <div className="space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px),minmax(0,1fr)]">
          <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Thêm mạng được phép</h2>
          <p className="mb-4 text-sm text-slate-600">
            Dùng IP whitelist khi muốn chỉ cho phép nhân viên quét trên đúng mạng của quán.
            Admin nên mở trang này trên thiết bị đang kết nối vào Wi-Fi của quán rồi bấm
            &nbsp;`Lấy IP hiện tại`.
          </p>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          >
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
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Loại</span>
              <select className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3" {...register('type')}>
                <option value="IP">IP</option>
              </select>
            </label>
            <Input label="Giá trị" error={errors.value?.message} {...register('value')} />
            {selectedType === 'IP' ? (
              <div className="space-y-3 rounded-2xl bg-brand-50 p-4 text-sm text-slate-700">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!selectedStoreId || detectNetworkMutation.isPending}
                  onClick={() => detectNetworkMutation.mutate()}
                >
                  {detectNetworkMutation.isPending ? 'Đang lấy IP...' : 'Lấy IP hiện tại'}
                </Button>
                <p>
                  Nút này lấy IP theo cách backend thực sự nhìn thấy request của thiết bị admin
                  hiện tại.
                </p>
                {detectNetworkMutation.data ? (
                  <div className="rounded-xl bg-white p-3">
                    <p>IP backend nhận: {detectNetworkMutation.data.ipAddress}</p>
                    <p>Giá trị để whitelist: {detectNetworkMutation.data.normalizedIpAddress}</p>
                  </div>
                ) : null}
                {detectNetworkMutation.error ? (
                  <p className="text-danger">
                    {(detectNetworkMutation.error as Error).message}
                  </p>
                ) : null}
                <p>
                  Staff dùng cùng mạng/router mà backend thấy cùng IP này thì quét được. Ở mạng
                  khác thì sẽ bị chặn.
                </p>
                <p>
                  Test bằng cùng một máy qua localhost hoặc Docker thường sẽ hiện IP local/bridge.
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Trên web browser, SSID không phải cách kiểm tra ổn định. Muốn chặn theo mạng thì
                nên ưu tiên IP whitelist.
              </p>
            )}
            <Button type="submit" fullWidth disabled={createMutation.isPending}>
              Thêm mục
            </Button>
          </form>
        </Card>

          <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Danh sách mạng được phép</h2>
          <SimpleTable
            columns={['Cửa hàng', 'Loại', 'Giá trị', 'Trạng thái', 'Thao tác']}
            rows={whitelists.map((item) => [
              item.store.name,
              item.type,
              item.value,
              <Badge
                key={item.id}
                label={item.isActive ? 'Hoạt động' : 'Ngừng hoạt động'}
                tone={item.isActive ? 'success' : 'warning'}
              />,
              <Button
                key={`${item.id}-delete`}
                variant="danger"
                onClick={() => deleteMutation.mutate(item.id)}
              >
                Xóa
              </Button>
            ])}
          />
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px),minmax(0,1fr)]">
          <Card>
            <h2 className="mb-4 text-xl font-semibold text-brand-900">Emergency bypass</h2>
            <p className="mb-4 text-sm text-slate-600">
              Chỉ bật tạm khi mạng của chi nhánh đổi đột xuất. Bypass sẽ tự hết hiệu lực
              theo thời điểm bạn đặt.
            </p>
            <form
              className="space-y-4"
              onSubmit={handleSubmitBypass((values) => enableBypassMutation.mutate(values))}
            >
              <label className="block space-y-2">
                <span className="text-sm font-medium text-brand-900">Cửa hàng</span>
                <select
                  className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3"
                  {...registerBypass('storeId')}
                >
                  <option value="">Chọn cửa hàng</option>
                  {stores.map((store) => (
                    <option key={`bypass-${store.id}`} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
                {bypassErrors.storeId ? (
                  <span className="text-xs text-danger">{bypassErrors.storeId.message}</span>
                ) : null}
              </label>
              <Input
                label="Hết hiệu lực lúc"
                type="datetime-local"
                error={bypassErrors.expiresAt?.message}
                {...registerBypass('expiresAt')}
              />
              <Input
                label="Lý do"
                placeholder="VD: ISP đổi IP của chi nhánh"
                error={bypassErrors.reason?.message}
                {...registerBypass('reason')}
              />
              <Button type="submit" fullWidth disabled={enableBypassMutation.isPending}>
                {enableBypassMutation.isPending ? 'Đang bật bypass...' : 'Bật bypass tạm thời'}
              </Button>
            </form>
          </Card>

          <Card>
            <h2 className="mb-4 text-xl font-semibold text-brand-900">
              Trạng thái bypass theo chi nhánh
            </h2>
            <SimpleTable
              columns={['Cửa hàng', 'Trạng thái', 'Hết hiệu lực', 'Lý do', 'Thao tác']}
              rows={networkBypasses.map((item) => [
                item.name,
                <Badge
                  key={`${item.id}-status`}
                  label={
                    item.bypassActive
                      ? 'Đang bật'
                      : item.networkBypassEnabled
                        ? 'Đã hết hạn'
                        : 'Đang tắt'
                  }
                  tone={
                    item.bypassActive
                      ? 'warning'
                      : item.networkBypassEnabled
                        ? 'danger'
                        : 'neutral'
                  }
                />,
                item.networkBypassExpiresAt
                  ? new Date(item.networkBypassExpiresAt).toLocaleString('vi-VN')
                  : '-',
                item.networkBypassReason ?? '-',
                <Button
                  key={`${item.id}-disable`}
                  variant="secondary"
                  disabled={!item.networkBypassEnabled || disableBypassMutation.isPending}
                  onClick={() => disableBypassMutation.mutate(item.id)}
                >
                  Tắt bypass
                </Button>
              ])}
            />
          </Card>
        </div>
      </div>
    </ProtectedPage>
  );
}
