#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const settingsPath = path.join(root, 'src', 'pages', 'admin', 'Settings.tsx')

if (!fs.existsSync(settingsPath)) {
  console.error('❌ src/pages/admin/Settings.tsx not found')
  process.exit(1)
}

const content = fs.readFileSync(settingsPath, 'utf8')

// Regex checking for min={<number literal>} or max={<number literal>}
// or min="<number literal>" / max="<number literal>"
// e.g., min={5}, max={60}, min={0}, min="5", max="60"
// Also checks for fallback constants like `min={... ?? 5}`
const hardcodedMin = /min=\{?\s*\d+\s*\}?/g
const hardcodedMax = /max=\{?\s*\d+\s*\}?/g
const fallbackMinMax = /(min|max)=\{[^}]*\?\?\s*\d+\s*\}/g

let errors = 0

const lines = content.split('\n')
lines.forEach((line, i) => {
  if (fallbackMinMax.test(line)) {
    console.error(`❌ Line ${i + 1}: Found hardcoded fallback bound in Settings.tsx: ${line.trim()}`)
    errors++
  } else if (hardcodedMin.test(line) || hardcodedMax.test(line)) {
    // Make sure it's not a dynamic expression
    if (/min=\{?\s*\d+\s*\}?/.test(line) || /max=\{?\s*\d+\s*\}?/.test(line)) {
      console.error(`❌ Line ${i + 1}: Found hardcoded numeric min/max literal in Settings.tsx: ${line.trim()}`)
      errors++
    }
  }
})

if (errors > 0) {
  console.error(`\nFound ${errors} hardcoded bound(s) in Settings.tsx. All bounds must come dynamically from get_settings_schema().`)
  process.exit(1)
}

console.log('✅ Settings schema bounds audit passed! No hardcoded bounds in Settings.tsx.')
