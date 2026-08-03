import React from 'react'

export default function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'md',
  disabled = false,
  isLoading = false,
  className = '',
  icon: Icon = null,
}) {
  const variantClass = `btn-${variant}`
  const sizeClass = size !== 'md' ? `btn-${size}` : ''
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`btn ${variantClass} ${sizeClass} ${className}`}
    >
      {isLoading ? (
        <div className="spinner h-4.5 w-4.5 border-1.5" />
      ) : Icon ? (
        <Icon className="h-4.5 w-4.5" />
      ) : null}
      {children}
    </button>
  )
}
