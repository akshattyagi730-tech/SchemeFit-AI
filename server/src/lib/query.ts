import { z } from 'zod';

/**
 * Build a validated pagination + sorting schema.
 * `sortable` is an allowlist — anything else is rejected with 422.
 */
export function pageQuery<const T extends readonly string[]>(sortable: T, defaultSort: T[number]) {
  return z.object({
    page: z.coerce.number().int().min(1).max(10_000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    sort: z
      .enum(sortable as unknown as [string, ...string[]])
      .default(defaultSort as string),
    order: z.enum(['asc', 'desc']).default('desc'),
  });
}

export function toMongoSort(sort: string, order: 'asc' | 'desc'): Record<string, 1 | -1> {
  return { [sort]: order === 'asc' ? 1 : -1 };
}

export function paginationMeta(total: number, page: number, pageSize: number) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
