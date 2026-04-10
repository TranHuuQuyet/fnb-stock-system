export const BATCH_QR_PREFIX = 'FNBBATCH:';

type BuildIssuedLabelQrValueParams = {
  batchId: string;
  batchCode: string;
  sequenceNumber: number;
};

type ParsedBatchQrValue = {
  batchCode: string;
  batchId: string | null;
  sequenceNumber: number | null;
  rawValue: string;
};

export const buildIssuedLabelQrValue = ({
  batchId,
  batchCode,
  sequenceNumber
}: BuildIssuedLabelQrValueParams) =>
  `${BATCH_QR_PREFIX}${batchCode}|BATCH:${batchId}|SEQ:${sequenceNumber}`;

export const parseBatchQrValue = (value: string): ParsedBatchQrValue | null => {
  if (!value.startsWith(BATCH_QR_PREFIX)) {
    return null;
  }

  const content = value.slice(BATCH_QR_PREFIX.length).trim();
  if (!content) {
    return null;
  }

  const segments = content
    .split('|')
    .map((segment) => segment.trim())
    .filter(Boolean);
  const [batchCode, ...metadata] = segments;

  if (!batchCode) {
    return null;
  }

  let batchId: string | null = null;
  let sequenceNumber: number | null = null;

  for (const segment of metadata) {
    if (segment.startsWith('BATCH:')) {
      batchId = segment.slice('BATCH:'.length).trim() || null;
      continue;
    }

    if (segment.startsWith('SEQ:')) {
      const parsed = Number.parseInt(segment.slice('SEQ:'.length).trim(), 10);
      sequenceNumber = Number.isFinite(parsed) ? parsed : null;
    }
  }

  return {
    batchCode,
    batchId,
    sequenceNumber,
    rawValue: value
  };
};
