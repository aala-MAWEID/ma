#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const manifestPath = path.join(root, 'supabase', 'api-manifest.json')
const rpcNamesPath = path.join(root, 'src', 'data', 'supabase', 'rpcNames.ts')

if (!fs.existsSync(manifestPath)) {
  console.error('❌ supabase/api-manifest.json not found')
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const manifestFns = new Map()

for (const fn of [...(manifest.publicFunctions || []), ...(manifest.adminFunctions || [])]) {
  manifestFns.set(fn.name, fn.args || [])
}

const rpcNamesContent = fs.readFileSync(rpcNamesPath, 'utf8')

let errors = 0
for (const [name] of manifestFns.entries()) {
  if (!rpcNamesContent.includes(`name: '${name}'`) && !rpcNamesContent.includes(`name: "${name}"`)) {
    console.error(`❌ RPC '${name}' from manifest is missing in src/data/supabase/rpcNames.ts`)
    errors++
  }
}

// Reverse direction: anything the client calls must exist in the manifest.
for (const match of rpcNamesContent.matchAll(/name:\s*['"]([a-z0-9_]+)['"]/g)) {
  if (!manifestFns.has(match[1])) {
    console.error(
      `❌ RPC '${match[1]}' is called by the client but missing in supabase/api-manifest.json`,
    )
    errors++
  }
}

if (errors > 0) {
  console.error(`\nFound ${errors} RPC parity issue(s).`)
  process.exit(1)
}

console.log(`✅ RPC parity audit passed! All ${manifestFns.size} manifest functions are matched.`)
