import { apiClient, unwrapData } from '@/lib/api-client';

export type AdminReportPayload = {
  store: {
    id: string;
    code: string;
    name: string;
    timezone: string;
  };
  filters: {
    startDate: string;
    endDate: string;
    payrollYear: number;
    payrollMonth: number;
  };
  summary: {
    inventoryIngredientCount: number;
    inventoryTotalQty: number;
    wastageTotalQty: number;
    batchHistoryCount: number;
    topUsageTotalQty: number;
    payrollNetTotal: number;
  };
  inventorySnapshot: {
    generatedAt: string;
    items: Array<{
      ingredientId: string;
      ingredientCode: string;
      ingredientName: string;
      unit: string | null;
      totalRemainingQty: number;
      batchCount: number;
    }>;
  };
  wastage: {
    items: Array<{
      ingredientId: string;
      ingredientCode: string;
      ingredientName: string;
      unit: string | null;
      totalQty: number;
      adjustmentCount: number;
    }>;
    recentAdjustments: Array<{
      id: string;
      batchCode: string;
      ingredientName: string;
      quantity: number;
      reason: string;
      createdAt: string;
      createdBy: string | null;
    }>;
  };
  batchHistory: {
    items: Array<{
      id: string;
      batchCode: string;
      ingredientName: string;
      unit: string | null;
      receivedAt: string;
      expiredAt: string | null;
      initialQty: number;
      remainingQty: number;
      status: string;
      printedLabelCount: number;
      createdAt: string;
    }>;
  };
  topIngredients: {
    items: Array<{
      ingredientId: string;
      ingredientCode: string;
      ingredientName: string;
      unit: string | null;
      totalUsedQty: number;
      scanCount: number;
    }>;
  };
  workScheduleSummary: {
    title: string | null;
    status: string | null;
    year: number;
    month: number;
    employees: Array<{
      userId: string;
      displayName: string;
      role: string;
      trialHours: number;
      officialHours: number;
      trialHourlyRate: number;
      officialHourlyRate: number;
      allowanceAmount: number;
      lateMinutes: number;
      earlyLeaveMinutes: number;
      grossSalary: number;
      lateDeduction: number;
      earlyLeaveDeduction: number;
      totalDeductions: number;
      netSalary: number;
    }>;
  };
};

export const getAdminReports = (query = '') =>
  unwrapData<AdminReportPayload>(apiClient(`/admin/reports${query}`));
