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
const allManifestRpcNames = new Set([
  ...manifest.publicFunctions.map((f) => f.name),
  ...manifest.adminFunctions.map((f) => f.name),
])

const rpcNamesContent = fs.readFileSync(rpcNamesPath, 'utf8')

let errors = 0
for (const name of allManifestRpcNames) {
  if (!rpcNamesContent.includes(`name: '${name}'`) && !rpcNamesContent.includes(`name: "${name}"`)) {
    console.error(`❌ RPC '${name}' from manifest is missing in src/data/supabase/rpcNames.ts`)
    errors++
  }
}

if (errors > 0) {
  console.error(`\nFound ${errors} RPC parity issue(s).`)
  process.exit(1)
}

console.log('✅ RPC parity audit passed! All manifest functions are matched.')
