"use client";

import Link from 'next/link';
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
import { listIngredients } from '@/services/admin/ingredients';
import { listStores } from '@/services/admin/stores';
import {
  createBatch,
  generateBatchQr,
  listBatches,
  softLockBatch,
  unlockBatch
} from '@/services/batches';

const schema = z.object({
  ingredientId: z.string().min(1),
  storeId: z.string().min(1),
  batchCode: z.string().min(1),
  receivedAt: z.string().min(1),
  expiredAt: z.string().optional(),
  initialQty: z.coerce.number().positive()
});

type FormValues = z.infer<typeof schema>;

export default function AdminBatchesPage() {
  const storesQuery = useQuery({
    queryKey: ['stores-options'],
    queryFn: () => listStores('')
  });
  const ingredientsQuery = useQuery({
    queryKey: ['ingredients-options'],
    queryFn: () => listIngredients('')
  });
  const batchesQuery = useQuery({
    queryKey: ['admin-batches'],
    queryFn: () => listBatches('')
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      createBatch({
        ...values,
        expiredAt: values.expiredAt || undefined
      }),
    onSuccess: () => {
      reset();
      batchesQuery.refetch();
    }
  });

  const actionMutation = useMutation({
    mutationFn: async ({
      id,
      action
    }: {
      id: string;
      action: 'generate' | 'lock' | 'unlock';
    }) => {
      if (action === 'generate') {
        return generateBatchQr(id);
      }
      if (action === 'lock') {
        return softLockBatch(id, 'Manual soft lock by admin');
      }
      return unlockBatch(id);
    },
    onSuccess: () => batchesQuery.refetch()
  });

  const stores = (storesQuery.data?.data ?? []) as Array<{ id: string; name: string }>;
  const ingredients = (ingredientsQuery.data?.data ?? []) as Array<{
    id: string;
    name: string;
  }>;
  const batches = (batchesQuery.data?.data ?? []) as Array<{
    id: string;
    batchCode: string;
    receivedAt: string;
    remainingQty: number;
    status: string;
    ingredient: { name: string };
    store: { name: string };
  }>;

  return (
    <ProtectedPage title="Admin Batches" allowedRoles={['ADMIN']}>
      <div className="grid gap-4 xl:grid-cols-[420px,1fr]">
        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Tạo batch</h2>
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
              <span className="text-sm font-medium text-brand-900">Ingredient</span>
              <select className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3" {...register('ingredientId')}>
                <option value="">Select ingredient</option>
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Batch code" error={errors.batchCode?.message} {...register('batchCode')} />
            <Input label="Received at" type="datetime-local" error={errors.receivedAt?.message} {...register('receivedAt')} />
            <Input label="Expired at" type="datetime-local" {...register('expiredAt')} />
            <Input label="Initial qty" type="number" step="0.001" error={errors.initialQty?.message} {...register('initialQty')} />
            <Button type="submit" fullWidth disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Creating...' : 'Create batch'}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Danh sách batch</h2>
          <SimpleTable
            columns={['Batch', 'Ingredient', 'Store', 'Remaining', 'Status', 'Actions']}
            rows={batches.map((batch) => [
              batch.batchCode,
              batch.ingredient.name,
              batch.store.name,
              batch.remainingQty,
              <Badge
                key={batch.id}
                label={batch.status}
                tone={
                  batch.status === 'ACTIVE'
                    ? 'success'
                    : batch.status === 'SOFT_LOCKED'
                      ? 'warning'
                      : 'danger'
                }
              />,
              <div key={`${batch.id}-actions`} className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => actionMutation.mutate({ id: batch.id, action: 'generate' })}
                >
                  Generate QR
                </Button>
                <Link href={`/admin/batches/${batch.id}/label`}>
                  <Button variant="secondary">Print label</Button>
                </Link>
                {batch.status === 'SOFT_LOCKED' ? (
                  <Button
                    variant="secondary"
                    onClick={() => actionMutation.mutate({ id: batch.id, action: 'unlock' })}
                  >
                    Unlock
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    onClick={() => actionMutation.mutate({ id: batch.id, action: 'lock' })}
                  >
                    Soft lock
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
