export interface CustomerDraft {
  fullName: string
  phone: string
  email?: string
  notes?: string
}

export interface CustomerErrors {
  fullName?: string
  phone?: string
  email?: string
  notes?: string
}

/**
 * Accepts Moroccan numbers in multiple popular formats:
 *   - 06 12 80 69 32 / 07 12 34 56 78 / 05 22 33 44 55
 *   - +212 6 12 80 69 32
 *   - 00212 6 12 80 69 32
 *   - 212 6 12 80 69 32
 * Returns normalized E.164: e.g. +212612806932 or null if invalid.
 */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null
  const cleaned = raw.replace(/[\s\-().]/g, '')
  if (!cleaned) return null

  // 00212...
  if (cleaned.startsWith('00212')) {
    const rest = cleaned.slice(5)
    if (/^[567]\d{8}$/.test(rest)) return `+212${rest}`
  }

  // +212...
  if (cleaned.startsWith('+212')) {
    const rest = cleaned.slice(4)
    if (/^[567]\d{8}$/.test(rest)) return `+212${rest}`
  }

  // 212...
  if (cleaned.startsWith('212')) {
    const rest = cleaned.slice(3)
    if (/^[567]\d{8}$/.test(rest)) return `+212${rest}`
  }

  // Local starting with 0: 05, 06, 07
  if (/^0[567]\d{8}$/.test(cleaned)) {
    return `+212${cleaned.slice(1)}`
  }

  // Any international general fallback (+ followed by 8-15 digits)
  if (/^\+\d{8,15}$/.test(cleaned)) {
    return cleaned
  }

  return null
}

export function validateCustomer(
  draft: CustomerDraft,
  requireEmail: boolean = false,
): CustomerErrors {
  const errors: CustomerErrors = {}

  const name = draft.fullName.trim()
  if (name.length < 2) {
    errors.fullName = 'error.nameTooShort'
  } else if (name.length > 100) {
    errors.fullName = 'error.nameTooLong'
  }

  const phone = normalizePhone(draft.phone)
  if (!phone) {
    errors.phone = 'error.invalidPhone'
  }

  if (draft.email && draft.email.trim()) {
    const email = draft.email.trim()
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRe.test(email)) {
      errors.email = 'error.invalidEmail'
    }
  } else if (requireEmail) {
    errors.email = 'error.emailRequired'
  }

  if (draft.notes && draft.notes.length > 500) {
    errors.notes = 'error.notesTooLong'
  }

  return errors
}

export function isClean(errors: CustomerErrors): boolean {
  return !errors.fullName && !errors.phone && !errors.email && !errors.notes
}
