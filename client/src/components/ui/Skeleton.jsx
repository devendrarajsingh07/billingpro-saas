import React from 'react'

export default function Skeleton({ className = 'h-4 w-full', count = 1 }) {
  const items = Array.from({ length: count })
  
  return (
    <div className="flex flex-col gap-2 w-full">
      {items.map((_, i) => (
        <div key={i} className={`skeleton ${className}`} />
      ))}
    </div>
  )
}
