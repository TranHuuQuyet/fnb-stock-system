"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SimpleTable } from '@/components/ui/table';
import { localizeAdjustmentType } from '@/lib/localization';
import {
  createAdjustment,
  listAdjustments,
  listBatches
} from '@/services/batches';

const schema = z.object({
  batchId: z.string().min(1),
  adjustmentType: z.enum(['INCREASE', 'DECREASE']),
  quantity: z.coerce.number().positive(),
  reason: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

export default function AdminBatchAdjustmentsPage() {
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const batchesQuery = useQuery({
    queryKey: ['batch-adjustments-batches'],
    queryFn: () => listBatches('')
  });
  const adjustmentsQuery = useQuery({
    queryKey: ['batch-adjustments', selectedBatchId],
    queryFn: () => listAdjustments(selectedBatchId),
    enabled: Boolean(selectedBatchId)
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      adjustmentType: 'DECREASE'
    }
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createAdjustment(values.batchId, {
        adjustmentType: values.adjustmentType,
        quantity: values.quantity,
        reason: values.reason
      }),
    onSuccess: (_data, variables) => {
      setSelectedBatchId(variables.batchId);
      reset();
      adjustmentsQuery.refetch();
      batchesQuery.refetch();
    }
  });

  const batches = (batchesQuery.data?.data ?? []) as Array<{
    id: string;
    batchCode: string;
    ingredient: { name: string };
  }>;
  const adjustments = (adjustmentsQuery.data ?? []) as Array<{
    id: string;
    adjustmentType: string;
    quantity: number;
    reason: string;
    createdAt: string;
    createdByUser?: { fullName: string } | null;
  }>;

  return (
    <ProtectedPage title="Điều chỉnh tồn kho" allowedRoles={['ADMIN']}>
      <div className="grid gap-4 xl:grid-cols-[420px,1fr]">
        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Tạo điều chỉnh tồn</h2>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
          >
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Lô hàng</span>
              <select
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3"
                {...register('batchId')}
                onChange={(event) => setSelectedBatchId(event.target.value)}
              >
                <option value="">Chọn lô</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batchCode} - {batch.ingredient.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Loại điều chỉnh</span>
              <select className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3" {...register('adjustmentType')}>
                <option value="DECREASE">Giảm</option>
                <option value="INCREASE">Tăng</option>
              </select>
            </label>
            <Input label="Số lượng" type="number" step="0.001" error={errors.quantity?.message} {...register('quantity')} />
            <Input label="Lý do" error={errors.reason?.message} {...register('reason')} />
            <Button type="submit" fullWidth disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang tạo...' : 'Tạo phiếu điều chỉnh'}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Lịch sử điều chỉnh</h2>
          <SimpleTable
            columns={['Loại', 'Số lượng', 'Lý do', 'Người tạo', 'Thời gian']}
            rows={adjustments.map((item) => [
              localizeAdjustmentType(item.adjustmentType),
              item.quantity,
              item.reason,
              item.createdByUser?.fullName ?? '-',
              new Date(item.createdAt).toLocaleString('vi-VN')
            ])}
          />
        </Card>
      </div>
    </ProtectedPage>
  );
}
