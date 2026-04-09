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
import { localizeBatchStatus } from '@/lib/localization';
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
        return softLockBatch(id, 'Khóa mềm thủ công bởi quản trị viên');
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
    <ProtectedPage title="Quản lý lô hàng" allowedRoles={['ADMIN']}>
      <div className="grid gap-4 xl:grid-cols-[420px,1fr]">
        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Tạo lô hàng</h2>
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
              <span className="text-sm font-medium text-brand-900">Nguyên liệu</span>
              <select className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3" {...register('ingredientId')}>
                <option value="">Chọn nguyên liệu</option>
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Mã lô" error={errors.batchCode?.message} {...register('batchCode')} />
            <Input label="Ngày nhập" type="datetime-local" error={errors.receivedAt?.message} {...register('receivedAt')} />
            <Input label="Ngày hết hạn" type="datetime-local" {...register('expiredAt')} />
            <Input label="Số lượng ban đầu" type="number" step="0.001" error={errors.initialQty?.message} {...register('initialQty')} />
            <Button type="submit" fullWidth disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo lô'}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Danh sách lô hàng</h2>
          <SimpleTable
            columns={['Mã lô', 'Nguyên liệu', 'Cửa hàng', 'Tồn còn lại', 'Trạng thái', 'Thao tác']}
            rows={batches.map((batch) => [
              batch.batchCode,
              batch.ingredient.name,
              batch.store.name,
              batch.remainingQty,
              <Badge
                key={batch.id}
                label={localizeBatchStatus(batch.status)}
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
                  Tạo QR
                </Button>
                <Link
                  href={`/admin/batches/${batch.id}/print?print=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-brand-900 ring-1 ring-brand-100 transition hover:bg-brand-50"
                >
                  In tem
                </Link>
                {batch.status === 'SOFT_LOCKED' ? (
                  <Button
                    variant="secondary"
                    onClick={() => actionMutation.mutate({ id: batch.id, action: 'unlock' })}
                  >
                    Mở khóa
                  </Button>
                ) : (
                  <Button
                    variant="danger"
                    onClick={() => actionMutation.mutate({ id: batch.id, action: 'lock' })}
                  >
                    Khóa mềm
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
