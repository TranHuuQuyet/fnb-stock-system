"use client";

import { useMutation, useQuery } from '@tanstack/react-query';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useResolvedSession } from '@/hooks/use-resolved-session';
import { SimpleTable } from '@/components/ui/table';
import { localizeResultStatus } from '@/lib/localization';
import { getDashboardSummary, runAnomalies } from '@/services/dashboard';

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());

export default function DashboardPage() {
  const sessionQuery = useResolvedSession();
  const session = sessionQuery.session;
  const storeId = session?.user.store?.id;
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary', storeId, today],
    queryFn: () => getDashboardSummary(storeId, today),
    enabled: sessionQuery.isSuccess
  });

  const anomalyMutation = useMutation({
    mutationFn: () => runAnomalies(storeId, today),
    onSuccess: () => summaryQuery.refetch()
  });

  const summary = summaryQuery.data as
    | {
        summary: {
          totalScans: number;
          success: number;
          warning: number;
          error: number;
          fraudAttempts: number;
          anomalyAlerts: number;
        };
        reconciliation: Array<{
          ingredientId: string;
          ingredientName: string;
          expectedQty: number;
          actualQty: number;
          ratio: number;
          belowThreshold: boolean;
        }>;
        recentFraudAttempts: Array<{ id: string; attemptType: string; detail: string }>;
        recentScanLogs: Array<{
          id: string;
          resultStatus: 'SUCCESS' | 'WARNING' | 'ERROR';
          message: string;
          batch?: { batchCode?: string | null } | null;
        }>;
        recentAlerts: Array<{
          id: string;
          ratio: number;
          message: string;
          ingredient: { name: string };
        }>;
      }
    | undefined;

  return (
    <ProtectedPage title="Bảng điều khiển" allowedRoles={['MANAGER', 'ADMIN']}>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Card className="sm:col-span-2 xl:col-span-3 2xl:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-brand-900">Tổng quan ngày {today}</h2>
              <p className="text-sm text-slate-500">
                Dữ liệu lấy trực tiếp từ lịch sử quét, cảnh báo gian lận và đối soát POS.
              </p>
            </div>
            <Button onClick={() => anomalyMutation.mutate()} disabled={anomalyMutation.isPending}>
              {anomalyMutation.isPending
                ? 'Đang phân tích bất thường...'
                : 'Chạy phát hiện bất thường'}
            </Button>
          </div>
        </Card>

        {summaryQuery.isError ? (
          <Card className="sm:col-span-2 xl:col-span-3 2xl:col-span-6">
            <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">
              {(summaryQuery.error as Error).message}
            </p>
          </Card>
        ) : null}

        {summary ? (
          <>
            {[
              ['Tổng lượt quét', summary.summary.totalScans],
              ['Thành công', summary.summary.success],
              ['Cảnh báo', summary.summary.warning],
              ['Lỗi', summary.summary.error],
              ['Nghi vấn gian lận', summary.summary.fraudAttempts],
              ['Cảnh báo bất thường', summary.summary.anomalyAlerts]
            ].map(([label, value]) => (
              <Card key={label}>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-3 text-3xl font-semibold text-brand-900">{value}</p>
              </Card>
            ))}
          </>
        ) : null}
      </div>

      {summary ? (
        <>
          <Card>
            <h3 className="mb-4 text-lg font-semibold text-brand-900">Đối soát</h3>
            <SimpleTable
              columns={['Nguyên liệu', 'Dự kiến', 'Thực tế', 'Tỷ lệ', 'Gợi ý']}
              rows={summary.reconciliation.map((item: any) => [
                item.ingredientName,
                item.expectedQty,
                item.actualQty,
                <Badge
                  key={`${item.ingredientId}-ratio`}
                  label={`${Math.round(item.ratio * 100)}%`}
                  tone={item.belowThreshold ? 'danger' : 'success'}
                />,
                item.belowThreshold ? 'Kiểm tra camera hoặc quy trình quét' : 'Bình thường'
              ])}
            />
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <h3 className="mb-4 text-lg font-semibold text-brand-900">Nghi vấn gian lận gần đây</h3>
              <div className="space-y-3 text-sm">
                {summary.recentFraudAttempts.map((item: any) => (
                  <div key={item.id} className="rounded-2xl bg-rose-50 p-3">
                    <p className="font-medium text-rose-700">{item.attemptType}</p>
                    <p>{item.detail}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="mb-4 text-lg font-semibold text-brand-900">Lịch sử quét gần đây</h3>
              <div className="space-y-3 text-sm">
                {summary.recentScanLogs.map((item: any) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{item.batch?.batchCode ?? 'Không rõ mã lô'}</p>
                      <Badge
                        label={localizeResultStatus(item.resultStatus)}
                        tone={
                          item.resultStatus === 'SUCCESS'
                            ? 'success'
                            : item.resultStatus === 'WARNING'
                              ? 'warning'
                              : 'danger'
                        }
                      />
                    </div>
                    <p>{item.message}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="mb-4 text-lg font-semibold text-brand-900">Cảnh báo gần đây</h3>
              <div className="space-y-3 text-sm">
                {summary.recentAlerts.map((item: any) => (
                  <div key={item.id} className="rounded-2xl bg-amber-50 p-3">
                    <p className="font-medium">{item.ingredient.name}</p>
                    <p>{item.message}</p>
                    <p className="text-xs text-slate-500">Tỷ lệ: {item.ratio}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </ProtectedPage>
  );
}
