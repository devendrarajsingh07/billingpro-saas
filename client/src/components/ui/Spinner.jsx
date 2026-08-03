import React from 'react'

export default function Spinner({ className = 'h-5 w-5', text = '' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className={`spinner ${className}`} />
      {text && <span className="text-xs font-semibold text-slate-400">{text}</span>}
    </div>
  )
}
