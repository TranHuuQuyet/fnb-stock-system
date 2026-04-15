import { apiClient, unwrapData } from '@/lib/api-client';

export type TransferStore = {
  id: string;
  code: string;
  name: string;
  timezone: string;
};

export type TransferStatus = 'IN_TRANSIT' | 'RECEIVED';

export type TransferListItem = {
  id: string;
  batchCode: string;
  quantityRequested: number;
  quantityReceived: number | null;
  discrepancyQty: number | null;
  status: TransferStatus;
  requestedAt: string;
  confirmedAt: string | null;
  confirmationNote: string | null;
  canConfirm: boolean;
  ingredient?: { name?: string | null; unit?: string | null } | null;
  sourceStore?: { name?: string | null } | null;
  destinationStore?: { name?: string | null } | null;
  createdByUser?: { fullName?: string | null } | null;
  confirmedByUser?: { fullName?: string | null } | null;
};

export const listTransferStores = () =>
  unwrapData<TransferStore[]>(apiClient('/transfers/stores'));

export const listTransfers = (query = '') =>
  apiClient<TransferListItem[]>(`/transfers${query}`);

export const confirmTransfer = (id: string, payload: unknown) =>
  unwrapData<TransferListItem>(
    apiClient(`/transfers/${id}/confirm`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    })
  );
