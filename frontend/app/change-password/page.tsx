"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { AUTH_SESSION_QUERY_KEY, useResolvedSession } from '@/hooks/use-resolved-session';
import { clearSession, getDefaultRouteForRole, shouldForcePasswordChange } from '@/lib/auth';
import {
  PASSWORD_MIN_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_POLICY_REGEX
} from '@/lib/password-policy';
import { changePassword } from '@/services/auth';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Vui long nhap mat khau hien tai'),
    newPassword: z
      .string()
      .min(PASSWORD_MIN_LENGTH, PASSWORD_POLICY_MESSAGE)
      .regex(PASSWORD_POLICY_REGEX, PASSWORD_POLICY_MESSAGE),
    confirmPassword: z
      .string()
      .min(1, 'Vui long nhap lai mat khau moi')
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Mat khau nhap lai khong khop',
    path: ['confirmPassword']
  });

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const sessionQuery = useResolvedSession();
  const session = sessionQuery.session;
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  useEffect(() => {
    if (sessionQuery.isPending) {
      return;
    }

    if (sessionQuery.isUnauthorized || !session) {
      router.replace('/login');
      return;
    }

    if (!shouldForcePasswordChange(session)) {
      router.replace(getDefaultRouteForRole(session.user.role));
    }
  }, [router, session, sessionQuery.isPending, sessionQuery.isUnauthorized]);

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: async () => {
      clearSession();
      await queryClient.removeQueries({ queryKey: AUTH_SESSION_QUERY_KEY });
      router.replace('/login');
    }
  });

  if (sessionQuery.isError && !sessionQuery.isUnauthorized) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md">
          <h1 className="text-lg font-semibold text-brand-900">Không tải được phiên đăng nhập</h1>
          <p className="mt-2 text-sm text-slate-600">
            {(sessionQuery.error as Error).message}
          </p>
        </Card>
      </main>
    );
  }

  if (sessionQuery.isPending || !session || sessionQuery.isUnauthorized) {
    return null;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-brand-900">Doi mat khau lan dau</h1>
          <p className="text-sm text-slate-500">
            Tai khoan nay dang o trang thai bat buoc doi mat khau truoc khi tiep tuc su dung.
          </p>
          <p className="text-xs text-slate-500">
            Mat khau moi can co it nhat {PASSWORD_MIN_LENGTH} ky tu, gom chu hoa, chu thuong va so.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          <Input
            type="password"
            label="Mat khau hien tai"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <Input
            type="password"
            label="Mat khau moi"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <Input
            type="password"
            label="Nhap lai mat khau moi"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          {mutation.error ? (
            <p className="text-sm text-danger">{mutation.error.message}</p>
          ) : null}
          <Button type="submit" fullWidth disabled={mutation.isPending}>
            {mutation.isPending ? 'Dang cap nhat...' : 'Xac nhan'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
