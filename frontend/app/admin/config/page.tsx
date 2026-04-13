"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getConfig, updateConfig } from '@/services/config';

const schema = z.object({
  allowFifoBypass: z.boolean(),
  anomalyThreshold: z.coerce.number().min(0).max(1)
});

export default function AdminConfigPage() {
  const configQuery = useQuery({
    queryKey: ['app-config'],
    queryFn: getConfig
  });
  const { register, handleSubmit, reset } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema)
  });

  const mutation = useMutation({
    mutationFn: updateConfig,
    onSuccess: (data) => {
      reset(data as z.infer<typeof schema>);
      configQuery.refetch();
    }
  });

  const config = configQuery.data as { allowFifoBypass: boolean; anomalyThreshold: number } | undefined;

  return (
    <ProtectedPage title="Cấu hình" allowedRoles={['ADMIN']}>
      <Card className="max-w-4xl">
        <h2 className="mb-4 text-xl font-semibold text-brand-900">Cấu hình hệ thống</h2>
        {config ? (
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
          >
            <label className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <input type="checkbox" defaultChecked={config.allowFifoBypass} {...register('allowFifoBypass')} />
              <span>Cho phép bỏ qua FIFO</span>
            </label>
            <Input
              label="Ngưỡng cảnh báo bất thường"
              type="number"
              step="0.01"
              defaultValue={config.anomalyThreshold}
              {...register('anomalyThreshold')}
            />
            <Button type="submit" disabled={mutation.isPending}>
              Lưu cấu hình
            </Button>
          </form>
        ) : null}
      </Card>
    </ProtectedPage>
  );
}
