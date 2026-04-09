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
import {
  createWhitelist,
  deleteWhitelist,
  listWhitelists
} from '@/services/config';

const schema = z.object({
  storeId: z.string().min(1),
  type: z.enum(['IP', 'SSID']),
  value: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

export default function AdminWhitelistsPage() {
  const storesQuery = useQuery({
    queryKey: ['whitelist-stores'],
    queryFn: () => listStores('')
  });
  const whitelistsQuery = useQuery({
    queryKey: ['whitelists'],
    queryFn: () => listWhitelists('')
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'IP'
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

  const stores = (storesQuery.data?.data ?? []) as Array<{ id: string; name: string }>;
  const whitelists = (whitelistsQuery.data?.data ?? []) as Array<{
    id: string;
    type: string;
    value: string;
    isActive: boolean;
    store: { name: string };
  }>;

  return (
    <ProtectedPage title="Whitelists" allowedRoles={['ADMIN']}>
      <div className="grid gap-4 xl:grid-cols-[420px,1fr]">
        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Tạo whitelist</h2>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          >
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Store</span>
              <select className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3" {...register('storeId')}>
                <option value="">Select store</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Type</span>
              <select className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3" {...register('type')}>
                <option value="IP">IP</option>
                <option value="SSID">SSID</option>
              </select>
            </label>
            <Input label="Value" error={errors.value?.message} {...register('value')} />
            <Button type="submit" fullWidth disabled={createMutation.isPending}>
              Create whitelist
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Danh sách whitelist</h2>
          <SimpleTable
            columns={['Store', 'Type', 'Value', 'Status', 'Actions']}
            rows={whitelists.map((item) => [
              item.store.name,
              item.type,
              item.value,
              <Badge
                key={item.id}
                label={item.isActive ? 'ACTIVE' : 'INACTIVE'}
                tone={item.isActive ? 'success' : 'warning'}
              />,
              <Button
                key={`${item.id}-delete`}
                variant="danger"
                onClick={() => deleteMutation.mutate(item.id)}
              >
                Delete
              </Button>
            ])}
          />
        </Card>
      </div>
    </ProtectedPage>
  );
}
