"use client";

import Link from 'next/link';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useForm } from 'react-hook-form';
import { QRCodeSVG } from 'qrcode.react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getSession, shouldForcePasswordChange } from '@/lib/auth';
import { buildIssuedLabelQrValue } from '@/lib/batch-qr';
import { getBatchLabel, issueBatchLabels } from '@/services/batches';

type BatchLabel = {
  batchId: string;
  ingredientName: string;
  batchCode: string;
  storeName: string;
  unit: string;
  initialQty: number;
  receivedAt: string;
  expiredAt?: string | null;
  labelCreatedAt?: string | null;
  qrCodeValue: string | null;
  printedLabelCount: number;
  maxPrintableLabels: number;
  remainingLabelCount: number;
  nextLabelNumber: number | null;
};

type IssuedLabel = {
  sequenceNumber: number;
  qrCodeValue?: string | null;
};

type IssuedLabelJob = BatchLabel & {
  issuedQuantity: number;
  issuedFromNumber: number;
  issuedToNumber: number;
  labels: IssuedLabel[];
};

type PrintLayout = {
  columns: number;
  rows: number;
};

const DEFAULT_LAYOUT: PrintLayout = {
  columns: 2,
  rows: 5
};

const issueSchema = z.object({
  quantity: z.coerce.number().int('So tem phai la so nguyen').min(1, 'Can in it nhat 1 tem'),
  reason: z.string().trim().max(200, 'Ly do toi da 200 ky tu').optional()
});

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('vi-VN') : 'Không có';

const clampInteger = (value: string, min: number, max: number, fallback: number) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
};

const chunkLabels = <T,>(items: T[], chunkSize: number) => {
  if (chunkSize <= 0) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
};

