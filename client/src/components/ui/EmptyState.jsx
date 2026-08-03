import React from 'react'
import { Inbox } from 'lucide-react'
import Button from './Button'

export default function EmptyState({
  title = 'No records found',
  description = 'There is no data to display here at the moment.',
  icon: Icon = Inbox,
  actionText = '',
  onAction = null,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionText && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  )
}
