"use client";

import { useQuery } from '@tanstack/react-query';

import { getSession } from '@/lib/auth';
import { getScanNetworkStatus } from '@/services/scan';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';

type NetworkStatus = {
  storeId: string;
  ipAddress: string;
  normalizedIpAddress: string;
  hasActiveWhitelist: boolean;
  isAllowedByWhitelist: boolean;
  matchedWhitelistTypes: Array<'IP' | 'SSID'>;
  bypassEnabled: boolean;
  bypassActive: boolean;
  bypassExpiresAt: string | null;
  bypassReason: string | null;
  canAccessBusinessOperations: boolean;
};

export function BusinessNetworkBanner() {
  const session = getSession();
  const storeName = session?.user.store?.name ?? 'chi nhanh hien tai';

  const query = useQuery<NetworkStatus>({
    queryKey: ['business-network-banner', session?.user.store?.id ?? 'no-store'],
    queryFn: () => getScanNetworkStatus(''),
    enabled: Boolean(session?.user.store?.id),
    retry: false
  });

  if (!session?.user.store?.id) {
    return null;
  }

  if (query.isLoading) {
    return (
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Badge label="Dang kiem tra mang" tone="warning" />
          <p className="text-sm text-slate-600">Dang xac minh mang nghiep vu cho {storeName}.</p>
        </div>
      </Card>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <Badge label="Khong kiem tra duoc mang" tone="danger" />
          <p className="text-sm text-slate-600">
            Chua lay duoc trang thai mang hien tai. Hay thu tai lai trang.
          </p>
        </div>
      </Card>
    );
  }

  const status = query.data;
  const badge = status.bypassActive
    ? { label: 'Emergency bypass dang bat', tone: 'warning' as const }
    : status.canAccessBusinessOperations
      ? { label: 'Mang duoc phep', tone: 'success' as const }
      : !status.hasActiveWhitelist
        ? { label: 'Chua cau hinh whitelist', tone: 'danger' as const }
        : { label: 'Mang chua duoc phep', tone: 'danger' as const };

  const message = status.bypassActive
    ? `Chi nhanh ${storeName} dang duoc mo tam den ${
        status.bypassExpiresAt
          ? new Date(status.bypassExpiresAt).toLocaleString('vi-VN')
          : 'thoi diem khong xac dinh'
      }. ${status.bypassReason ? `Ly do: ${status.bypassReason}. ` : ''}IP backend dang nhan la ${status.ipAddress}.`
    : !status.hasActiveWhitelist
      ? `Chi nhanh ${storeName} chua co mang duoc phep active. API nghiep vu se bi chan cho den khi admin cau hinh whitelist hoac bat bypass tam thoi.`
      : status.canAccessBusinessOperations
        ? `Ban dang o dung mang cua ${storeName}. IP backend dang nhan la ${status.ipAddress}.`
        : `Ban dang o sai mang cho ${storeName}. IP backend dang nhan la ${status.ipAddress}. API nghiep vu hien dang bi chan.`;

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <Badge label={badge.label} tone={badge.tone} />
      </div>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
    </Card>
  );
}
