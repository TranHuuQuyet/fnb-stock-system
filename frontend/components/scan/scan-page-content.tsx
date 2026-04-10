"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useOfflineSync } from '@/hooks/use-offline-sync';
import { getDeviceId, getSession } from '@/lib/auth';
import { parseBatchQrValue } from '@/lib/batch-qr';
import { queueOfflineScan } from '@/lib/indexeddb';
import { localizeResultCode, localizeSyncState } from '@/lib/localization';
import { listStores } from '@/services/admin/stores';
import { listBatches } from '@/services/batches';
import { submitManualScan, submitScan } from '@/services/scan';
import { ProtectedPage } from '@/components/layout/protected-page';
import { QrScanner } from '@/components/scan/qr-scanner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const schema = z
  .object({
    batchCode: z.string().min(1, 'Vui lòng nhập mã lô'),
    quantityUsed: z.coerce.number().int('Số lượng phải là số nguyên').positive('Số lượng phải lớn hơn 0'),
    operationType: z.enum(['STORE_USAGE', 'TRANSFER']),
    destinationStoreId: z.string().optional()
  })
  .superRefine((value, ctx) => {
    if (value.operationType === 'TRANSFER' && !value.destinationStoreId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Vui lòng chọn chi nhánh nhận',
        path: ['destinationStoreId']
      });
    }
  });

type FormValues = z.infer<typeof schema>;
type ScanResponse = {
  resultStatus: 'SUCCESS' | 'WARNING' | 'ERROR';
  resultCode: string;
  message: string;
};

type ScanTone = 'idle' | 'success' | 'warning' | 'error' | 'offline';

type BrowserAudioContext = typeof AudioContext;
type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: BrowserAudioContext;
  };

let successAudioContext: AudioContext | null = null;

const getSuccessAudioContext = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const browserWindow = window as WindowWithWebkitAudio;
  const AudioContextCtor = browserWindow.AudioContext ?? browserWindow.webkitAudioContext;
  if (!AudioContextCtor) {
    return null;
  }

  if (!successAudioContext || successAudioContext.state === 'closed') {
    successAudioContext = new AudioContextCtor();
  }

  return successAudioContext;
};

const playSuccessBeep = async () => {
  const audioContext = getSuccessAudioContext();
  if (!audioContext) {
    return;
  }

  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
    oscillator.start(audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.15);
    oscillator.stop(audioContext.currentTime + 0.15);
    oscillator.onended = () => {
      oscillator.disconnect();
      gainNode.disconnect();
    };
  } catch {
    // Never let the success sound crash the scan screen.
  }
};

const toStoreQuery = (storeId: string) => `?storeId=${encodeURIComponent(storeId)}`;

