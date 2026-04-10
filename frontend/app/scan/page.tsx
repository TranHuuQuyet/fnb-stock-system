export { default } from '@/components/scan/scan-page-content';
/*
"use client";

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ProtectedPage } from '@/components/layout/protected-page';
import { QrScanner } from '@/components/scan/qr-scanner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { getDeviceId, getSession } from '@/lib/auth';
import { parseBatchQrValue } from '@/lib/batch-qr';
import { queueOfflineScan } from '@/lib/indexeddb';
import { localizeResultCode, localizeSyncState } from '@/lib/localization';
import { useOfflineSync } from '@/hooks/use-offline-sync';
import { submitManualScan, submitScan } from '@/services/scan';

const schema = z.object({
  batchCode: z.string().min(1, 'Vui lòng nhập mã lô'),
  quantityUsed: z.coerce.number().positive('Số lượng phải lớn hơn 0')
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

export default function ScanPage() {
  const session = getSession();
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
    formState: { errors }
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      batchCode: '',
      quantityUsed: 0
    }
  });

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
    mutationFn: async (values: FormValues & { manual: boolean }) => {
      const payload = {
        batchCode: values.batchCode,
        quantityUsed: values.quantityUsed,
        scannedAt: new Date().toISOString(),
        deviceId: getDeviceId(),
        clientEventId: crypto.randomUUID(),
        storeId: session?.user.store?.id,
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
    onSuccess: async (data) => {
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
        message: data.message
      });
      void playSuccessBeep();
    },
    onError: (error: Error) => {
      setFeedback({
        tone: 'error',
        title: 'Từ chối quét',
        message: error.message
      });
    }
  });

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
                  message: parsed.sequenceNumber
                    ? `Đã đọc lô ${parsed.batchCode}, tem số ${parsed.sequenceNumber}. Nhập số lượng rồi bấm gửi.`
                    : `Đã đọc lô ${parsed.batchCode}. Nhập số lượng rồi bấm gửi.`
                });
              }}
            />
          </Card>
        ) : null}

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
            <Input
              label="Số lượng sử dụng"
              type="number"
              step="0.001"
              error={errors.quantityUsed?.message}
              {...register('quantityUsed')}
            />
            <Button type="submit" fullWidth disabled={scanMutation.isPending}>
              {scanMutation.isPending
                ? 'Đang gửi lượt quét...'
                : manualMode
                  ? 'Gửi phiếu quét thủ công'
                  : 'Gửi kết quả quét'}
            </Button>
          </form>
        </Card>
      </div>
    </ProtectedPage>
  );
}
*/
