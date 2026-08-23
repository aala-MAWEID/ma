import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useLocale } from '@/contexts/LocaleContext'
import { useToast } from '@/contexts/ToastContext'
import { Spinner } from '@/components/ui'
import '@/styles/google-button.css'

type Props = { redirectTo?: string; label?: string; size?: 'sm' | 'md'; block?: boolean; compact?: boolean }

export function GoogleButton({ redirectTo, label, size = 'md', block, compact }: Props) {
  const { signInWithGoogle } = useAuth()
  const { t } = useLocale()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function go() {
    setBusy(true)
    try {
      await signInWithGoogle(redirectTo)
    } catch (e) {
      setBusy(false)
      toast.error(t('error.auth_failed'))
      console.error('[maweid] google sign-in failed', e)
    }
  }

  return (
    <button
      type="button"
      className={[
        'btn-google',
        size === 'sm' ? 'btn-google--sm' : '',
        block ? 'btn-google--block' : '',
        compact ? 'btn-google--compact' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={go}
      disabled={busy}
      aria-busy={busy}
      aria-label={label ?? t('auth.continueWithGoogle')}
      title={label ?? t('auth.continueWithGoogle')}
    >
      {busy ? (
        <Spinner size={18} />
      ) : (
        <svg
          className="btn-google__icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 256 262"
          preserveAspectRatio="xMidYMid"
          aria-hidden="true"
        >
          <path
            d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-27.269 42.356l-.248 1.649 39.622 30.688 2.745.274c25.214-23.278 39.73-57.581 39.73-96.725"
            fill="#4285F4"
          />
          <path
            d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.831 13.055-45.257 13.055-35.393 0-65.418-23.278-76.152-55.479l-1.567.133-40.646 31.436-.54 1.500C33.966 231.798 78.492 261.1 130.55 261.1"
            fill="#34A853"
          />
          <path
            d="M54.398 155.141c-2.83-8.123-4.481-16.827-4.481-25.82 0-8.994 1.651-17.697 4.336-25.82l-.075-1.734L12.91 69.872l-1.353.644C3.29 87.485 0 106.487 0 129.321s3.29 41.836 11.557 58.805l42.841-33.985"
            fill="#FBBC05"
          />
          <path
            d="M130.55 50.479c25.212 0 42.196 10.153 51.914 18.856l38.008-36.936C202.686 12.31 165.798 0 130.55 0 78.492 0 33.966 29.301 11.557 71.798l42.7 33.985c10.878-32.201 40.903-55.304 76.293-55.304"
            fill="#EB4335"
          />
        </svg>
      )}
      {!compact && <span>{label ?? t('auth.continueWithGoogle')}</span>}
    </button>
  )
}
