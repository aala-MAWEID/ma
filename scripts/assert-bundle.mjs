import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const backend = (process.env.VITE_DATA_BACKEND ?? 'supabase').trim()
if (backend !== 'supabase') process.exit(0)

const url = (process.env.VITE_SUPABASE_URL ?? '').trim()
if (!url) process.exit(0)

let host
try {
  host = new URL(url).host
} catch {
  process.exit(0)
}

const dir = 'dist/assets'
if (!existsSync(dir)) {
  console.error(`[assert-bundle] Directory ${dir} does not exist`)
  process.exit(1)
}

const hit = readdirSync(dir)
  .filter((f) => f.endsWith('.js'))
  .some((f) => readFileSync(join(dir, f), 'utf8').includes(host))

if (!hit) {
  console.error(`[assert-bundle] "${host}" is absent from ${dir} — env did not reach the build`)
  process.exit(1)
}
console.log(`[assert-bundle] ok → ${host} is inlined`)
