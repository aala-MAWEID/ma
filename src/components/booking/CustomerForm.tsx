import { useId } from 'react'
import { Field, Input, Textarea } from '@/components/ui'
import { useLocale } from '@/context/LocaleContext'
import type { CustomerDraft, CustomerErrors } from '@/lib/validation'

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
  const ids = { name: useId(), phone: useId(), email: useId(), notes: useId() }
  const set = (patch: Partial<CustomerDraft>) => onChange({ ...draft, ...patch })

  return (
    <div className="form-grid">
      <Field
        label={t('field.name')}
        required
        htmlFor={ids.name}
        error={showErrors && errors.fullName ? t(errors.fullName) : undefined}
      >
        <Input
          id={ids.name}
          value={draft.fullName}
          onChange={(e) => set({ fullName: e.target.value })}
          autoComplete="name"
          invalid={showErrors && Boolean(errors.fullName)}
        />
      </Field>

      <Field
        label={t('field.phone')}
        required
        htmlFor={ids.phone}
        error={showErrors && errors.phone ? t(errors.phone) : undefined}
      >
        <Input
          id={ids.phone}
          value={draft.phone}
          onChange={(e) => set({ phone: e.target.value })}
          type="tel"
          inputMode="tel"
          dir="ltr"
          placeholder="06 12 80 69 32"
          autoComplete="tel"
          invalid={showErrors && Boolean(errors.phone)}
        />
      </Field>

      <Field
        label={t('field.email')}
        required={requireEmail}
        hint={requireEmail ? undefined : ` · ${t('field.optional')}`}
        htmlFor={ids.email}
        error={showErrors && errors.email ? t(errors.email) : undefined}
      >
        <Input
          id={ids.email}
          value={draft.email ?? ''}
          onChange={(e) => set({ email: e.target.value })}
          type="email"
          dir="ltr"
          autoComplete="email"
          invalid={showErrors && Boolean(errors.email)}
        />
      </Field>

      <Field
        label={t('field.notes')}
        hint={` · ${t('field.optional')}`}
        htmlFor={ids.notes}
        error={showErrors && errors.notes ? t(errors.notes) : undefined}
      >
        <Textarea
          id={ids.notes}
          value={draft.notes ?? ''}
          onChange={(e) => set({ notes: e.target.value })}
          maxLength={500}
        />
      </Field>
    </div>
  )
}
