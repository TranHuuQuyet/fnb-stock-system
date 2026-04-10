"use client";

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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

const getMaxPrintableLabels = (initialQty: number) => Math.max(0, Math.floor(initialQty));
const getRequestedPrintQuantity = (value?: string) => {
  const parsed = Number.parseInt(value ?? '1', 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
};

export default function AdminBatchesPageContent() {
  const [printQtyByBatch, setPrintQtyByBatch] = useState<Record<string, string>>({});
  const [selectedListStoreId, setSelectedListStoreId] = useState('');

  const storesQuery = useQuery({
    queryKey: ['stores-options'],
    queryFn: () => listStores('')
  });
  const ingredientsQuery = useQuery({
    queryKey: ['ingredients-options'],
    queryFn: () => listIngredients('')
  });
  const batchesQuery = useQuery({
    queryKey: ['admin-batches', selectedListStoreId],
    queryFn: () =>
      listBatches(
        selectedListStoreId ? `?storeId=${encodeURIComponent(selectedListStoreId)}` : ''
      )
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const createMutation = useMutation({
    mutationFn: (values: FormValues) =>
      createBatch({
        ...values,
        expiredAt: values.expiredAt || undefined
      }),
    onSuccess: () => {
      reset(selectedListStoreId ? { storeId: selectedListStoreId } : undefined);
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
    unit?: string | null;
  }>;
  const batches = (batchesQuery.data?.data ?? []) as Array<{
    id: string;
    batchCode: string;
    receivedAt: string;
    initialQty: number;
    remainingQty: number;
    printedLabelCount: number;
    status: string;
    ingredient: { id: string; name: string; unit?: string | null };
    store: { id: string; name: string };
  }>;

  const inventorySummary = useMemo(() => {
    const grouped = new Map<
      string,
      { ingredientName: string; totalQty: number; unit: string; batchCount: number }
    >();

    for (const batch of batches) {
      const current = grouped.get(batch.ingredient.id) ?? {
        ingredientName: batch.ingredient.name,
        totalQty: 0,
        unit: batch.ingredient.unit ?? '',
        batchCount: 0
      };
      current.totalQty += batch.remainingQty;
      current.batchCount += 1;
      grouped.set(batch.ingredient.id, current);
    }

    return [...grouped.values()].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
  }, [batches]);

  const selectedStoreName =
    stores.find((store) => store.id === selectedListStoreId)?.name ?? 'Tất cả chi nhánh';

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
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Nguyên liệu</span>
              <select
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3"
                {...register('ingredientId')}
              >
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
            {selectedListStoreId ? (
              <button
                type="button"
                className="text-sm font-medium text-brand-700"
                onClick={() => setValue('storeId', selectedListStoreId, { shouldValidate: true })}
              >
                Dùng chi nhánh đang xem cho form tạo lô
              </button>
            ) : null}
            <Button type="submit" fullWidth disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo lô'}
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-brand-900">Danh sách lô hàng</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Đang xem: {selectedStoreName}
                </p>
              </div>
              <label className="block min-w-[240px] space-y-2">
                <span className="text-sm font-medium text-brand-900">Chọn chi nhánh</span>
                <select
                  value={selectedListStoreId}
                  onChange={(event) => setSelectedListStoreId(event.target.value)}
                  className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
                >
                  <option value="">Tất cả chi nhánh</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

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
                <div key={`${batch.id}-actions`} className="flex flex-wrap items-start gap-2">
                  <div className="basis-full rounded-xl bg-brand-50 px-3 py-3 text-sm text-slate-600 sm:flex sm:items-center sm:justify-between">
                    <span>
                      Tem: {batch.printedLabelCount}/{getMaxPrintableLabels(batch.initialQty)}
                    </span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={printQtyByBatch[batch.id] ?? '1'}
                      onChange={(event) =>
                        setPrintQtyByBatch((current) => ({
                          ...current,
                          [batch.id]: event.target.value
                        }))
                      }
                      className="mt-2 w-24 rounded-lg border border-brand-100 bg-white px-3 py-2 text-sm text-brand-900 outline-none focus:border-brand-500 sm:mt-0"
                      aria-label={`Số tem cần in cho lô ${batch.batchCode}`}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() => actionMutation.mutate({ id: batch.id, action: 'generate' })}
                  >
                    Tạo QR
                  </Button>
                  <Link
                    href={`/admin/batches/${batch.id}/print?qty=${encodeURIComponent(
                      String(getRequestedPrintQuantity(printQtyByBatch[batch.id]))
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="whitespace-nowrap rounded-xl bg-white px-4 py-3 text-sm font-semibold text-brand-900 ring-1 ring-brand-100 transition hover:bg-brand-50"
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

          <Card>
            <h2 className="mb-4 text-xl font-semibold text-brand-900">Tồn nguyên liệu theo chi nhánh</h2>
            {selectedListStoreId ? (
              <SimpleTable
                columns={['Nguyên liệu', 'Tổng tồn', 'Số lô còn tồn']}
                rows={inventorySummary.map((item) => [
                  item.ingredientName,
                  `${item.totalQty}${item.unit ? ` ${item.unit}` : ''}`,
                  item.batchCount
                ])}
              />
            ) : (
              <p className="text-sm text-slate-600">
                Chọn một chi nhánh ở phần danh sách lô hàng để xem tổng tồn theo nguyên liệu.
              </p>
            )}
          </Card>
        </div>
      </div>
    </ProtectedPage>
  );
}
