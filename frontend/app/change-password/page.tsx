"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getSession, setSession } from '@/lib/auth';
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
  const session = getSession();
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const mutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      if (session) {
        setSession({
          ...session,
          mustChangePassword: false,
          user: {
            ...session.user,
            status: 'ACTIVE',
            mustChangePassword: false
          }
        });
      }

      router.replace(session?.user.role === 'STAFF' ? '/scan' : '/dashboard');
    }
  });

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
