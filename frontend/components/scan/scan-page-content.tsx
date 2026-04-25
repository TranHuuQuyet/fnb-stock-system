"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ProtectedPage } from '@/components/layout/protected-page';
import { QrScanner } from '@/components/scan/qr-scanner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useResolvedSession } from '@/hooks/use-resolved-session';
import { getDeviceId } from '@/lib/auth';
import { parseBatchQrValue } from '@/lib/batch-qr';
import { localizeResultCode } from '@/lib/localization';
import { listBatches } from '@/services/batches';
import { getScanNetworkStatus, submitScan } from '@/services/scan';
import { listTransferStores } from '@/services/transfers';

const schema = z
  .object({
    batchCode: z.string().min(1, 'Vui lòng nhập mã lô'),
    quantityUsed: z.coerce.number().positive('Số lượng phải lớn hơn 0'),
    operationType: z.enum(['STORE_USAGE', 'TRANSFER']),
    storeId: z.string().optional(),
    sourceStoreId: z.string().optional(),
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
  batchCode: string;
  remainingQty?: number;
  ingredientName?: string;
  ingredientUnit?: string | null;
};

type ScanMutationValues = {
  operationType: 'STORE_USAGE' | 'TRANSFER';
  batchCode: string;
  quantityUsed?: number;
  storeId?: string;
  sourceStoreId?: string;
  destinationStoreId?: string;
  scannedLabelValue?: string;
  scannedLabelBatchId?: string;
  scannedLabelSequenceNumber?: number;
};

type NetworkStatus = {
  storeId: string;
  ipAddress: string;
  normalizedIpAddress: string;
  hasActiveWhitelist: boolean;
  isAllowed?: boolean;
  isAllowedByWhitelist: boolean;
  matchedWhitelistTypes: Array<'IP' | 'SSID'>;
  bypassEnabled: boolean;
  bypassActive: boolean;
  bypassExpiresAt: string | null;
  bypassReason: string | null;
  canAccessBusinessOperations: boolean;
};

type ScanTone = 'idle' | 'success' | 'warning' | 'error';
type ScanFeedback = {
  tone: ScanTone;
  title: string;
  message: string;
};

type BrowserAudioContext = typeof AudioContext;
type WindowWithWebkitAudio = Window &
  typeof globalThis & {
    webkitAudioContext?: BrowserAudioContext;
  };

let successAudioContext: AudioContext | null = null;
const idleFeedback: ScanFeedback = {
  tone: 'idle',
  title: 'Sẵn sàng',
  message: 'Đưa tem QR vào camera. Quét thành công sẽ tự trừ 1 nguyên liệu.'
};

const quantityFormatter = new Intl.NumberFormat('vi-VN', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
});

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

    const beepPlan = [
      { startOffset: 0, frequency: 880 },
      { startOffset: 0.2, frequency: 1100 }
    ];

    for (const beep of beepPlan) {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      const startAt = audioContext.currentTime + beep.startOffset;
      const endAt = startAt + 0.16;

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(beep.frequency, startAt);
      gainNode.gain.setValueAtTime(0.18, startAt);
      gainNode.gain.exponentialRampToValueAtTime(0.00001, endAt);
      oscillator.start(startAt);
      oscillator.stop(endAt);
      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
      };
    }
  } catch {
    // Never let the success sound crash the scan screen.
  }
};

const toStoreQuery = (storeId: string) => `?storeId=${encodeURIComponent(storeId)}`;

