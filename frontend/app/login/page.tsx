"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setSession } from '@/lib/auth';
import { login } from '@/services/auth';

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema)
  });

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      setSession({
        accessToken: data.accessToken,
        user: {
          ...data.user,
          mustChangePassword: data.mustChangePassword
        },
        mustChangePassword: data.mustChangePassword
      });

      router.replace(data.mustChangePassword ? '/change-password' : data.user.role === 'STAFF' ? '/scan' : '/dashboard');
    }
  });

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-700">
            FNB Stock Control
          </p>
          <h1 className="text-3xl font-semibold text-brand-900">Đăng nhập vận hành</h1>
          <p className="text-sm text-slate-500">
            Dùng tài khoản nội bộ để scan nguyên liệu, kiểm soát batch và đối soát POS.
          </p>
        </div>

        <form
          className="space-y-4"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          <Input
            label="Username"
            placeholder="admin"
            error={errors.username?.message}
            {...register('username')}
          />
          <Input
            label="Password"
            type="password"
            placeholder="123456"
            error={errors.password?.message}
            {...register('password')}
          />
          {mutation.error ? (
            <p className="text-sm text-danger">{mutation.error.message}</p>
          ) : null}
          <Button type="submit" fullWidth disabled={mutation.isPending}>
            {mutation.isPending ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
