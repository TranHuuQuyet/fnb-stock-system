import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ScanPageContent from './scan-page-content';

const submitScanMock = vi.fn();
const getScanNetworkStatusMock = vi.fn();
const parseBatchQrValueMock = vi.fn();
const listBatchesMock = vi.fn();
const listTransferStoresMock = vi.fn();
let mockSessionUser = {
  role: 'STAFF',
  permissions: [] as string[],
  store: {
    id: 'store-1',
    name: 'Chi nhanh 1'
  }
};

vi.mock('@/components/layout/protected-page', () => ({
  ProtectedPage: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('@/components/scan/qr-scanner', () => ({
  QrScanner: ({ onDetected }: { onDetected: (value: string) => void }) => (
    <button type="button" onClick={() => onDetected('issued-label')}>
      Fake Scan
    </button>
  )
}));

vi.mock('@/hooks/use-network-status', () => ({
  useNetworkStatus: () => ({ isOnline: true })
}));

vi.mock('@/hooks/use-resolved-session', () => ({
  useResolvedSession: () => ({
    isSuccess: true,
    session: {
      user: mockSessionUser
    }
  })
}));

vi.mock('@/lib/auth', () => ({
  getDeviceId: () => 'device-1'
}));

vi.mock('@/lib/batch-qr', () => ({
  parseBatchQrValue: (...args: unknown[]) => parseBatchQrValueMock(...args)
}));

vi.mock('@/lib/localization', () => ({
  localizeResultCode: (value: string) => value
}));

vi.mock('@/services/batches', () => ({
  listBatches: (...args: unknown[]) => listBatchesMock(...args)
}));

vi.mock('@/services/scan', () => ({
  getScanNetworkStatus: (...args: unknown[]) => getScanNetworkStatusMock(...args),
  submitScan: (...args: unknown[]) => submitScanMock(...args)
}));

vi.mock('@/services/transfers', () => ({
  listTransferStores: (...args: unknown[]) => listTransferStoresMock(...args)
}));

describe('ScanPageContent', () => {
  beforeEach(() => {
    localStorage.clear();
    parseBatchQrValueMock.mockReset();
    submitScanMock.mockReset();
    getScanNetworkStatusMock.mockReset();
    listBatchesMock.mockReset();
    listTransferStoresMock.mockReset();

    mockSessionUser = {
      role: 'STAFF',
      permissions: [],
      store: {
        id: 'store-1',
        name: 'Chi nhanh 1'
      }
    };

    parseBatchQrValueMock.mockReturnValue({
      rawValue: 'FNBBATCH:BATCH-001|BATCH:batch-1|SEQ:1',
      batchCode: 'BATCH-001',
      batchId: 'batch-1',
      sequenceNumber: 1
    });

    submitScanMock.mockResolvedValue({
      resultStatus: 'SUCCESS',
      resultCode: 'SCAN_OK',
      message: 'Da tru kho thanh cong',
      batchCode: 'BATCH-001',
      remainingQty: 9,
      ingredientName: 'Sua tuoi',
      ingredientUnit: 'hop'
    });

    getScanNetworkStatusMock.mockResolvedValue({
      storeId: 'store-1',
      ipAddress: '127.0.0.1',
      normalizedIpAddress: '127.0.0.1',
      hasActiveWhitelist: true,
      isAllowed: true,
      isAllowedByWhitelist: true,
      matchedWhitelistTypes: ['IP'],
      bypassEnabled: false,
      bypassActive: false,
      bypassExpiresAt: null,
      bypassReason: null,
      canAccessBusinessOperations: true
    });
    listBatchesMock.mockResolvedValue({ data: [] });
    listTransferStoresMock.mockResolvedValue([
      { id: 'store-1', name: 'Chi nhanh 1' },
      { id: 'store-2', name: 'Chi nhanh 2' }
    ]);

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        randomUUID: () => 'event-1'
      }
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('invalidates stock-related queries after a successful quick scan', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        },
        mutations: {
          retry: false
        }
      }
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
      <QueryClientProvider client={queryClient}>
        <ScanPageContent />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fake Scan' }));

    await waitFor(() => {
      expect(submitScanMock).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Da tru kho thanh cong');
    });

    await waitFor(() => {
      const invalidatedKeys = invalidateSpy.mock.calls.map(([filters]) =>
        JSON.stringify(filters?.queryKey)
      );

      expect(invalidatedKeys).toContain(JSON.stringify(['ingredient-stock-board']));
      expect(invalidatedKeys).toContain(JSON.stringify(['admin-batches']));
      expect(invalidatedKeys).toContain(JSON.stringify(['dashboard-summary']));
      expect(invalidatedKeys).toContain(JSON.stringify(['scan-logs']));
    });
  });

  it('blocks admin store usage scans until a store is selected', async () => {
    mockSessionUser = {
      role: 'ADMIN',
      permissions: [],
      store: {
        id: '',
        name: ''
      }
    };

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        },
        mutations: {
          retry: false
        }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScanPageContent />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Fake Scan' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Vui lòng chọn chi nhánh sử dụng');
    });
    expect(submitScanMock).not.toHaveBeenCalled();
  });

  it('blocks transfer scans when source and destination stores match', async () => {
    mockSessionUser = {
      role: 'ADMIN',
      permissions: [],
      store: {
        id: 'store-1',
        name: 'Chi nhanh 1'
      }
    };

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        },
        mutations: {
          retry: false
        }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScanPageContent />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chuyển kho' }));
    await waitFor(() => {
      expect(screen.getAllByRole('option', { name: 'Chi nhanh 2' }).length).toBeGreaterThan(0);
    });
    const destinationSelect = await screen.findByRole('combobox', { name: 'Chi nhánh nhận' });
    (destinationSelect as HTMLSelectElement).value = 'store-1';
    fireEvent.change(destinationSelect, {
      target: { value: 'store-1' }
    });
    await waitFor(() => {
      expect(destinationSelect).toHaveValue('store-1');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fake Scan' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Chi nhánh gửi và chi nhánh nhận không được trùng nhau'
      );
    });
    expect(submitScanMock).not.toHaveBeenCalled();
  });

  it('submits transfer scans with quantity one from the selected source to destination', async () => {
    mockSessionUser = {
      role: 'ADMIN',
      permissions: [],
      store: {
        id: 'store-1',
        name: 'Chi nhanh 1'
      }
    };

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false
        },
        mutations: {
          retry: false
        }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ScanPageContent />
      </QueryClientProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Chuyển kho' }));
    await waitFor(() => {
      expect(screen.getAllByRole('option', { name: 'Chi nhanh 2' }).length).toBeGreaterThan(0);
    });
    const destinationSelect = await screen.findByRole('combobox', { name: 'Chi nhánh nhận' });
    (destinationSelect as HTMLSelectElement).value = 'store-2';
    fireEvent.change(destinationSelect, {
      target: { value: 'store-2' }
    });
    await waitFor(() => {
      expect(destinationSelect).toHaveValue('store-2');
    });
    fireEvent.click(screen.getByRole('button', { name: 'Fake Scan' }));

    await waitFor(() => {
      expect(submitScanMock).toHaveBeenCalledTimes(1);
    });

    expect(submitScanMock).toHaveBeenCalledWith(
      expect.objectContaining({
        operationType: 'TRANSFER',
        batchCode: 'BATCH-001',
        quantityUsed: 1,
        storeId: 'store-1',
        destinationStoreId: 'store-2'
      })
    );
  });
});
