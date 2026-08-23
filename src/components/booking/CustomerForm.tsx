import { useState } from 'react'
import { Field, Input, Textarea } from '@/components/ui'
import { useLocale } from '@/contexts/LocaleContext'
import { normalizePhone, phoneProblem, type CustomerDraft, type CustomerErrors } from '@/lib/validation'

export function CustomerForm({
  draft,
  errors,
  onChange,
  requireEmail,
  showErrors,
}: {
  draft: CustomerDraft
  errors: CustomerErrors
  onChange: (next: CustomerDraft) => void
  requireEmail: boolean
  showErrors: boolean
}) {
  const { t } = useLocale()
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const mark = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }))
  const show = (field: string) => showErrors || touched[field] === true

  const normalized = normalizePhone(draft.phone)
  const problem = phoneProblem(draft.phone)

  const set = (patch: Partial<CustomerDraft>) => onChange({ ...draft, ...patch })

  return (
    <div className="form-grid">
      <Field
        label={t('field.name')}
        required
        htmlFor="fullName"
        error={show('fullName') && errors.fullName ? t(errors.fullName) : undefined}
      >
        <Input
          id="fullName"
          name="fullName"
          value={draft.fullName}
          onChange={(e) => set({ fullName: e.target.value })}
          onBlur={() => mark('fullName')}
          autoComplete="name"
          invalid={show('fullName') && Boolean(errors.fullName)}
          aria-invalid={show('fullName') && Boolean(errors.fullName)}
        />
      </Field>

      <Field
        label={t('form.phone')}
        required
        htmlFor="phone"
        error={show('phone') && errors.phone ? t(errors.phone) : undefined}
        hint={
          normalized
            ? t('form.phoneOk') + ' ' + normalized
            : problem === 'tooLong'
              ? t('form.phoneTooLong')
              : problem === 'tooShort'
                ? t('form.phoneTooShort')
                : t('form.phoneHint')
        }
      >
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          maxLength={20}
          value={draft.phone}
          invalid={show('phone') && Boolean(errors.phone)}
          aria-invalid={show('phone') && Boolean(errors.phone)}
          onBlur={() => mark('phone')}
          onChange={(e) => set({ phone: e.target.value })}
        />
      </Field>

      <Field
        label={t('form.field.email')}
        required={requireEmail}
        hint={requireEmail ? undefined : ` · (${t('field.optional')})`}
        htmlFor="email"
        error={show('email') && errors.email ? t(errors.email) : undefined}
      >
        <Input
          id="email"
          name="email"
          value={draft.email ?? ''}
          onChange={(e) => set({ email: e.target.value })}
          onBlur={() => mark('email')}
          type="email"
          dir="ltr"
          autoComplete="email"
          invalid={show('email') && Boolean(errors.email)}
          aria-invalid={show('email') && Boolean(errors.email)}
        />
      </Field>

      <Field
        label={t('form.field.notes')}
        hint={` · (${t('field.optional')})`}
        htmlFor="notes"
        error={show('notes') && errors.notes ? t(errors.notes) : undefined}
      >
        <Textarea
          id="notes"
          name="notes"
          value={draft.notes ?? ''}
          onChange={(e) => set({ notes: e.target.value })}
          onBlur={() => mark('notes')}
          maxLength={500}
        />
      </Field>
    </div>
  )
}
