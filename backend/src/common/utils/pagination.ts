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
