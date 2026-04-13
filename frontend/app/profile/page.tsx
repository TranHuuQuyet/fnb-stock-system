"use client";

import { useQuery } from '@tanstack/react-query';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { localizeRole, localizeUserStatus } from '@/lib/localization';
import { fetchMe } from '@/services/auth';

export default function ProfilePage() {
  const query = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe
  });
  const profile = query.data as
    | {
        fullName: string;
        username: string;
        role: string;
        status: string;
        store?: { name: string } | null;
      }
    | undefined;

  return (
    <ProtectedPage title="Tài khoản">
      <Card className="max-w-4xl">
        <h2 className="mb-4 text-xl font-semibold text-brand-900">Thông tin cá nhân</h2>
        {query.isLoading ? <p>Đang tải...</p> : null}
        {profile ? (
          <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-2">
            <div>
              <p className="font-medium">Họ tên</p>
              <p>{profile.fullName}</p>
            </div>
            <div>
              <p className="font-medium">Tên đăng nhập</p>
              <p>{profile.username}</p>
            </div>
            <div>
              <p className="font-medium">Vai trò</p>
              <Badge label={localizeRole(profile.role)} tone="neutral" />
            </div>
            <div>
              <p className="font-medium">Trạng thái</p>
              <Badge
                label={localizeUserStatus(profile.status)}
                tone={profile.status === 'ACTIVE' ? 'success' : 'warning'}
              />
            </div>
            <div>
              <p className="font-medium">Cửa hàng</p>
              <p>{profile.store?.name ?? 'Chưa gán'}</p>
            </div>
          </div>
        ) : null}
      </Card>
    </ProtectedPage>
  );
}