export default function ScanPageContent() {
  const sessionQuery = useResolvedSession();
  const session = sessionQuery.session;
  const queryClient = useQueryClient();
  const { isOnline } = useNetworkStatus();
  const isAdmin = session?.user.role === 'ADMIN';
  const isManager = session?.user.role === 'MANAGER';
  const canTransfer =
    isAdmin || isManager || (session?.user.permissions ?? []).includes('scan_transfer');

  const [feedback, setFeedback] = useState<ScanFeedback>(idleFeedback);
  const [activeAlert, setActiveAlert] = useState<ScanFeedback | null>(null);

  const getPersistedStoreId = (key: string, defaultValue: string | undefined) => {
    if (typeof window === 'undefined') {
      return defaultValue;
    }

    try {
      const stored = localStorage.getItem(`scan-${key}`);
      return stored || defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const persistStoreId = (key: string, value: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(`scan-${key}`, value);
    } catch {
      // Ignore storage errors.
    }
  };

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
      storeId: getPersistedStoreId('usage-store', session?.user.store?.id),
      sourceStoreId: getPersistedStoreId('transfer-source', session?.user.store?.id),
      destinationStoreId: getPersistedStoreId('transfer-destination', '')
    }
  });

  const operationType = watch('operationType');
  const storeId = watch('storeId');
  const sourceStoreId = watch('sourceStoreId');
  const destinationStoreId = watch('destinationStoreId');
  const networkStatusStoreId = operationType === 'TRANSFER' ? sourceStoreId : storeId;
  const isQuickStoreUsageMode = !isAdmin && operationType === 'STORE_USAGE';

  useEffect(() => {
    if (!canTransfer && operationType === 'TRANSFER') {
      setValue('operationType', 'STORE_USAGE', { shouldValidate: true });
    }
  }, [canTransfer, operationType, setValue]);

  useEffect(() => {
    const currentStoreId = session?.user.store?.id;
    if (!sessionQuery.isSuccess || !currentStoreId) {
      return;
    }

    if (!storeId) {
      setValue('storeId', currentStoreId, { shouldValidate: true });
    }

    if (!sourceStoreId) {
      setValue('sourceStoreId', currentStoreId, { shouldValidate: true });
    }
  }, [session?.user.store?.id, sessionQuery.isSuccess, setValue, sourceStoreId, storeId]);

  useEffect(() => {
    if (storeId) {
      persistStoreId('usage-store', storeId);
    }
  }, [storeId]);

  useEffect(() => {
    if (sourceStoreId) {
      persistStoreId('transfer-source', sourceStoreId);
    }
  }, [sourceStoreId]);

  useEffect(() => {
    if (destinationStoreId) {
      persistStoreId('transfer-destination', destinationStoreId);
    }
  }, [destinationStoreId]);

  const storesQuery = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['scan-stores'],
    queryFn: () => listTransferStores(),
    enabled: sessionQuery.isSuccess && (isAdmin || canTransfer)
  });

  const destinationInventoryQuery = useQuery({
    queryKey: ['scan-transfer-destination-batches', destinationStoreId],
    queryFn: () => listBatches(toStoreQuery(destinationStoreId ?? '')),
    enabled:
      sessionQuery.isSuccess &&
      isAdmin &&
      operationType === 'TRANSFER' &&
      Boolean(destinationStoreId)
  });

  const networkStatusQuery = useQuery<NetworkStatus>({
    queryKey: ['scan-network-status', isAdmin ? networkStatusStoreId ?? 'no-store' : 'current-store'],
    queryFn: () => {
      const params = new URLSearchParams();
      if (isAdmin && networkStatusStoreId) {
        params.set('storeId', networkStatusStoreId);
      }

      const query = params.toString();
      return getScanNetworkStatus(query ? `?${query}` : '');
    },
    enabled:
      sessionQuery.isSuccess &&
      isOnline &&
      (!isAdmin || Boolean(networkStatusStoreId))
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

  const stores = storesQuery.data ?? [];
  const selectedDestinationStoreName =
    stores.find((store) => store.id === destinationStoreId)?.name ?? '';
  const selectedUsageStoreName = stores.find((store) => store.id === storeId)?.name ?? '';
  const selectedSourceStoreName = stores.find((store) => store.id === sourceStoreId)?.name ?? '';
  const networkStatusStoreName =
    operationType === 'TRANSFER'
      ? selectedSourceStoreName || session?.user.store?.name || 'chi nhánh hiện tại'
      : selectedUsageStoreName || session?.user.store?.name || 'chi nhánh hiện tại';

  const businessNetworkBadge = useMemo(() => {
    if (!isOnline) {
      return {
        label: 'Offline',
        tone: 'neutral' as const
      };
    }

    if (isAdmin && !networkStatusStoreId) {
      return {
        label: 'Chọn chi nhánh để kiểm tra',
        tone: 'neutral' as const
      };
    }

    if (networkStatusQuery.isLoading) {
      return {
        label: 'Đang kiểm tra mạng',
        tone: 'warning' as const
      };
    }

    if (networkStatusQuery.isError) {
      return {
        label: 'Không kiểm tra được mạng',
        tone: 'danger' as const
      };
    }

    const networkStatus = networkStatusQuery.data;
    if (!networkStatus?.hasActiveWhitelist) {
      return {
        label: 'Chưa cấu hình whitelist',
        tone: 'danger' as const
      };
    }

    if (networkStatus.bypassActive) {
      return {
        label: 'Đang bật bypass tạm',
        tone: 'warning' as const
      };
    }

    return networkStatus.canAccessBusinessOperations
      ? {
          label: 'Mạng được phép',
          tone: 'success' as const
        }
      : {
          label: 'Mạng chưa được phép',
          tone: 'danger' as const
        };
  }, [
    isAdmin,
    isOnline,
    networkStatusQuery.data,
    networkStatusQuery.isError,
    networkStatusQuery.isLoading,
    networkStatusStoreId
  ]);

  const businessNetworkMessage = useMemo(() => {
    if (!isOnline) {
      return 'Thiết bị đang offline. Nghiệp vụ scan chỉ được phép khi online đúng mạng hợp lệ.';
    }

    if (isAdmin && !networkStatusStoreId) {
      return 'Hãy chọn chi nhánh nguồn hoặc chi nhánh sử dụng trước khi thực hiện scan.';
    }

    if (networkStatusQuery.isLoading) {
      return 'Đang lấy IP mà backend thực sự nhìn thấy từ request hiện tại.';
    }

    if (networkStatusQuery.isError) {
      return 'Chưa lấy được trạng thái whitelist. Hãy tải lại trang để kiểm tra lại.';
    }

    const networkStatus = networkStatusQuery.data;
    if (!networkStatus) {
      return 'Chưa có dữ liệu trạng thái mạng.';
    }

    const matchedBy =
      networkStatus.matchedWhitelistTypes.length > 0
        ? ` Khớp theo ${networkStatus.matchedWhitelistTypes.join(' + ')}.`
        : '';

    if (!networkStatus.hasActiveWhitelist) {
      return `Chi nhánh ${networkStatusStoreName} chưa có whitelist active. API nghiệp vụ sẽ bị chặn cho đến khi admin cấu hình IP được phép hoặc bật bypass tạm thời.`;
    }

    if (networkStatus.bypassActive) {
      return `Chi nhánh ${networkStatusStoreName} đang được mở tạm. ${
        networkStatus.bypassReason ? `Lý do: ${networkStatus.bypassReason}. ` : ''
      }IP backend đang nhận là ${networkStatus.ipAddress}.`;
    }

    return networkStatus.canAccessBusinessOperations
      ? `Chi nhánh ${networkStatusStoreName} đang cho phép mạng hiện tại. IP backend đang nhận là ${networkStatus.ipAddress}.${matchedBy}`
      : `Chi nhánh ${networkStatusStoreName} đang chặn mạng hiện tại. IP backend đang nhận là ${networkStatus.ipAddress}. Backend sẽ từ chối nghiệp vụ nếu tiếp tục thao tác.`;
  }, [
    isAdmin,
    isOnline,
    networkStatusQuery.data,
    networkStatusQuery.isError,
    networkStatusQuery.isLoading,
    networkStatusStoreId,
    networkStatusStoreName
  ]);

  const backgroundClass = useMemo(() => {
    switch (feedback.tone) {
      case 'success':
        return 'from-emerald-100 to-emerald-50';
      case 'warning':
        return 'from-amber-100 to-amber-50';
      case 'error':
        return 'from-rose-100 to-rose-50';
      default:
        return 'from-brand-50 to-white';
    }
  }, [feedback.tone]);

  useEffect(() => {
    if (!activeAlert) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setActiveAlert(null);
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [activeAlert]);

  const pushFeedback = (nextFeedback: ScanFeedback, showAlert = true) => {
    setFeedback(nextFeedback);
    setActiveAlert(showAlert && nextFeedback.tone !== 'idle' ? nextFeedback : null);
  };

  const buildStoreUsageMessage = (data: ScanResponse) => {
    const details = [
      data.ingredientName ? `Nguyên liệu: ${data.ingredientName}.` : null,
      `Mã lô: ${data.batchCode}.`,
      data.remainingQty !== undefined
        ? `Còn lại: ${quantityFormatter.format(data.remainingQty)}${
            data.ingredientUnit ? ` ${data.ingredientUnit}` : ''
          }.`
        : null,
      selectedUsageStoreName && selectedUsageStoreName !== session?.user.store?.name
        ? `Chi nhánh sử dụng: ${selectedUsageStoreName}.`
        : null
    ].filter(Boolean);

    return [data.message, ...details].join(' ');
  };

  const scanMutation = useMutation<ScanResponse, Error, ScanMutationValues>({
    mutationFn: async (values) => {
      if (!isOnline) {
        throw new Error(
          values.operationType === 'TRANSFER'
            ? 'Thiết bị đang offline. Chuyển kho cần online để theo dõi và xác nhận phiếu.'
            : 'Thiết bị đang offline. Theo chính sách mới, bạn phải online đúng mạng chi nhánh mới được quét.'
        );
      }

      const payload = {
        batchCode: values.batchCode,
        quantityUsed: values.quantityUsed ?? 1,
        scannedAt: new Date().toISOString(),
        deviceId: getDeviceId(),
        clientEventId: crypto.randomUUID(),
        storeId: values.operationType === 'STORE_USAGE' ? values.storeId : values.sourceStoreId,
        destinationStoreId:
          values.operationType === 'TRANSFER' ? values.destinationStoreId : undefined,
        operationType: values.operationType,
        entryMethod: 'CAMERA' as const,
        scannedLabelValue: values.scannedLabelValue,
        scannedLabelBatchId: values.scannedLabelBatchId,
        scannedLabelSequenceNumber: values.scannedLabelSequenceNumber
      };

      try {
        return (await submitScan(payload)) as ScanResponse;
      } catch (error) {
        if (!navigator.onLine) {
          throw new Error(
            values.operationType === 'TRANSFER'
              ? 'Mạng vừa mất. Hãy kết nối lại để hoàn tất tạo phiếu chuyển kho.'
              : 'Mạng vừa mất. Hãy kết nối lại đúng mạng chi nhánh rồi quét lại.'
          );
        }

        throw error;
      }
    },
    onSuccess: async (data, variables) => {
      pushFeedback({
        tone: data.resultStatus === 'WARNING' ? 'warning' : 'success',
        title: localizeResultCode(data.resultCode),
        message:
          variables.operationType === 'TRANSFER' && selectedDestinationStoreName
            ? `${data.message} Chi nhánh nhận: ${selectedDestinationStoreName}. ${
                selectedSourceStoreName && selectedSourceStoreName !== session?.user.store?.name
                  ? `Chi nhánh gửi: ${selectedSourceStoreName}.`
                  : ''
              }`
            : variables.operationType === 'STORE_USAGE'
              ? buildStoreUsageMessage(data)
              : data.message
      });

      void playSuccessBeep();

      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ['ingredient-stock-board'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-batches'] })
      ];

      if (variables.operationType === 'STORE_USAGE') {
        invalidations.push(
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
          queryClient.invalidateQueries({ queryKey: ['scan-logs'] })
        );
      } else {
        invalidations.push(queryClient.invalidateQueries({ queryKey: ['transfers'] }));
      }

      await Promise.all(invalidations);

      if (variables.operationType !== 'STORE_USAGE') {
        setValue('batchCode', '');
      }

      if (variables.operationType === 'TRANSFER' && variables.destinationStoreId) {
        void destinationInventoryQuery.refetch();
      }
    },
    onError: (error: Error) => {
      pushFeedback({
        tone: 'error',
        title: 'Từ chối quét',
        message: error.message
      });
    }
  });

  const handleQrDetected = (value: string) => {
    if (scanMutation.isPending) {
      return;
    }

    const parsed = parseBatchQrValue(value);
    if (!parsed) {
      pushFeedback({
        tone: 'error',
        title: 'QR không hợp lệ',
        message: 'Mã QR không đúng định dạng tem nguyên liệu.'
      });
      return;
    }

    if (isQuickStoreUsageMode) {
      if (!parsed.batchId || parsed.sequenceNumber === null) {
        pushFeedback({
          tone: 'error',
          title: 'Tem chưa hợp lệ',
          message:
            'Chế độ quét nhanh chỉ nhận tem đã phát hành có số thứ tự. Hãy in tem mới rồi quét lại.'
        });
        return;
      }

      scanMutation.mutate({
        operationType: 'STORE_USAGE',
        batchCode: parsed.batchCode,
        quantityUsed: 1,
        storeId,
        scannedLabelValue: parsed.rawValue,
        scannedLabelBatchId: parsed.batchId,
        scannedLabelSequenceNumber: parsed.sequenceNumber
      });
      return;
    }

    setValue('batchCode', parsed.batchCode, {
      shouldDirty: true,
      shouldValidate: true
    });
    pushFeedback({
      tone: 'idle',
      title: 'Đã nhận diện lô',
      message:
        operationType === 'TRANSFER'
          ? `Đã đọc lô ${parsed.batchCode}. Chọn chi nhánh nhận và số lượng rồi bấm chuyển kho.`
          : `Đã đọc lô ${parsed.batchCode}. Điều chỉnh thông tin nếu cần rồi bấm ghi nhận.`
    }, false);
  };

  const handleCameraError = (message: string) => {
    pushFeedback({
      tone: 'error',
      title: 'Camera quét gặp lỗi',
      message
    });
  };

  return (
    <ProtectedPage title="Quét nguyên liệu" allowedRoles={['STAFF', 'MANAGER', 'ADMIN']}>
      {activeAlert ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
          <div
            role="alert"
            aria-live="assertive"
            className={`pointer-events-auto w-full max-w-2xl rounded-3xl border px-5 py-4 shadow-2xl backdrop-blur ${
              activeAlert.tone === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : activeAlert.tone === 'warning'
                  ? 'border-amber-300 bg-amber-50 text-amber-950'
                  : 'border-rose-300 bg-rose-50 text-rose-950'
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-1 h-3 w-3 rounded-full ${
                  activeAlert.tone === 'success'
                    ? 'bg-emerald-500'
                    : activeAlert.tone === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                }`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold uppercase tracking-[0.2em]">Thông báo quét</p>
                <h2 className="mt-1 text-xl font-semibold">{activeAlert.title}</h2>
                <p className="mt-2 text-sm leading-6">{activeAlert.message}</p>
              </div>
              <button
                type="button"
                className="rounded-full px-3 py-1 text-sm font-semibold text-current/80 transition hover:bg-black/5 hover:text-current"
                onClick={() => setActiveAlert(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className={`rounded-3xl bg-gradient-to-br ${backgroundClass} p-4 md:p-6`}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Badge
            label={isOnline ? 'Trực tuyến' : 'Offline'}
            tone={isOnline ? 'success' : 'neutral'}
          />
          {isQuickStoreUsageMode ? (
            <Badge label="Tự trừ 1" tone="success" />
          ) : operationType === 'TRANSFER' ? (
            <Badge label="Chuyển kho" tone="warning" />
          ) : null}
        </div>

        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">
              Trạng thái mạng hiện tại
            </p>
            <Badge label={businessNetworkBadge.label} tone={businessNetworkBadge.tone} />
          </div>
          <p className="mt-2 text-sm text-slate-600">{businessNetworkMessage}</p>
        </Card>

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
            {canTransfer ? (
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
              ? `Chi nhánh thực hiện: ${session?.user.store?.name ?? 'Chưa xác định'}. Sau khi quét, hệ thống sẽ trừ tồn ở chi nhánh gửi và tạo phiếu chuyển kho.`
              : isQuickStoreUsageMode
                ? `Quét thành công là hệ thống tự trừ ngay 1 đơn vị tại ${session?.user.store?.name ?? 'chi nhánh hiện tại'}. Không cần nhập tay, không cần bấm gửi.`
                : `Quét để ghi nhận nguyên liệu vừa được sử dụng tại quầy. ${isAdmin && selectedUsageStoreName && selectedUsageStoreName !== session?.user.store?.name ? `Chi nhánh sử dụng: ${selectedUsageStoreName}.` : ''}`}
          </p>
        </Card>

        {isQuickStoreUsageMode ? (
          <Card className="mb-4 border border-emerald-200 bg-emerald-50">
            <p className="text-sm font-medium text-emerald-900">
              Mỗi tem đã phát hành chỉ được quét 1 lần. Hệ thống chỉ chấp nhận tem có số thứ tự
              và sẽ phát tiếng bíp bíp sau khi trừ kho thành công.
            </p>
          </Card>
        ) : null}

        {operationType === 'TRANSFER' ? (
          <Card className="mb-4 border border-amber-200 bg-amber-50">
            <p className="text-sm font-medium text-amber-900">
              Lượt quét chuyển kho chỉ tạo phiếu và trừ tồn ở chi nhánh gửi. Chi nhánh nhận cần vào
              lịch sử chuyển kho để xác nhận số lượng thực nhận.
            </p>
          </Card>
        ) : null}

        <Card className="mb-4">
          <h3 className="mb-3 text-lg font-semibold text-brand-900">Quét bằng camera</h3>
          <p className="mb-4 text-sm text-slate-600">
            {isQuickStoreUsageMode
              ? 'Đưa tem vào khung quét. Khi QR hợp lệ, hệ thống sẽ xử lý ngay không cần bấm nút.'
              : 'Quét để điền mã lô vào form bên dưới, sau đó xác nhận thao tác.'}
          </p>
          <QrScanner onDetected={handleQrDetected} onError={handleCameraError} />
        </Card>

        {isQuickStoreUsageMode ? (
          <Card>
            <h3 className="text-lg font-semibold text-brand-900">Chế độ quét nhanh</h3>
            <p className="mt-2 text-sm text-slate-600">
              Scan thành công sẽ trừ ngay 1 đơn vị. Nếu quét lại cùng một tem, backend sẽ từ chối để
              tránh trùng lặp.
            </p>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),360px]">
            <Card>
              <form
                className="space-y-4"
                onSubmit={handleSubmit((values) =>
                  scanMutation.mutate({
                    operationType: values.operationType,
                    batchCode: values.batchCode,
                    quantityUsed: values.quantityUsed,
                    storeId: values.storeId,
                    sourceStoreId: values.sourceStoreId,
                    destinationStoreId: values.destinationStoreId
                  })
                )}
              >
                <Input
                  label="Mã lô"
                  placeholder="BATCH-TRA-001"
                  error={errors.batchCode?.message}
                  {...register('batchCode')}
                />

                {isAdmin && operationType === 'STORE_USAGE' ? (
                  <label className="block space-y-2">
                    <span className="text-sm font-medium text-brand-900">Chi nhánh sử dụng</span>
                    <select
                      className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
                      {...register('storeId')}
                    >
                      <option value="">Chọn chi nhánh sử dụng</option>
                      {stores.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                    {errors.storeId ? (
                      <span className="text-xs text-danger">{errors.storeId.message}</span>
                    ) : null}
                  </label>
                ) : null}

                {canTransfer && operationType === 'TRANSFER' ? (
                  <>
                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-brand-900">Chi nhánh gửi</span>
                      <select
                        className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
                        disabled={!isAdmin}
                        {...register('sourceStoreId')}
                      >
                        <option value="">Chọn chi nhánh gửi</option>
                        {stores
                          .filter((store) =>
                            isAdmin
                              ? store.id !== destinationStoreId
                              : store.id === session?.user.store?.id
                          )
                          .map((store) => (
                            <option key={store.id} value={store.id}>
                              {store.name}
                            </option>
                          ))}
                      </select>
                      {errors.sourceStoreId ? (
                        <span className="text-xs text-danger">{errors.sourceStoreId.message}</span>
                      ) : null}
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-medium text-brand-900">Chi nhánh nhận</span>
                      <select
                        className="w-full rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm text-brand-900"
                        {...register('destinationStoreId')}
                      >
                        <option value="">Chọn chi nhánh nhận</option>
                        {stores
                          .filter((store) => store.id !== sourceStoreId)
                          .map((store) => (
                            <option key={store.id} value={store.id}>
                              {store.name}
                            </option>
                          ))}
                      </select>
                      {errors.destinationStoreId ? (
                        <span className="text-xs text-danger">
                          {errors.destinationStoreId.message}
                        </span>
                      ) : null}
                    </label>
                  </>
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
                    ? 'Đang xử lý lượt quét...'
                    : operationType === 'TRANSFER'
                      ? 'Chuyển kho bằng lượt quét'
                      : 'Ghi nhận lượt quét'}
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
                    <p className="text-sm text-slate-500">
                      Chưa có dữ liệu tồn kho cho chi nhánh này.
                    </p>
                  ) : (
                    destinationInventory.map((item) => (
                      <div
                        key={item.ingredientName}
                        className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-medium text-brand-900">{item.ingredientName}</p>
                            <p className="text-xs text-slate-500">{item.batchCount} lô đang có tồn</p>
                          </div>
                          <p className="text-sm font-semibold text-brand-900">
                            {quantityFormatter.format(item.totalQty)}
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
        )}
      </div>
    </ProtectedPage>
  );
}
