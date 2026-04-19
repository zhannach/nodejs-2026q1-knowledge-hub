export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  [key: string]: string | undefined;
}

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
};

export function applyPaginationAndSorting<T>(
  data: T[],
  query: PaginationQuery,
): PaginatedResponse<T> | T[] {
  const result = [...data];

  if (query.sortBy) {
    const order = query.order === 'desc' ? -1 : 1;
    const sortBy = query.sortBy as keyof T;
    result.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (aVal < bVal) return -1 * order;
      if (aVal > bVal) return 1 * order;
      return 0;
    });
  }

  if (query.page !== undefined || query.limit !== undefined) {
    const page = parseInt(query.page || '1', 10) || 1;
    const limit = parseInt(query.limit || '10', 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    return {
      data: result.slice(startIndex, endIndex),
      total: result.length,
      page,
      limit,
    };
  }

  return result;
}
