#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const SRC = 'src/styles'
function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (extname(full) === '.css') out.push(full)
  }
  return out
}

const cssFiles = walk(SRC)
const declaredTokens = new Set()
const usedTokens = []

for (const file of cssFiles) {
  const text = readFileSync(file, 'utf8')
  // Find declarations: --something: value;
  for (const match of text.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) {
    declaredTokens.add(match[1])
  }
  // Find usages: var(--something) or var(--something, fallback)
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    for (const match of line.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)(\s*,[^)]+)?\s*\)/g)) {
      if (!match[2]) { // Ignore if there's a fallback
        usedTokens.push({ name: match[1], file, line: i + 1 })
      }
    }
  })
}

// Search in TS/TSX for inline styles declaring variables
const TS_SRC = 'src'
function walkTs(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkTs(full))
    else if (['.ts', '.tsx'].includes(extname(full))) out.push(full)
  }
  return out
}

const tsFiles = walkTs(TS_SRC)
for (const file of tsFiles) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(/(--[a-zA-Z0-9_-]+)['"]?\s*:/g)) {
    declaredTokens.add(match[1])
  }
}

let hasError = false
for (const token of usedTokens) {
  if (!declaredTokens.has(token.name)) {
    console.error(`[CSS Token Error] Unrecognized token '${token.name}' used in ${token.file}:${token.line}`)
    hasError = true
  }
}

if (hasError) {
  process.exit(1)
} else {
  console.log(`[CSS Token] OK: ${usedTokens.length} usages checked against ${declaredTokens.size} declarations.`)
}
