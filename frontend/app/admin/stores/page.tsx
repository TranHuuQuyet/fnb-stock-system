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
import { createStore, listStores, updateStore } from '@/services/admin/stores';

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  timezone: z.string().min(1),
  isActive: z.boolean().default(true)
});

type FormValues = z.infer<typeof schema>;

export default function AdminStoresPage() {
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
      updateStore(id, { isActive: !isActive }),
    onSuccess: () => storesQuery.refetch()
  });

  const stores = (storesQuery.data?.data ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    timezone: string;
    isActive: boolean;
  }>;

  return (
    <ProtectedPage title="Admin Stores" allowedRoles={['ADMIN']}>
      <div className="grid gap-4 xl:grid-cols-[380px,1fr]">
        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Tạo store</h2>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          >
            <Input label="Code" error={errors.code?.message} {...register('code')} />
            <Input label="Name" error={errors.name?.message} {...register('name')} />
            <Input label="Timezone" error={errors.timezone?.message} {...register('timezone')} />
            <Button type="submit" fullWidth disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create store'}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Danh sách cửa hàng</h2>
          <SimpleTable
            columns={['Code', 'Name', 'Timezone', 'Status', 'Actions']}
            rows={stores.map((store) => [
              store.code,
              store.name,
              store.timezone,
              <Badge
                key={store.id}
                label={store.isActive ? 'ACTIVE' : 'INACTIVE'}
                tone={store.isActive ? 'success' : 'warning'}
              />,
              <Button
                key={`${store.id}-toggle`}
                variant="secondary"
                onClick={() => toggleMutation.mutate({ id: store.id, isActive: store.isActive })}
              >
                {store.isActive ? 'Disable' : 'Enable'}
              </Button>
            ])}
          />
        </Card>
      </div>
    </ProtectedPage>
  );
}
