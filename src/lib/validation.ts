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
 * يحوّل أي مدخل معقول إلى E.164، ويرجع null إن كان مستحيلاً.
 * يقبل: 0667411987 · 06 67 41 19 87 · +212667411987 · 00212667411987 · 212667411987
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null

  const plus = trimmed.startsWith('+')
  let digits = trimmed.replace(/[^0-9]/g, '')
  if (!digits) return null

  // 00 الدولية → +
  if (digits.startsWith('00')) digits = digits.slice(2)

  // محلي مغربي: 10 أرقام تبدأ بـ 05/06/07
  if (!plus && /^0[567][0-9]{8}$/.test(digits)) {
    return '+212' + digits.slice(1)
  }
  // مكتوب بلا الصفر: 9 أرقام تبدأ بـ 5/6/7
  if (!plus && /^[567][0-9]{8}$/.test(digits)) {
    return '+212' + digits
  }
  // مغربي برمز الدولة
  if (/^212[567][0-9]{8}$/.test(digits)) {
    return '+' + digits
  }
  // أي رقم دولي مكتوب بـ + وطوله معقول (نفس قيد قاعدة البيانات: ^\+[1-9][0-9]{7,14}$)
  if (plus && /^[1-9][0-9]{7,14}$/.test(digits)) {
    return '+' + digits
  }
  return null
}

export type PhoneProblem = 'empty' | 'tooShort' | 'tooLong' | 'badPrefix' | null

/** يشرح لماذا رُفِض الرقم، لأن «رقم غير صحيح» وحده لا يكفي. */
export function phoneProblem(raw: string | null | undefined): PhoneProblem {
  const digits = (raw ?? '').replace(/[^0-9]/g, '')
  if (!digits) return 'empty'
  if (normalizePhone(raw)) return null
  if (digits.length < 9) return 'tooShort'
  if (digits.length > 15) return 'tooLong'
  if (/^0[0-9]{10,}$/.test(digits)) return 'tooLong'
  return 'badPrefix'
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