export default function BatchPrintPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useMemo(() => getSession(), []);
  const batchId = Array.isArray(params.id) ? params.id[0] : params.id;
  const qtyParam = searchParams.get('qty');
  const [issuedJob, setIssuedJob] = useState<IssuedLabelJob | null>(null);
  const [layout, setLayout] = useState<PrintLayout>(DEFAULT_LAYOUT);
  const [pendingAutoPrint, setPendingAutoPrint] = useState(false);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const initialQuantity = useMemo(() => {
    const parsed = Number(qtyParam ?? '1');
    if (!Number.isFinite(parsed) || parsed < 1) {
      return 1;
    }

    return Math.floor(parsed);
  }, [qtyParam]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<z.infer<typeof issueSchema>>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      quantity: initialQuantity
    }
  });

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

  useEffect(() => {
    setValue('quantity', initialQuantity);
  }, [initialQuantity, setValue]);

  const query = useQuery({
    queryKey: ['batch-print', batchId],
    queryFn: () => getBatchLabel(batchId),
    enabled: Boolean(batchId && session?.user.role === 'ADMIN')
  });

  const label = query.data as BatchLabel | undefined;
  const issueMutation = useMutation({
    mutationFn: (values: z.infer<typeof issueSchema>) => issueBatchLabels(batchId, values),
    onSuccess: (data) => {
      setIssuedJob(data as IssuedLabelJob);
      setReasonError(null);
      setPendingAutoPrint(true);
      void query.refetch();
    }
  });

  const labelsPerPage = layout.columns * layout.rows;
  const issuedLabels = useMemo(() => {
    if (!issuedJob) {
      return [] as Array<IssuedLabel & { qrCodeValue: string }>;
    }

    return issuedJob.labels.map((item) => ({
      ...item,
      qrCodeValue:
        item.qrCodeValue ??
        buildIssuedLabelQrValue({
          batchId: issuedJob.batchId,
          batchCode: issuedJob.batchCode,
          sequenceNumber: item.sequenceNumber
        })
    }));
  }, [issuedJob]);
  const printSheets = useMemo(
    () => chunkLabels(issuedLabels, labelsPerPage),
    [issuedLabels, labelsPerPage]
  );
  const sheetStyle = useMemo(
    () =>
      ({
        ['--print-columns' as string]: String(layout.columns),
        ['--print-rows' as string]: String(layout.rows)
      }) as CSSProperties,
    [layout.columns, layout.rows]
  );

  useEffect(() => {
    if (!issuedJob || !pendingAutoPrint) {
      return;
    }

    let firstFrame = 0;
    let secondFrame = 0;
    let timeoutId = 0;

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        timeoutId = window.setTimeout(() => {
          window.print();
          setPendingAutoPrint(false);
        }, 120);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(timeoutId);
    };
  }, [issuedJob, pendingAutoPrint]);

  if (!session) {
    return null;
  }

  return (
    <div className="print-page-shell min-h-screen bg-slate-100 px-4 py-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">
              In tem nguyên liệu
            </p>
            <h1 className="text-2xl font-semibold text-brand-900">Tem nhãn lô hàng</h1>
            <p className="text-sm text-slate-500">
              Mỗi tem có QR riêng theo Number của từng lô. Mặc định 2 cột x 5 hàng = 10 tem/trang.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/batches"
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-brand-900 ring-1 ring-brand-100 transition hover:bg-brand-50"
            >
              Quay lại
            </Link>
            <Button type="button" variant="secondary" disabled={!issuedJob} onClick={() => window.print()}>
              In lại tem vừa tạo
            </Button>
          </div>
        </div>

        {query.isPending ? (
          <Card className="rounded-[24px] border border-slate-200 p-6">
            <p className="text-sm text-slate-600">Đang tải dữ liệu tem...</p>
          </Card>
        ) : query.isError ? (
          <Card className="rounded-[24px] border border-rose-200 p-6">
            <p className="font-medium text-rose-700">Không tải được dữ liệu tem</p>
            <p className="mt-2 text-sm text-slate-600">Vui lòng quay lại danh sách lô và thử lại.</p>
          </Card>
        ) : label ? (
          <>
            <Card className="no-print rounded-[24px] border border-slate-200 bg-white p-6">
              <div className="grid gap-6 xl:grid-cols-[1.35fr,1fr]">
                <div className="space-y-2 text-sm text-slate-600">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">
                    Thông tin lô
                  </p>
                  <h2 className="text-xl font-semibold text-brand-900">{label.ingredientName}</h2>
                  <p>Mã lô: {label.batchCode}</p>
                  <p>Cửa hàng: {label.storeName}</p>
                  <p>Đơn vị: {label.unit}</p>
                  <p>Ngày nhập: {formatDate(label.receivedAt)}</p>
                  <p>Hết hạn: {formatDate(label.expiredAt)}</p>
                  <p>Ngày in gần nhất: {formatDate(label.labelCreatedAt)}</p>
                  <p>
                    Đã in: {label.printedLabelCount}/{label.maxPrintableLabels} tem
                  </p>
                  <p>Còn lại: {label.remainingLabelCount} tem</p>
                  <p>Number tiếp theo: {label.nextLabelNumber ?? 'Lô này đã hết dãy Number'}</p>
                </div>

                <div className="space-y-4 rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
                  <form
                    className="space-y-4"
                    onSubmit={handleSubmit((values) => {
                      const normalizedReason = values.reason?.trim();
                      if ((label.printedLabelCount ?? 0) > 0 && !normalizedReason) {
                        setReasonError('Can nhap ly do khi phat hanh them tem cho lo da tung in');
                        return;
                      }

                      setReasonError(null);
                      issueMutation.mutate({
                        quantity: values.quantity,
                        reason: normalizedReason || undefined
                      });
                    })}
                  >
                    <Input
                      label="Số tem muốn in"
                      type="number"
                      min={1}
                      step="1"
                      error={errors.quantity?.message}
                      {...register('quantity')}
                    />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label="Số cột mỗi trang"
                        type="number"
                        min={1}
                        max={4}
                        value={layout.columns}
                        onChange={(event) =>
                          setLayout((current) => ({
                            ...current,
                            columns: clampInteger(event.target.value, 1, 4, current.columns)
                          }))
                        }
                      />
                      <Input
                        label="Số hàng mỗi trang"
                        type="number"
                        min={1}
                        max={8}
                        value={layout.rows}
                        onChange={(event) =>
                          setLayout((current) => ({
                            ...current,
                            rows: clampInteger(event.target.value, 1, 8, current.rows)
                          }))
                        }
                      />
                    </div>

                    <p className="text-sm text-slate-500">
                      Bố cục hiện tại: {layout.columns} cột x {layout.rows} hàng = {labelsPerPage} tem/trang.
                    </p>
                    <p className="text-sm text-slate-500">
                      Lần in này sẽ bắt đầu từ Number {label.nextLabelNumber ?? '-'}.
                    </p>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-brand-900">
                        Ly do phat hanh them tem
                      </span>
                      <textarea
                        rows={3}
                        className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900 shadow-sm outline-none ring-0 placeholder:text-slate-400 focus:border-brand-500"
                        placeholder={
                          label.printedLabelCount > 0
                            ? 'Bat buoc nhap ly do in bo sung hoac in lai tem'
                            : 'Co the bo trong cho lan in dau tien'
                        }
                        {...register('reason')}
                      />
                    </label>
                    {reasonError ? <p className="text-sm text-danger">{reasonError}</p> : null}
                    {issueMutation.isError ? (
                      <p className="text-sm text-danger">
                        Không thể tạo tem. Lô này còn tối đa {label.remainingLabelCount} số để cấp.
                      </p>
                    ) : null}
                    <Button
                      type="submit"
                      fullWidth
                      disabled={issueMutation.isPending || label.remainingLabelCount <= 0}
                    >
                      {issueMutation.isPending ? 'Đang tạo tem...' : 'Tạo tem và mở in'}
                    </Button>
                  </form>
                </div>
              </div>
            </Card>

            {issuedJob ? (
              <>
                <div className="no-print rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Đã tạo {issuedJob.issuedQuantity} tem cho dãy Number {issuedJob.issuedFromNumber} - {issuedJob.issuedToNumber}.
                </div>

                <div className="space-y-6">
                  {printSheets.map((sheet, sheetIndex) => (
                    <section
                      key={`${issuedJob.batchId}-sheet-${sheetIndex}`}
                      className="print-sheet rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="print-sheet-grid" style={sheetStyle}>
                        {sheet.map((item) => (
                          <article
                            key={`${issuedJob.batchId}-${item.sequenceNumber}`}
                            className="print-card print-label-card"
                          >
                            <div className="label-header-row">
                              <div>
                                <p className="label-eyebrow">Tem nguyên liệu</p>
                                <h2 className="label-title">{issuedJob.ingredientName}</h2>
                              </div>
                              <div className="label-number-box">
                                <p className="label-number-caption">Number</p>
                                <p className="label-number">{item.sequenceNumber}</p>
                              </div>
                            </div>

                            <div className="label-meta">
                              <p>Mã lô: {issuedJob.batchCode}</p>
                              <p>Cửa hàng: {issuedJob.storeName}</p>
                              <p>Đơn vị: {issuedJob.unit}</p>
                              <p>Ngày nhập: {formatDate(issuedJob.receivedAt)}</p>
                              <p>Hạn dùng: {formatDate(issuedJob.expiredAt)}</p>
                            </div>

                            <div className="label-qr">
                              <QRCodeSVG value={item.qrCodeValue} size={96} level="M" includeMargin />
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </>
            ) : (
              <Card className="no-print rounded-[24px] border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-500">
                Nhập số tem cần in rồi bấm <span className="font-semibold text-brand-900">Tạo tem và mở in</span>.
                Hệ thống sẽ sinh dãy Number liên tục theo lô hiện tại và mỗi tem sẽ có một QR riêng.
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