export default function ScanPageContent() {
  const session = getSession();
  const isAdmin = session?.user.role === 'ADMIN';
  const { syncState, isOnline } = useOfflineSync();
  const [feedback, setFeedback] = useState<{
    tone: ScanTone;
    title: string;
    message: string;
  }>({
    tone: 'idle',
    title: 'Sẵn sàng',
    message: 'Quét mã QR của lô hoặc nhập mã lô thủ công.'
  });
  const [manualMode, setManualMode] = useState(false);

  const {
    register,
    setValue,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      batchCode: '',
      quantityUsed: 1,
      operationType: 'STORE_USAGE',
      destinationStoreId: ''
    }
  });

  const operationType = watch('operationType');
  const destinationStoreId = watch('destinationStoreId');

  const storesQuery = useQuery({
    queryKey: ['scan-transfer-stores'],
    queryFn: () => listStores(''),
    enabled: isAdmin
  });

  const destinationInventoryQuery = useQuery({
    queryKey: ['scan-transfer-destination-batches', destinationStoreId],
    queryFn: () => listBatches(toStoreQuery(destinationStoreId ?? '')),
    enabled: isAdmin && operationType === 'TRANSFER' && Boolean(destinationStoreId)
  });

  const destinationInventory = useMemo(() => {
    const batches = (destinationInventoryQuery.data?.data ?? []) as Array<{
      id: string;
      remainingQty: number;
      ingredient: { id: string; name: string; unit?: string | null };
    }>;
    const grouped = new Map<
      string,
      { ingredientName: string; totalQty: number; batchCount: number; unit: string }
    >();

    for (const batch of batches) {
      const current = grouped.get(batch.ingredient.id) ?? {
        ingredientName: batch.ingredient.name,
        totalQty: 0,
        batchCount: 0,
        unit: batch.ingredient.unit ?? ''
      };
      current.totalQty += batch.remainingQty;
      current.batchCount += 1;
      grouped.set(batch.ingredient.id, current);
    }

    return [...grouped.values()].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
  }, [destinationInventoryQuery.data]);

  const selectedDestinationStoreName = useMemo(() => {
    const stores = (storesQuery.data?.data ?? []) as Array<{ id: string; name: string }>;
    return stores.find((store) => store.id === destinationStoreId)?.name ?? '';
  }, [destinationStoreId, storesQuery.data]);

  const backgroundClass = useMemo(() => {
    switch (feedback.tone) {
      case 'success':
        return 'from-emerald-100 to-emerald-50';
      case 'warning':
        return 'from-amber-100 to-amber-50';
      case 'error':
        return 'from-rose-100 to-rose-50';
      case 'offline':
        return 'from-slate-200 to-slate-50';
      default:
        return 'from-brand-50 to-white';
    }
  }, [feedback.tone]);

  const scanMutation = useMutation<ScanResponse, Error, FormValues & { manual: boolean }>({
    mutationFn: async (values) => {
      const payload = {
        batchCode: values.batchCode,
        quantityUsed: values.quantityUsed,
        scannedAt: new Date().toISOString(),
        deviceId: getDeviceId(),
        clientEventId: crypto.randomUUID(),
        storeId: session?.user.store?.id,
        destinationStoreId:
          values.operationType === 'TRANSFER' ? values.destinationStoreId : undefined,
        operationType: values.operationType,
        entryMethod: (values.manual ? 'MANUAL' : 'CAMERA') as 'MANUAL' | 'CAMERA'
      };

      if (!isOnline) {
        await queueOfflineScan({
          ...payload,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
        return {
          resultStatus: 'SUCCESS',
          resultCode: 'OFFLINE_QUEUED',
          message: 'Lượt quét đã được lưu ngoại tuyến và sẽ tự đồng bộ khi có mạng.'
        };
      }

      try {
        return values.manual
          ? ((await submitManualScan(payload)) as ScanResponse)
          : ((await submitScan(payload)) as ScanResponse);
      } catch (error) {
        if (!navigator.onLine) {
          await queueOfflineScan({
            ...payload,
            status: 'pending',
            createdAt: new Date().toISOString()
          });
          return {
            resultStatus: 'SUCCESS',
            resultCode: 'OFFLINE_QUEUED',
            message: 'Mạng vừa mất, lượt quét đã được lưu ngoại tuyến.'
          };
        }

        throw error;
      }
    },
    onSuccess: async (data, variables) => {
      if (data.resultCode === 'OFFLINE_QUEUED') {
        setFeedback({
          tone: 'offline',
          title: 'Đã lưu ngoại tuyến',
          message: data.message
        });
        return;
      }

      if (data.resultStatus === 'WARNING') {
        setFeedback({
          tone: 'warning',
          title: localizeResultCode(data.resultCode),
          message: data.message
        });
        return;
      }

      setFeedback({
        tone: 'success',
        title: localizeResultCode(data.resultCode),
        message:
          variables.operationType === 'TRANSFER' && selectedDestinationStoreName
            ? `${data.message} Chi nhánh nhận: ${selectedDestinationStoreName}.`
            : data.message
      });
      void playSuccessBeep();
      if (variables.operationType === 'TRANSFER' && variables.destinationStoreId) {
        void destinationInventoryQuery.refetch();
      }
    },
    onError: (error: Error) => {
      setFeedback({
        tone: 'error',
        title: 'Từ chối quét',
        message: error.message
      });
    }
  });

  const stores = (storesQuery.data?.data ?? []) as Array<{ id: string; name: string }>;

  return (
    <ProtectedPage title="Quét nguyên liệu" allowedRoles={['STAFF', 'MANAGER', 'ADMIN']}>
      <div className={`rounded-3xl bg-gradient-to-br ${backgroundClass} p-4 md:p-6`}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge label={isOnline ? 'Trực tuyến' : 'Chế độ ngoại tuyến'} tone={isOnline ? 'success' : 'neutral'} />
          <Badge
            label={localizeSyncState(syncState)}
            tone={
              syncState === 'SYNCED'
                ? 'success'
                : syncState === 'SYNCING'
                  ? 'warning'
                  : syncState === 'SYNC_ERROR'
                    ? 'danger'
                    : 'neutral'
            }
          />
          <Button variant="secondary" onClick={() => setManualMode((value) => !value)}>
            {manualMode ? 'Dùng camera quét' : 'Nhập tay khi camera lỗi'}
          </Button>
        </div>

        <Card className="mb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">
            Trạng thái lần quét gần nhất
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-brand-900">{feedback.title}</h2>
          <p className="mt-2 text-sm text-slate-600">{feedback.message}</p>
        </Card>

        <Card className="mb-4">
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant={operationType === 'STORE_USAGE' ? 'primary' : 'secondary'}
              onClick={() => setValue('operationType', 'STORE_USAGE', { shouldValidate: true })}
            >
              Sử dụng tại quán
            </Button>
            {isAdmin ? (
              <Button
                type="button"
                variant={operationType === 'TRANSFER' ? 'primary' : 'secondary'}
                onClick={() => setValue('operationType', 'TRANSFER', { shouldValidate: true })}
              >
                Chuyển kho
              </Button>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-slate-600">
            {operationType === 'TRANSFER'
              ? `Chi nhánh thực hiện: ${session?.user.store?.name ?? 'Chưa xác định'}. Sau khi quét, hệ thống sẽ trừ tồn ở chi nhánh này và cộng sang chi nhánh nhận.`
              : 'Quét để ghi nhận nguyên liệu vừa được sử dụng tại quầy.'}
          </p>
        </Card>

        {!manualMode ? (
          <Card className="mb-4">
            <h3 className="mb-3 text-lg font-semibold text-brand-900">Quét bằng camera</h3>
            <QrScanner
              onError={(message) => {
                setManualMode(true);
                setFeedback({
                  tone: 'error',
                  title: 'Camera quét đang gặp lỗi',
                  message
                });
              }}
              onDetected={(value) => {
                const parsed = parseBatchQrValue(value);
                if (!parsed) {
                  setFeedback({
                    tone: 'error',
                    title: 'QR không hợp lệ',
                    message: 'Mã QR không đúng định dạng tem nguyên liệu'
                  });
                  return;
                }

                setValue('batchCode', parsed.batchCode, {
                  shouldDirty: true,
                  shouldValidate: true
                });
                setFeedback({
                  tone: 'idle',
                  title: 'Đã nhận diện lô',
                  message:
                    operationType === 'TRANSFER'
                      ? `Đã đọc lô ${parsed.batchCode}. Chọn chi nhánh nhận và số lượng rồi bấm chuyển kho.`
                      : `Đã đọc lô ${parsed.batchCode}. Nhập số lượng rồi bấm ghi nhận.`
                });
              }}
            />
          </Card>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),360px]">
          <Card>
            <form
              className="space-y-4"
              onSubmit={handleSubmit((values) =>
                scanMutation.mutate({ ...values, manual: manualMode })
              )}
            >
              <Input
                label="Mã lô"
                placeholder="BATCH-TRA-001"
                error={errors.batchCode?.message}
                {...register('batchCode')}
              />

              {isAdmin && operationType === 'TRANSFER' ? (
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-brand-900">Chi nhánh nhận</span>
                  <select
                    className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
                    {...register('destinationStoreId')}
                  >
                    <option value="">Chọn chi nhánh nhận</option>
                    {stores
                      .filter((store) => store.id !== session?.user.store?.id)
                      .map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                  </select>
                  {errors.destinationStoreId ? (
                    <span className="text-xs text-danger">{errors.destinationStoreId.message}</span>
                  ) : null}
                </label>
              ) : null}

              <Input
                label={operationType === 'TRANSFER' ? 'Số lượng chuyển' : 'Số lượng sử dụng'}
                type="number"
                min={1}
                step={1}
                error={errors.quantityUsed?.message}
                {...register('quantityUsed')}
              />

              <Button type="submit" fullWidth disabled={scanMutation.isPending}>
                {scanMutation.isPending
                  ? 'Đang gửi lượt quét...'
                  : operationType === 'TRANSFER'
                    ? manualMode
                      ? 'Gửi phiếu chuyển kho thủ công'
                      : 'Chuyển kho bằng lượt quét'
                    : manualMode
                      ? 'Gửi phiếu quét thủ công'
                      : 'Gửi kết quả quét'}
              </Button>
            </form>
          </Card>

          {isAdmin && operationType === 'TRANSFER' ? (
            <Card>
              <h3 className="text-lg font-semibold text-brand-900">Tồn kho chi nhánh nhận</h3>
              <p className="mt-2 text-sm text-slate-600">
                {selectedDestinationStoreName
                  ? `Đang xem tồn của ${selectedDestinationStoreName}.`
                  : 'Chọn chi nhánh để xem nguyên liệu và số lượng hiện có.'}
              </p>
              <div className="mt-4 space-y-3">
                {destinationInventoryQuery.isLoading ? (
                  <p className="text-sm text-slate-500">Đang tải tồn kho...</p>
                ) : destinationInventory.length === 0 ? (
                  <p className="text-sm text-slate-500">Chưa có dữ liệu tồn kho cho chi nhánh này.</p>
                ) : (
                  destinationInventory.map((item) => (
                    <div key={item.ingredientName} className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-brand-900">{item.ingredientName}</p>
                          <p className="text-xs text-slate-500">{item.batchCount} lô đang có tồn</p>
                        </div>
                        <p className="text-sm font-semibold text-brand-900">
                          {item.totalQty}
                          {item.unit ? ` ${item.unit}` : ''}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </ProtectedPage>
  );
}
