// Fails the build when the selected backend cannot possibly work.
// Rationale: Vite inlines import.meta.env at build time, so a missing
// variable produces a silently broken bundle instead of a runtime error.
const backend = (process.env.VITE_DATA_BACKEND ?? 'supabase').trim()
if (backend !== 'supabase') {
  console.log(`[assert-env] backend=${backend} — skipping Supabase checks`)
  process.exit(0)
}

const url = (process.env.VITE_SUPABASE_URL ?? '').trim()
const key = (process.env.VITE_SUPABASE_ANON_KEY ?? '').trim()
const errors = []

// If neither is defined and we are in local dev or standard build without explicitly provided env,
// check if env has values or if we are building.
if (!url) errors.push('VITE_SUPABASE_URL is empty')
else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url))
  errors.push(`VITE_SUPABASE_URL must be exactly https://<ref>.supabase.co (got "${url}")`)

if (!key) errors.push('VITE_SUPABASE_ANON_KEY is empty')
else if (key.startsWith('sb_secret_') || key.includes('service_role'))
  errors.push('VITE_SUPABASE_ANON_KEY is a secret key — use sb_publishable_…')
else if (!key.startsWith('sb_publishable_') && !key.startsWith('eyJ'))
  errors.push('VITE_SUPABASE_ANON_KEY is not a publishable or anon key')

if (errors.length) {
  console.error('\n[assert-env] build refused:\n  - ' + errors.join('\n  - '))
  console.error(
    '\nSet them in GitHub → Settings → Secrets and variables → Actions → Variables,\n' +
      'or in a local .env file (see .env.example), then rebuild.\n',
  )
  process.exit(1)
}
console.log(`[assert-env] ok → ${url} (${key.slice(0, 12)}…)`)
