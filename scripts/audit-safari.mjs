#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

let errors = 0

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

// 1 & 2 & 3: CSS checks
const cssFiles = walk('src/styles').filter((f) => extname(f) === '.css')
for (const file of cssFiles) {
  const content = readFileSync(file, 'utf8')
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 1) backdrop-filter check (must be preceded by -webkit-backdrop-filter)
    if (/(?<!-webkit-)backdrop-filter:/.test(line)) {
      const prev2 = lines.slice(Math.max(0, i - 2), i).join('\n')
      if (!/-webkit-backdrop-filter:/.test(prev2)) {
        console.error(`❌ [safari-audit] ${file}:${i + 1} backdrop-filter missing -webkit- prefix`)
        errors++
      }
    }

    // 2) dvh fallback check
    if (/\b\d+dvh\b/.test(line)) {
      const prevLine = i > 0 ? lines[i - 1] : ''
      if (!/\b\d+vh\b/.test(prevLine) && !/\b\d+vh\b/.test(line)) {
        console.error(`❌ [safari-audit] ${file}:${i + 1} dvh declaration missing vh fallback on previous line`)
        errors++
      }
    }

    // 3) native nesting check
    if (/^\s*[^@{}]*&[^{]*\{/.test(line)) {
      console.error(`❌ [safari-audit] ${file}:${i + 1} contains native CSS nesting`)
      errors++
    }
  }
}

// 4) localStorage check
const srcFiles = walk('src').filter((f) => ['.ts', '.tsx', '.js', '.jsx'].includes(extname(f)))
for (const file of srcFiles) {
  if (file.replace(/\\/g, '/').endsWith('src/lib/safeStorage.ts')) continue
  const content = readFileSync(file, 'utf8')
  if (/\blocalStorage\./.test(content)) {
    console.error(`❌ [safari-audit] ${file} contains direct localStorage access (use safeStorage)`)
    errors++
  }
}

// 5) vite.config.ts cssTarget check
const viteConfig = readFileSync('vite.config.ts', 'utf8')
if (!/cssTarget:/.test(viteConfig)) {
  console.error(`❌ [safari-audit] vite.config.ts lacks cssTarget configuration`)
  errors++
}

if (errors > 0) {
  console.error(`\nFound ${errors} Safari / mobile compatibility issue(s).`)
  process.exit(1)
}

console.log('✅ Safari audit passed! All mobile compatibility rules verified.')
