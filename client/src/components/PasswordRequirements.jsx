import { Check, X } from 'lucide-react'

const RULES = [
  { label: '8+ characters', test: (v) => v.length >= 8 },
  { label: '1 uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: '1 lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: '1 number', test: (v) => /[0-9]/.test(v) },
  { label: '1 special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
]

/**
 * Live-updating password requirements checklist. Pass the current form
 * value in; each rule ticks green as soon as it's satisfied.
 */
export function passwordMeetsRequirements(value = '') {
  return RULES.every((rule) => rule.test(value))
}

export default function PasswordRequirements({ password = '' }) {
  return (
    <ul className="pw-requirements">
      {RULES.map((rule) => {
        const met = rule.test(password)
        return (
          <li key={rule.label} className={met ? 'met' : ''}>
            {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            <span>{rule.label}</span>
          </li>
        )
      })}
    </ul>
  )
}
