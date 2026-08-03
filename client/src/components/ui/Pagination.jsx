import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems = 0,
  itemsPerPage = 10,
}) {
  if (totalPages <= 1) return null

  const startIdx = (currentPage - 1) * itemsPerPage + 1
  const endIdx = Math.min(currentPage * itemsPerPage, totalItems)

  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i)
  }

  return (
    <div className="pagination">
      <div className="pagination-info">
        Showing <span className="font-semibold text-slate-800 dark:text-slate-100">{startIdx}</span> to{' '}
        <span className="font-semibold text-slate-800 dark:text-slate-100">{endIdx}</span> of{' '}
        <span className="font-semibold text-slate-800 dark:text-slate-100">{totalItems}</span> entries
      </div>
      
      <div className="pagination-controls">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="page-btn"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        
        {pages.map((p) => (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            className={`page-btn ${currentPage === p ? 'active' : ''}`}
          >
            {p}
          </button>
        ))}
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="page-btn"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
