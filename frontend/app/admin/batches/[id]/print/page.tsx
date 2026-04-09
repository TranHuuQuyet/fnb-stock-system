"use client";

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';

import { getSession, shouldForcePasswordChange } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getBatchLabel } from '@/services/batches';

type BatchLabel = {
  ingredientName: string;
  batchCode: string;
  storeName: string;
  receivedAt: string;
  expiredAt?: string | null;
  labelCreatedAt?: string | null;
  qrCodeValue: string | null;
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN') : 'Không có';

export default function BatchPrintPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useMemo(() => getSession(), []);
  const printRequested = searchParams.get('print') === '1';
  const hasTriggeredPrint = useRef(false);
  const batchId = Array.isArray(params.id) ? params.id[0] : params.id;

  useEffect(() => {
    if (!session) {
      router.replace('/login');
      return;
    }

    if (shouldForcePasswordChange(session)) {
      router.replace('/change-password');
      return;
    }

    if (session.user.role !== 'ADMIN') {
      router.replace('/dashboard');
    }
  }, [router, session]);

  const query = useQuery({
    queryKey: ['batch-print', batchId],
    queryFn: () => getBatchLabel(batchId),
    enabled: Boolean(batchId && session?.user.role === 'ADMIN')
  });

  const label = query.data as BatchLabel | undefined;

  useEffect(() => {
    if (!printRequested || !label || hasTriggeredPrint.current) {
      return;
    }

    hasTriggeredPrint.current = true;
    const timer = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(timer);
  }, [label, printRequested]);

  if (!session) {
    return null;
  }

  return (
    <div className="print-page-shell min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">
              Tem in
            </p>
            <h1 className="text-2xl font-semibold text-brand-900">Tem nhãn lô hàng</h1>
            <p className="text-sm text-slate-500">
              Trang này chỉ hiển thị nội dung tem để xem trước và in.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/batches"
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-brand-900 ring-1 ring-brand-100 transition hover:bg-brand-50"
            >
              Quay lại
            </Link>
            <Button
              type="button"
              variant="secondary"
              disabled={!label}
              onClick={() => window.print()}
            >
              In ngay
            </Button>
          </div>
        </div>

        {query.isPending ? (
          <Card className="mx-auto max-w-sm rounded-[24px] border border-slate-200 p-6">
            <p className="text-sm text-slate-600">Đang tải dữ liệu tem...</p>
          </Card>
        ) : query.isError ? (
          <Card className="mx-auto max-w-sm rounded-[24px] border border-rose-200 p-6">
            <p className="font-medium text-rose-700">Không tải được dữ liệu tem</p>
            <p className="mt-2 text-sm text-slate-600">
              Vui lòng quay lại danh sách lô và thử lại.
            </p>
          </Card>
        ) : label ? (
          <Card className="print-card mx-auto max-w-sm rounded-[24px] border border-slate-200 bg-white p-6">
            <div className="space-y-2 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">
                Tem lô nguyên liệu
              </p>
              <h2 className="text-xl font-semibold text-brand-900">{label.ingredientName}</h2>
              <p>Mã lô: {label.batchCode}</p>
              <p>Cửa hàng: {label.storeName}</p>
              <p>Ngày nhập: {formatDate(label.receivedAt)}</p>
              <p>Hết hạn: {formatDate(label.expiredAt)}</p>
              <p>Ngày tạo tem: {formatDate(label.labelCreatedAt)}</p>
            </div>
            <div className="mt-6 flex justify-center">
              <QRCodeSVG value={label.qrCodeValue ?? `FNBBATCH:${label.batchCode}`} size={180} />
            </div>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
