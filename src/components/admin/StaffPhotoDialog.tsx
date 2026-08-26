import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, Spinner } from '@/components/ui'
import { useLocale } from '@/contexts/LocaleContext'
import { errorCodeOf, errorKey } from '@/data/errors'
import { toSquareJpeg } from '@/lib/image'

/**
 * Staff photo dialog.
 *
 * Design constraints that drove this implementation:
 *  - iOS Safari ignores `.click()` on a `display:none` input, so both inputs
 *    stay in the layout as 1x1 transparent boxes.
 *  - Opening the native sheet blurs the page. While it is open we set
 *    `document.body.dataset.mwLock = '1'` so no parent overlay can close and
 *    unmount us mid-pick.
 *  - The preview is produced locally with `toSquareJpeg` so the user sees the
 *    exact square crop that will be stored, but the ORIGINAL file is uploaded:
 *    the data adapter already crops and re-encodes, and cropping twice would
 *    lose quality.
 *  - Mobile renders as a bottom sheet, desktop as a centred card. Same DOM.
 */

const MAX_BYTES = 12 * 1024 * 1024
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/*'

export type StaffPhotoDialogProps = {
  open: boolean
  onClose: () => void
  /** Staff display name, used for the fallback initial. */
  name: string
  /** Staff colour, used as the fallback background. */
  color: string
  /** Currently stored photo, if any. */
  avatarUrl?: string | null
  /** Uploads the picked file. Must resolve after the store is updated. */
  onUpload: (file: File) => Promise<void>
  /** Removes the stored photo. */
  onRemove: () => Promise<void>
}

