import React, { forwardRef } from 'react'

const Input = forwardRef(({
  label,
  name,
  type = 'text',
  placeholder = '',
  error = '',
  hint = '',
  required = false,
  className = '',
  icon: Icon = null,
  ...props
}, ref) => {
  return (
    <div className={`form-group ${className}`}>
      {label && (
        <label className="form-label" htmlFor={name}>
          {label}
          {required && <span className="required">*</span>}
        </label>
      )}
      
      <div className={Icon ? 'input-with-icon' : ''}>
        {Icon && <Icon className="input-icon" />}
        <input
          id={name}
          name={name}
          type={type}
          ref={ref}
          placeholder={placeholder}
          className={`input-field ${error ? 'error' : ''}`}
          {...props}
        />
      </div>
      
      {error && <p className="form-error">{error}</p>}
      {!error && hint && <p className="form-hint">{hint}</p>}
    </div>
  )
})

Input.displayName = 'Input'
export default Input
