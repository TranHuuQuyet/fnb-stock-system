"use client";

import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getBatchLabel } from '@/services/batches';

export default function BatchLabelPage({ params }: { params: { id: string } }) {
  const query = useQuery({
    queryKey: ['batch-label', params.id],
    queryFn: () => getBatchLabel(params.id)
  });

  const label = query.data as
    | {
        ingredientName: string;
        batchCode: string;
        storeName: string;
        receivedAt: string;
        expiredAt?: string | null;
        labelCreatedAt?: string | null;
        qrCodeValue: string;
      }
    | undefined;

  return (
    <ProtectedPage title="Batch Label" allowedRoles={['ADMIN']}>
      <div className="space-y-4">
        <div className="no-print">
          <Button variant="secondary" onClick={() => window.print()}>
            Print label
          </Button>
        </div>

        {label ? (
          <Card className="mx-auto max-w-sm rounded-[24px] border border-slate-200 p-6">
            <div className="space-y-2 text-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">
                Ingredient batch label
              </p>
              <h2 className="text-xl font-semibold text-brand-900">{label.ingredientName}</h2>
              <p>Batch: {label.batchCode}</p>
              <p>Store: {label.storeName}</p>
              <p>Received: {new Date(label.receivedAt).toLocaleString('vi-VN')}</p>
              <p>
                Expired:{' '}
                {label.expiredAt
                  ? new Date(label.expiredAt).toLocaleString('vi-VN')
                  : 'N/A'}
              </p>
              <p>
                Label created:{' '}
                {label.labelCreatedAt
                  ? new Date(label.labelCreatedAt).toLocaleString('vi-VN')
                  : 'N/A'}
              </p>
            </div>
            <div className="mt-6 flex justify-center">
              <QRCodeSVG value={label.qrCodeValue} size={180} />
            </div>
          </Card>
        ) : null}
      </div>
    </ProtectedPage>
  );
}
