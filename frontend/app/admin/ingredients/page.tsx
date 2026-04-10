"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { IngredientUnitDropdown } from '@/components/admin/ingredient-unit-dropdown';
import { ProtectedPage } from '@/components/layout/protected-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SimpleTable } from '@/components/ui/table';
import { localizeUserStatus } from '@/lib/localization';
import {
  deleteIngredientUnit,
  createIngredientUnit,
  createIngredient,
  disableIngredient,
  listIngredientUnits,
  listIngredients,
  type IngredientUnitOption,
  updateIngredientUnit
} from '@/services/admin/ingredients';

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1)
});

type FormValues = z.infer<typeof schema>;

export default function AdminIngredientsPage() {
  const queryClient = useQueryClient();
  const ingredientsQuery = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => listIngredients('')
  });
  const unitsQuery = useQuery({
    queryKey: ['ingredient-units'],
    queryFn: listIngredientUnits
  });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });
  const selectedUnit = watch('unit');
  const resetUnitActionErrors = () => {
    createUnitMutation.reset();
    updateUnitMutation.reset();
    deleteUnitMutation.reset();
  };

  const createMutation = useMutation({
    mutationFn: createIngredient,
    onSuccess: () => {
      reset();
      ingredientsQuery.refetch();
    }
  });

  const createUnitMutation = useMutation({
    mutationFn: ({ name }: { name: string }) => createIngredientUnit({ name }),
    onSuccess: (unit: IngredientUnitOption) => {
      queryClient.setQueryData<IngredientUnitOption[]>(
        ['ingredient-units'],
        (current = []) =>
          [...current.filter((item) => item.id !== unit.id), unit].sort((a, b) =>
            a.name.localeCompare(b.name, 'vi')
          )
      );
      setValue('unit', unit.name, { shouldDirty: true, shouldValidate: true });
    }
  });

  const updateUnitMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateIngredientUnit(id, { name }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ingredient-units'] }),
        queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      ]);
    }
  });

  const deleteUnitMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteIngredientUnit(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ingredient-units'] });
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
  const units = (unitsQuery.data ?? []) as IngredientUnitOption[];

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
            <input type="hidden" {...register('unit')} />
            <IngredientUnitDropdown
              label="Đơn vị"
              value={selectedUnit ?? ''}
              options={units}
              error={errors.unit?.message}
              actionError={
                createUnitMutation.error?.message ??
                updateUnitMutation.error?.message ??
                deleteUnitMutation.error?.message
              }
              disabled={unitsQuery.isLoading}
              isCreating={createUnitMutation.isPending}
              updatingUnitId={
                updateUnitMutation.isPending ? (updateUnitMutation.variables?.id ?? null) : null
              }
              deletingUnitId={
                deleteUnitMutation.isPending ? (deleteUnitMutation.variables?.id ?? null) : null
              }
              onClearActionError={resetUnitActionErrors}
              onChange={(unit) => setValue('unit', unit, { shouldDirty: true, shouldValidate: true })}
              onCreate={async (name) => {
                await createUnitMutation.mutateAsync({ name });
              }}
              onUpdate={async (id, name) => {
                await updateUnitMutation.mutateAsync({ id, name });
              }}
              onDelete={async (id) => {
                await deleteUnitMutation.mutateAsync({ id });
              }}
            />
            {createMutation.error ? (
              <p className="text-sm text-danger">{createMutation.error.message}</p>
            ) : null}
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
