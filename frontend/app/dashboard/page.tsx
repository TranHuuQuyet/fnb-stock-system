"use client";

import { useMutation, useQuery } from '@tanstack/react-query';

import { ProtectedPage } from '@/components/layout/protected-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SimpleTable } from '@/components/ui/table';
import { getSession } from '@/lib/auth';
import { getDashboardSummary, runAnomalies } from '@/services/dashboard';

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
}).format(new Date());

export default function DashboardPage() {
  const session = getSession();
  const storeId = session?.user.store?.id;
  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary', storeId, today],
    queryFn: () => getDashboardSummary(storeId, today)
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
    <ProtectedPage title="Dashboard" allowedRoles={['MANAGER', 'ADMIN']}>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-brand-900">Tổng quan ngày {today}</h2>
              <p className="text-sm text-slate-500">
                Dữ liệu lấy trực tiếp từ scan logs, fraud logs và POS reconciliation.
              </p>
            </div>
            <Button onClick={() => anomalyMutation.mutate()} disabled={anomalyMutation.isPending}>
              {anomalyMutation.isPending ? 'Đang chạy anomaly...' : 'Run anomaly detection'}
            </Button>
          </div>
        </Card>

        {summary ? (
          <>
            {[
              ['Total scans', summary.summary.totalScans],
              ['Success', summary.summary.success],
              ['Warning', summary.summary.warning],
              ['Error', summary.summary.error],
              ['Fraud attempts', summary.summary.fraudAttempts],
              ['Anomaly alerts', summary.summary.anomalyAlerts]
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
            <h3 className="mb-4 text-lg font-semibold text-brand-900">Reconciliation</h3>
            <SimpleTable
              columns={['Ingredient', 'Expected', 'Actual', 'Ratio', 'Hint']}
              rows={summary.reconciliation.map((item: any) => [
                item.ingredientName,
                item.expectedQty,
                item.actualQty,
                <Badge
                  key={`${item.ingredientId}-ratio`}
                  label={`${Math.round(item.ratio * 100)}%`}
                  tone={item.belowThreshold ? 'danger' : 'success'}
                />,
                item.belowThreshold ? 'Check camera / scan discipline' : 'Normal'
              ])}
            />
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <h3 className="mb-4 text-lg font-semibold text-brand-900">Recent fraud attempts</h3>
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
              <h3 className="mb-4 text-lg font-semibold text-brand-900">Recent scan logs</h3>
              <div className="space-y-3 text-sm">
                {summary.recentScanLogs.map((item: any) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{item.batch?.batchCode ?? 'Unknown batch'}</p>
                      <Badge
                        label={item.resultStatus}
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
              <h3 className="mb-4 text-lg font-semibold text-brand-900">Recent alerts</h3>
              <div className="space-y-3 text-sm">
                {summary.recentAlerts.map((item: any) => (
                  <div key={item.id} className="rounded-2xl bg-amber-50 p-3">
                    <p className="font-medium">{item.ingredient.name}</p>
                    <p>{item.message}</p>
                    <p className="text-xs text-slate-500">Ratio: {item.ratio}</p>
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
