import { PaginationQueryDto } from '../dto/pagination-query.dto';

export const buildPagination = (query: PaginationQueryDto) => {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
};

export const resolveSortField = <T extends string>(
  sortBy: string | undefined,
  allowedFields: readonly T[],
  fallback: T
): T => {
  const normalizedSortBy = sortBy?.trim();
  if (!normalizedSortBy) {
    return fallback;
  }

  return (allowedFields as readonly string[]).includes(normalizedSortBy)
    ? (normalizedSortBy as T)
    : fallback;
};

export const buildPaginationMeta = (
  page: number,
  pageSize: number,
  total: number
) => ({
  page,
  pageSize,
  total,
  totalPages: Math.ceil(total / pageSize)
});
