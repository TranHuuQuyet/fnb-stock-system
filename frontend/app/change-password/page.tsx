"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSession, setSession } from '@/lib/auth';
import { changePassword } from '@/services/auth';

const schema = z
  .object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(6),
    confirmPassword: z.string().min(6)
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: 'Confirm password does not match',
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
          <h1 className="text-3xl font-semibold text-brand-900">Đổi mật khẩu lần đầu</h1>
          <p className="text-sm text-slate-500">
            Tài khoản này đang ở trạng thái bắt buộc đổi mật khẩu trước khi tiếp tục sử dụng.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          <Input
            type="password"
            label="Mật khẩu hiện tại"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <Input
            type="password"
            label="Mật khẩu mới"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <Input
            type="password"
            label="Nhập lại mật khẩu mới"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          {mutation.error ? (
            <p className="text-sm text-danger">{mutation.error.message}</p>
          ) : null}
          <Button type="submit" fullWidth disabled={mutation.isPending}>
            {mutation.isPending ? 'Đang cập nhật...' : 'Xác nhận'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
