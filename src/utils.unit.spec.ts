import { describe, expect, it } from 'vitest';
import { applyPaginationAndSorting } from './utils';

describe('applyPaginationAndSorting', () => {
  it('returns original data when pagination is absent', () => {
    expect(
      applyPaginationAndSorting(
        [
          { id: '1', score: 2 },
          { id: '2', score: 1 },
        ],
        {},
      ),
    ).toEqual([
      { id: '1', score: 2 },
      { id: '2', score: 1 },
    ]);
  });

  it('sorts and paginates results', () => {
    expect(
      applyPaginationAndSorting(
        [
          { id: '1', score: 2 },
          { id: '2', score: 1 },
          { id: '3', score: 3 },
        ],
        { sortBy: 'score', order: 'desc', page: '1', limit: '2' },
      ),
    ).toEqual({
      data: [
        { id: '3', score: 3 },
        { id: '1', score: 2 },
      ],
      total: 3,
      page: 1,
      limit: 2,
    });
  });
});
