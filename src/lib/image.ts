import { AppError } from '@/data/errors'

const MAX_INPUT_BYTES = 12 * 1024 * 1024

/** Center-crops to a square and re-encodes as JPEG. Fixes iPhone HEIC + huge files. */
export async function toSquareJpeg(file: File, size = 512, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new AppError('image_unsupported', file.type || 'no-mime')
  if (file.size > MAX_INPUT_BYTES) throw new AppError('image_too_large', String(file.size))

  const src = await decode(file)
  const w = 'width' in src ? src.width : 0
  const h = 'height' in src ? src.height : 0
  if (!w || !h) throw new AppError('image_unsupported', 'zero-size')

  const side = Math.min(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new AppError('image_unsupported', 'no-2d-context')
  ctx.drawImage(src as CanvasImageSource, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size)
  if ('close' in src) (src as ImageBitmap).close()

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
  if (!blob) throw new AppError('image_unsupported', 'encode-failed')
  return blob
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file) } catch { /* Safari < 16.4 / HEIC: fall through */ }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    if (typeof img.decode === 'function') await img.decode()
    else await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new AppError('image_unsupported', 'img-decode')) })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}
