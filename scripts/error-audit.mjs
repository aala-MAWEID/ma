#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const codesPath = path.join(root, 'supabase', 'error-codes.json')
const errorsTsPath = path.join(root, 'src', 'data', 'errors.ts')
const i18nPath = path.join(root, 'src', 'i18n', 'index.ts')

if (!fs.existsSync(codesPath)) {
  console.error('❌ supabase/error-codes.json not found')
  process.exit(1)
}

const codesData = JSON.parse(fs.readFileSync(codesPath, 'utf8'))
const codes = codesData.database || []
const errorsTs = fs.readFileSync(errorsTsPath, 'utf8')
const i18n = fs.readFileSync(i18nPath, 'utf8')

const arIdx = i18n.indexOf('export const ar')
const frIdx = i18n.indexOf('export const fr')

if (arIdx === -1 || frIdx === -1) {
  console.error('❌ Could not parse dictionaries in src/i18n/index.ts')
  process.exit(1)
}

const arBlock = i18n.substring(arIdx, frIdx)
const frBlock = i18n.substring(frIdx)

let errors = 0

for (const code of codes) {
  // Check KNOWN in errors.ts
  const knownRegex = new RegExp(`['"]${code}['"]`)
  if (!knownRegex.test(errorsTs)) {
    console.error(`❌ Error code '${code}' missing from KNOWN set in src/data/errors.ts`)
    errors++
  }

  // Check AR dictionary
  const key = `error.${code}`
  const keyRegex = new RegExp(`['"]${key.replace('.', '\\.')}['"]\\s*:`)
  if (!keyRegex.test(arBlock)) {
    console.error(`❌ Error key '${key}' missing in Arabic translations (src/i18n/index.ts)`)
    errors++
  }

  // Check FR dictionary
  if (!keyRegex.test(frBlock)) {
    console.error(`❌ Error key '${key}' missing in French translations (src/i18n/index.ts)`)
    errors++
  }
}

if (errors > 0) {
  console.error(`\nFound ${errors} error code audit failure(s).`)
  process.exit(1)
}

console.log(`✅ Error code audit passed! All ${codes.length} error codes are tracked in KNOWN and both AR/FR locales.`)
