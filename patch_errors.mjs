import fs from 'node:fs'

let content = fs.readFileSync('src/data/errors.ts', 'utf8')
content = content.replace(
  /export function fromPostgrest\(e: unknown\): AppError \{[\s\S]*?return new AppError\('unknown', raw\)\n\}/,
  `export function fromPostgrest(e: unknown): AppError {
  const err = e as { code?: string; message?: string, details?: string, hint?: string } | null
  if (!err) return new AppError('unknown')
  
  const msg = err.details || err.hint ? \`\${err.message} (\${err.details || err.hint})\` : err.message

  if (err.code === '23P01') return new AppError('slot_taken')
  if (err.code === '42501') return new AppError('forbidden')
  if (err.code === 'PGRST301' || err.code === '401') return new AppError('forbidden')
  
  if (err.code === 'PGRST202') return new AppError('unsupported', \`rpc_missing: \${msg}\`)
  if (err.code === 'PGRST203') return new AppError('unsupported', \`rpc_ambiguous: \${msg}\`)
  if (err.code === 'PGRST204' || err.code === 'PGRST100') return new AppError('unsupported', \`rpc_bad_args: \${msg}\`)
  if (err.code === '23502' || err.code === '23514' || err.code === '22P02' || err.code === '42883')
    return new AppError('unknown', \`\${err.code}: \${msg}\`)

  const raw = (err.message ?? '').trim()
  const first = raw.split(/[\\s:]/)[0] ?? ''

  if (KNOWN.has(first)) return new AppError(first as ErrorCode, raw)
  if (KNOWN.has(raw)) return new AppError(raw as ErrorCode, raw)

  if (/fetch|network|Failed to fetch/i.test(raw)) return new AppError('network', raw)

  return new AppError('unknown', raw)
}`
)
fs.writeFileSync('src/data/errors.ts', content)
