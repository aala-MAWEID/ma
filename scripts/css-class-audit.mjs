import fs from 'fs'
import path from 'path'

const root = 'src'
const tsx = [], css = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(tsx|ts)$/.test(e.name)) tsx.push(p)
    else if (/\.css$/.test(e.name)) css.push(p)
  }
}
walk(root)

const defined = new Set()
for (const f of css)
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/\.(-?[A-Za-z_][A-Za-z0-9_-]*)/g))
    defined.add(m[1])

const missing = new Map()
for (const f of tsx) {
  const s = fs.readFileSync(f, 'utf8')
  for (const m of s.matchAll(/className\s*=\s*(?:"([^"]*)"|\{([\s\S]*?)\})/g)) {
    const chunks =
      m[1] !== undefined
        ? [m[1]]
        : [...(m[2] || '').matchAll(/['"`]([^'"`]*)['"`]/g)].map((x) => x[1])
    for (const chunk of chunks)
      for (const tok of chunk.split(/\s+/)) {
        if (!tok || tok.includes('$') || tok.includes('{')) continue
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(tok)) continue
        if (defined.has(tok)) continue
        if (!missing.has(tok)) missing.set(tok, new Set())
        missing.get(tok).add(f)
      }
  }
}

if (missing.size) {
  console.log(`ℹ️ ${missing.size} residual/dynamic class name(s) in JSX not statically in stylesheets:`)
  for (const [k, files] of [...missing].sort())
    console.log(`   .${k}  <- ${[...files].join(', ')}`)
} else {
  console.log('\u2705 CSS class audit passed: every JSX class name is defined.')
}
