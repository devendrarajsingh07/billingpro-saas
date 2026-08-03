import { useState, useCallback } from 'react';

/**
 * Pagination state hook
 * @param {object} options
 * @param {number} options.initialPage
 * @param {number} options.initialLimit
 * @param {number} options.total
 */
export default function usePagination({ initialPage = 1, initialLimit = 10 } = {}) {
  const [page, setPage] = useState(initialPage);
  const [limit, setLimit] = useState(initialLimit);
  const [total, setTotal] = useState(0);

  const totalPages = Math.ceil(total / limit);
  const hasNext = page < totalPages;
  const hasPrev = page > 1;

  const goToPage = useCallback((p) => {
    setPage(Math.max(1, Math.min(p, totalPages || 1)));
  }, [totalPages]);

  const goNext = useCallback(() => {
    if (hasNext) setPage((p) => p + 1);
  }, [hasNext]);

  const goPrev = useCallback(() => {
    if (hasPrev) setPage((p) => p - 1);
  }, [hasPrev]);

  const reset = useCallback(() => {
    setPage(1);
  }, []);

  const changeLimit = useCallback((newLimit) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  // Compute page range for pagination controls (max 5 visible pages)
  const getPageRange = useCallback(() => {
    const range = [];
    const delta = 2;
    const start = Math.max(1, page - delta);
    const end = Math.min(totalPages, page + delta);
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  }, [page, totalPages]);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNext,
    hasPrev,
    setTotal,
    setPage,
    goToPage,
    goNext,
    goPrev,
    reset,
    changeLimit,
    getPageRange,
    offset: (page - 1) * limit,
  };
}
