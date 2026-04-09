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
import { listIngredients } from '@/services/admin/ingredients';
import {
  createPosProduct,
  createRecipe,
  importPosSales,
  listPosProducts,
  listRecipes
} from '@/services/pos';
import { listStores } from '@/services/admin/stores';

const productSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1)
});

const recipeSchema = z.object({
  productId: z.string().min(1),
  ingredientId: z.string().min(1),
  qtyPerUnit: z.coerce.number().positive()
});

const saleSchema = z.object({
  storeId: z.string().min(1),
  productCode: z.string().min(1),
  businessDate: z.string().min(1),
  qtySold: z.coerce.number().positive()
});

export default function AdminRecipesPage() {
  const [salesMessage, setSalesMessage] = useState('');
  const storesQuery = useQuery({
    queryKey: ['stores-for-recipes'],
    queryFn: () => listStores('')
  });
  const ingredientsQuery = useQuery({
    queryKey: ['ingredients-for-recipes'],
    queryFn: () => listIngredients('')
  });
  const productsQuery = useQuery({
    queryKey: ['pos-products'],
    queryFn: () => listPosProducts('')
  });
  const recipesQuery = useQuery({
    queryKey: ['recipes'],
    queryFn: listRecipes
  });

  const productForm = useForm<z.infer<typeof productSchema>>({
    resolver: zodResolver(productSchema)
  });
  const recipeForm = useForm<z.infer<typeof recipeSchema>>({
    resolver: zodResolver(recipeSchema)
  });
  const salesForm = useForm<z.infer<typeof saleSchema>>({
    resolver: zodResolver(saleSchema)
  });

  const productMutation = useMutation({
    mutationFn: createPosProduct,
    onSuccess: () => {
      productForm.reset();
      productsQuery.refetch();
    }
  });

  const recipeMutation = useMutation({
    mutationFn: createRecipe,
    onSuccess: () => {
      recipeForm.reset();
      recipesQuery.refetch();
    }
  });

  const salesMutation = useMutation({
    mutationFn: (values: z.infer<typeof saleSchema>) => importPosSales([values]),
    onSuccess: () => {
      setSalesMessage('Đã nhập dữ liệu bán hàng POS thành công');
      salesForm.reset();
    }
  });

  const stores = (storesQuery.data?.data ?? []) as Array<{ id: string; name: string }>;
  const ingredients = (ingredientsQuery.data?.data ?? []) as Array<{
    id: string;
    name: string;
  }>;
  const products = (productsQuery.data?.data ?? []) as Array<{
    id: string;
    code: string;
    name: string;
  }>;
  const recipes = (recipesQuery.data ?? []) as Array<{
    id: string;
    product: { name: string; code: string };
    ingredient: { name: string };
    qtyPerUnit: number;
  }>;

  return (
    <ProtectedPage title="Công thức & POS" allowedRoles={['ADMIN']}>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Tạo sản phẩm POS</h2>
          <form
            className="space-y-4"
            onSubmit={productForm.handleSubmit((values) => productMutation.mutate(values))}
          >
            <Input label="Mã sản phẩm" error={productForm.formState.errors.code?.message} {...productForm.register('code')} />
            <Input label="Tên sản phẩm" error={productForm.formState.errors.name?.message} {...productForm.register('name')} />
            <Button type="submit" fullWidth disabled={productMutation.isPending}>
              Tạo sản phẩm
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Thêm thành phần công thức</h2>
          <form
            className="space-y-4"
            onSubmit={recipeForm.handleSubmit((values) => recipeMutation.mutate(values))}
          >
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Sản phẩm</span>
              <select className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3" {...recipeForm.register('productId')}>
                <option value="">Chọn sản phẩm</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.code} - {product.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Nguyên liệu</span>
              <select className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3" {...recipeForm.register('ingredientId')}>
                <option value="">Chọn nguyên liệu</option>
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Định lượng mỗi đơn vị" type="number" step="0.001" error={recipeForm.formState.errors.qtyPerUnit?.message} {...recipeForm.register('qtyPerUnit')} />
            <Button type="submit" fullWidth disabled={recipeMutation.isPending}>
              Thêm công thức
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-4 text-xl font-semibold text-brand-900">Nhập dữ liệu bán POS mẫu</h2>
          <form
            className="space-y-4"
            onSubmit={salesForm.handleSubmit((values) => salesMutation.mutate(values))}
          >
            <label className="block space-y-2">
              <span className="text-sm font-medium text-brand-900">Cửa hàng</span>
              <select className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3" {...salesForm.register('storeId')}>
                <option value="">Chọn cửa hàng</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
            <Input label="Mã sản phẩm" error={salesForm.formState.errors.productCode?.message} {...salesForm.register('productCode')} />
            <Input label="Ngày kinh doanh" type="date" error={salesForm.formState.errors.businessDate?.message} {...salesForm.register('businessDate')} />
            <Input label="Số lượng bán" type="number" error={salesForm.formState.errors.qtySold?.message} {...salesForm.register('qtySold')} />
            <Button type="submit" fullWidth disabled={salesMutation.isPending}>
              Nhập dữ liệu bán
            </Button>
            {salesMessage ? <p className="text-sm text-success">{salesMessage}</p> : null}
          </form>
        </Card>
      </div>

      <Card>
        <h2 className="mb-4 text-xl font-semibold text-brand-900">Bảng công thức</h2>
        <SimpleTable
          columns={['Sản phẩm', 'Nguyên liệu', 'Định lượng / đơn vị']}
          rows={recipes.map((recipe) => [
            `${recipe.product.code} - ${recipe.product.name}`,
            recipe.ingredient.name,
            recipe.qtyPerUnit
          ])}
        />
      </Card>
    </ProtectedPage>
  );
}
