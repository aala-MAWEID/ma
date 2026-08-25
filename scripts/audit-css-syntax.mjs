#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const stylesDir = path.join(root, 'src', 'styles')

const APPROVED_MEDIA_CONDITIONS = new Set([
  '(max-width: 860px)',
  '(min-width: 861px)',
  '(min-width: 900px)',
  '(max-width: 640px)',
  '(max-width: 720px)',
  '(prefers-reduced-motion: reduce)',
  '(display-mode: standalone)',
])

let errors = 0

if (!fs.existsSync(stylesDir)) {
  console.error(`❌ Styles directory not found: ${stylesDir}`)
  process.exit(1)
}

const files = fs.readdirSync(stylesDir).filter((f) => f.endsWith('.css'))

for (const file of files) {
  const filePath = path.join(stylesDir, file)
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')

  // Check 1: Stray flag lines like -e or -n
  lines.forEach((line, index) => {
    if (/^\s*-[a-z]\s*$/.test(line)) {
      console.error(`❌ ${file}:${index + 1}: Stray command flag line "${line.trim()}"`)
      errors++
    }
  })

  // Check 2: Balanced braces
  let openBraces = 0
  let closeBraces = 0
  for (let i = 0; i < content.length; i++) {
    if (content[i] === '{') openBraces++
    if (content[i] === '}') closeBraces++
  }
  if (openBraces !== closeBraces) {
    console.error(`❌ ${file}: Unbalanced braces ({ : ${openBraces}, } : ${closeBraces})`)
    errors++
  }

  // Check 3: Approved media query conditions
  const mediaMatches = content.matchAll(/@media\s+([^{]+)\{/g)
  for (const match of mediaMatches) {
    const rawCondition = match[1].trim()
    if (!APPROVED_MEDIA_CONDITIONS.has(rawCondition)) {
      console.error(`❌ ${file}: Disallowed @media condition "${rawCondition}". Must be one of approved breakpoints.`)
      errors++
    }
  }
}

if (errors > 0) {
  console.error(`\nFound ${errors} CSS syntax/audit error(s).`)
  process.exit(1)
}

console.log('✅ CSS syntax audit passed! All stylesheets are clean and balanced.')
