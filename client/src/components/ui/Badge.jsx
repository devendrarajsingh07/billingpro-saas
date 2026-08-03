import React from 'react'

export default function Badge({
  children,
  variant = 'slate',
  status = '',
  className = '',
  icon: Icon = null,
}) {
  // If status is passed, map to design system status badges
  let badgeClass = `badge-${variant}`
  if (status) {
    badgeClass = `status-badge-${status.toLowerCase()}`
  }

  return (
    <span className={`badge ${badgeClass} ${className}`}>
      {Icon && <Icon />}
      {children || status}
    </span>
  )
}
