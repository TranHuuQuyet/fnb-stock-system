"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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
  createIngredient,
  createIngredientUnit,
  deleteIngredientUnit,
  disableIngredient,
  listIngredientGroups,
  listIngredients,
  listIngredientUnits,
  type IngredientGroupOption,
  type IngredientUnitOption,
  updateIngredient,
  updateIngredientUnit
} from '@/services/admin/ingredients';

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  groupName: z.string().min(1, 'Vui lòng nhập nhóm nguyên liệu')
});

type FormValues = z.infer<typeof schema>;

type IngredientRow = {
  id: string;
  code: string;
  name: string;
  unit: string;
  isActive: boolean;
  group?: {
    id: string;
    name: string;
  } | null;
};

export default function AdminIngredientsPage() {
  const queryClient = useQueryClient();
  const [editingIngredient, setEditingIngredient] = useState<IngredientRow | null>(null);

  const ingredientsQuery = useQuery({
    queryKey: ['ingredients'],
    queryFn: () => listIngredients('')
  });
  const unitsQuery = useQuery({
    queryKey: ['ingredient-units'],
    queryFn: listIngredientUnits
  });
  const groupsQuery = useQuery({
    queryKey: ['ingredient-groups'],
    queryFn: listIngredientGroups
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
      code: '',
      name: '',
      unit: '',
      groupName: ''
    }
  });

  const selectedUnit = watch('unit');

  const resetForm = () => {
    setEditingIngredient(null);
    reset({
      code: '',
      name: '',
      unit: '',
      groupName: ''
    });
  };

  const createMutation = useMutation({
    mutationFn: createIngredient,
    onSuccess: async () => {
      resetForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ingredient-units'] }),
        queryClient.invalidateQueries({ queryKey: ['ingredient-groups'] }),
        queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      ]);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: FormValues }) => updateIngredient(id, payload),
    onSuccess: async () => {
      resetForm();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['ingredient-units'] }),
        queryClient.invalidateQueries({ queryKey: ['ingredient-groups'] }),
        queryClient.invalidateQueries({ queryKey: ['ingredients'] })
      ]);
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    }
  });

  const ingredients = useMemo(
    () => ((ingredientsQuery.data?.data ?? []) as IngredientRow[]),
    [ingredientsQuery.data]
  );
  const units = (unitsQuery.data ?? []) as IngredientUnitOption[];
  const groups = (groupsQuery.data ?? []) as IngredientGroupOption[];

  return (
    <ProtectedPage title="Quản lý nguyên liệu" allowedRoles={['ADMIN']}>
      <div className="grid gap-4 xl:grid-cols-[minmax(320px,420px),minmax(0,1fr)]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-brand-900">
              {editingIngredient ? 'Cập nhật nguyên liệu' : 'Tạo nguyên liệu'}
            </h2>
            {editingIngredient ? (
              <Button variant="secondary" onClick={resetForm}>
                Hủy sửa
              </Button>
            ) : null}
          </div>

          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => {
              if (editingIngredient) {
                updateMutation.mutate({ id: editingIngredient.id, payload: values });
                return;
              }

              createMutation.mutate(values);
            })}
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
              updatingUnitId={updateUnitMutation.isPending ? (updateUnitMutation.variables?.id ?? null) : null}
              deletingUnitId={deleteUnitMutation.isPending ? (deleteUnitMutation.variables?.id ?? null) : null}
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

            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Nhóm nguyên liệu</span>
              <input
                list="ingredient-group-options"
                className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-brand-500"
                placeholder="Ví dụ: Trà, Topping, Syrup..."
                {...register('groupName')}
              />
              <datalist id="ingredient-group-options">
                {groups.map((group) => (
                  <option key={group.id} value={group.name} />
                ))}
              </datalist>
              {errors.groupName ? (
                <span className="text-xs text-danger">{errors.groupName.message}</span>
              ) : null}
            </label>

            {createMutation.error || updateMutation.error ? (
              <p className="text-sm text-danger">
                {createMutation.error?.message ?? updateMutation.error?.message}
              </p>
            ) : null}

            <Button
              type="submit"
              fullWidth
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? 'Đang lưu...'
                : editingIngredient
                  ? 'Cập nhật nguyên liệu'
                  : 'Tạo nguyên liệu'}
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Danh sách nguyên liệu</h2>
          <SimpleTable
            columns={['Mã', 'Tên', 'Nhóm', 'Đơn vị', 'Trạng thái', 'Thao tác']}
            rows={ingredients.map((ingredient) => [
              ingredient.code,
              ingredient.name,
              ingredient.group?.name ?? 'Chưa phân loại',
              ingredient.unit,
              <Badge
                key={`${ingredient.id}-status`}
                label={localizeUserStatus(ingredient.isActive ? 'ACTIVE' : 'INACTIVE')}
                tone={ingredient.isActive ? 'success' : 'warning'}
              />,
              <div key={`${ingredient.id}-actions`} className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingIngredient(ingredient);
                    setValue('code', ingredient.code, { shouldDirty: false });
                    setValue('name', ingredient.name, { shouldDirty: false });
                    setValue('unit', ingredient.unit, { shouldDirty: false });
                    setValue('groupName', ingredient.group?.name ?? 'Chưa phân loại', {
                      shouldDirty: false
                    });
                  }}
                >
                  Sửa
                </Button>
                {ingredient.isActive ? (
                  <Button
                    variant="danger"
                    onClick={() => disableMutation.mutate(ingredient.id)}
                  >
                    Vô hiệu hóa
                  </Button>
                ) : (
                  'Đã vô hiệu hóa'
                )}
              </div>
            ])}
          />
        </Card>
      </div>
    </ProtectedPage>
  );
}