export function StaffPhotoDialog({
  open,
  onClose,
  name,
  color,
  avatarUrl,
  onUpload,
  onRemove,
}: StaffPhotoDialogProps) {
  const { t } = useLocale()
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const previewUrlRef = useRef<string | null>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPreview(null)
    setFile(null)
  }, [])

  /** Marks the page as busy so no parent overlay closes while a sheet is open. */
  const lock = useCallback((on: boolean) => {
    try {
      if (on) document.body.dataset.mwLock = '1'
      else delete document.body.dataset.mwLock
    } catch {
      /* dataset is unavailable in exotic embedders; ignore */
    }
  }, [])

  const accept = useCallback(
    async (picked: File | null | undefined) => {
      if (!picked) return
      setError(null)
      if (!picked.type.startsWith('image/')) {
        setError(t('admin.photoBadType'))
        return
      }
      if (picked.size > MAX_BYTES) {
        setError(t('admin.photoTooBig'))
        return
      }
      try {
        const squared = await toSquareJpeg(picked, 512, 0.85)
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
        previewUrlRef.current = URL.createObjectURL(squared)
        setPreview(previewUrlRef.current)
        setFile(picked)
      } catch (err) {
        console.error('[maweid] photo preview failed', err)
        setError(t(errorKey(errorCodeOf(err))))
      }
    },
    [t],
  )

  const openPicker = useCallback(
    (which: 'gallery' | 'camera') => {
      lock(true)
      const el = which === 'camera' ? cameraRef.current : galleryRef.current
      el?.click()
      // The sheet is modal; releasing the lock on the next focus is enough.
      const release = () => {
        window.setTimeout(() => lock(false), 400)
        window.removeEventListener('focus', release)
      }
      window.addEventListener('focus', release)
    },
    [lock],
  )

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    const onPaste = (e: ClipboardEvent) => {
      const pasted = e.clipboardData?.files?.[0]
      if (pasted) void accept(pasted)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('paste', onPaste)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('paste', onPaste)
    }
  }, [open, busy, onClose, accept])

  useEffect(() => {
    if (open) return
    clearPreview()
    setError(null)
    lock(false)
  }, [open, clearPreview, lock])

  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      lock(false)
    },
    [lock],
  )

  const save = async () => {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      await onUpload(file)
      clearPreview()
      onClose()
    } catch (err) {
      console.error('[maweid] photo upload failed', err)
      setError(t(errorKey(errorCodeOf(err))))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    setError(null)
    try {
      await onRemove()
      clearPreview()
      onClose()
    } catch (err) {
      console.error('[maweid] photo remove failed', err)
      setError(t(errorKey(errorCodeOf(err))))
    } finally {
      setBusy(false)
    }
  }

  if (!open) return null

  const shown = preview ?? avatarUrl ?? null
  const initial = (name || '?').trim().charAt(0) || '?'

  return createPortal(
    <div
      className="photo-dlg"
      role="dialog"
      aria-modal="true"
      aria-label={t('admin.staffPhoto')}
      onClick={(e) => {
        if (e.target !== e.currentTarget || busy) return
        onClose()
      }}
    >
      <div className="photo-dlg__card" onClick={(e) => e.stopPropagation()}>
        <header className="photo-dlg__head">
          <h2 className="photo-dlg__title">{t('admin.staffPhoto')}</h2>
          <button
            type="button"
            className="photo-dlg__close"
            onClick={onClose}
            disabled={busy}
            aria-label={t('action.close')}
          >
            ✕
          </button>
        </header>

        <div
          className={dragOver ? 'photo-dlg__drop is-over' : 'photo-dlg__drop'}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            void accept(e.dataTransfer.files?.[0])
          }}
        >
          {shown ? (
            <img src={shown} alt="" className="photo-dlg__avatar" />
          ) : (
            <div
              className="photo-dlg__avatar photo-dlg__initial"
              style={{ backgroundColor: color }}
            >
              {initial}
            </div>
          )}
          <p className="photo-dlg__hint">
            {preview ? t('admin.photoReady') : t('admin.photoHint')}
          </p>
          <p className="photo-dlg__hint photo-dlg__hint--desktop">
            {t('admin.photoDropHint')}
          </p>
        </div>

        {error && <div className="alert alert--err photo-dlg__err">{error}</div>}

        <div className="photo-dlg__actions">
          <Button variant="primary" block disabled={busy} onClick={() => openPicker('camera')}>
            {t('admin.takePhoto')}
          </Button>
          <Button variant="outline" block disabled={busy} onClick={() => openPicker('gallery')}>
            {t('admin.chooseFromGallery')}
          </Button>
        </div>

        <footer className="photo-dlg__foot">
          {preview ? (
            <>
              <Button variant="quiet" size="sm" disabled={busy} onClick={clearPreview}>
                {t('admin.photoDiscard')}
              </Button>
              <Button variant="primary" size="sm" loading={busy} onClick={() => void save()}>
                {t('admin.savePhoto')}
              </Button>
            </>
          ) : avatarUrl ? (
            <Button variant="danger" size="sm" loading={busy} onClick={() => void remove()}>
              {t('admin.removePhoto')}
            </Button>
          ) : (
            <span className="photo-dlg__hint">{t('admin.photoNone')}</span>
          )}
        </footer>

        {busy && (
          <div className="photo-dlg__busy" aria-live="polite">
            <Spinner size={20} />
            <span>{t('admin.photoUploading')}</span>
          </div>
        )}

        {/* Both inputs stay in the layout: iOS ignores clicks on display:none. */}
        <input
          ref={galleryRef}
          className="photo-dlg__vh"
          type="file"
          accept={ACCEPT}
          tabIndex={-1}
          onChange={(e) => {
            const picked = e.target.files?.[0]
            e.target.value = ''
            void accept(picked)
          }}
        />
        <input
          ref={cameraRef}
          className="photo-dlg__vh"
          type="file"
          accept="image/*"
          capture="environment"
          tabIndex={-1}
          onChange={(e) => {
            const picked = e.target.files?.[0]
            e.target.value = ''
            void accept(picked)
          }}
        />
      </div>
    </div>,
    document.body,
  )
}
