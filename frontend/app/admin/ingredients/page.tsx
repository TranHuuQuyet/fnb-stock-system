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
import { localizeUserStatus } from '@/lib/localization';
import {
  createIngredient,
  disableIngredient,
  listIngredients
} from '@/services/admin/ingredients';

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

export default function AdminIngredientsPage() {
  const ingredientsQuery = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => listIngredients('')
  });
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const createMutation = useMutation({
    mutationFn: createIngredient,
    onSuccess: () => {
      reset();
      ingredientsQuery.refetch();
    }
  });

  const disableMutation = useMutation({
    mutationFn: disableIngredient,
    onSuccess: () => ingredientsQuery.refetch()
  });

  const ingredients = (ingredientsQuery.data?.data ?? []) as Array<{
    id: string;
    code: string;
    name: string;
    unit: string;
    isActive: boolean;
  }>;

  return (
    <ProtectedPage title="Quản lý nguyên liệu" allowedRoles={['ADMIN']}>
      <div className="grid gap-4 xl:grid-cols-[380px,1fr]">
        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Tạo nguyên liệu</h2>
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          >
            <Input label="Mã nguyên liệu" error={errors.code?.message} {...register('code')} />
            <Input label="Tên nguyên liệu" error={errors.name?.message} {...register('name')} />
            <Input label="Đơn vị" error={errors.unit?.message} {...register('unit')} />
            <Button type="submit" fullWidth disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Đang tạo...' : 'Tạo nguyên liệu'}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Danh sách nguyên liệu</h2>
          <SimpleTable
            columns={['Mã', 'Tên', 'Đơn vị', 'Trạng thái', 'Thao tác']}
            rows={ingredients.map((ingredient) => [
              ingredient.code,
              ingredient.name,
              ingredient.unit,
              <Badge
                key={ingredient.id}
                label={localizeUserStatus(ingredient.isActive ? 'ACTIVE' : 'INACTIVE')}
                tone={ingredient.isActive ? 'success' : 'warning'}
              />,
              ingredient.isActive ? (
                <Button
                  key={`${ingredient.id}-disable`}
                  variant="danger"
                  onClick={() => disableMutation.mutate(ingredient.id)}
                >
                  Vô hiệu hóa
                </Button>
              ) : (
                'Đã vô hiệu hóa'
              )
            ])}
          />
        </Card>
      </div>
    </ProtectedPage>
  );
}
