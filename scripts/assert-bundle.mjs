import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const indexFile = 'dist/index.html'
if (existsSync(indexFile)) {
  const indexContent = readFileSync(indexFile, 'utf8')
  if (indexContent.includes('href="./') || indexContent.includes('src="./')) {
    console.error(`[assert-bundle] dist/index.html contains relative ./ paths (href="./ or src="./), which breaks on nested routes. Use %BASE_URL% instead.`)
    process.exit(1)
  }
}

const backend = (process.env.VITE_DATA_BACKEND ?? 'supabase').trim()
if (backend !== 'supabase') process.exit(0)

const url = (process.env.VITE_SUPABASE_URL ?? '').trim()
if (!url) process.exit(0)
let host
try {
  let validUrl = url
  if (!validUrl.startsWith('http')) validUrl = 'https://' + validUrl
  host = new URL(validUrl).host
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
