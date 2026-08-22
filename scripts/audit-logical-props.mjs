#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const ROOT = 'src'
const EXT = new Set(['.css', '.ts', '.tsx'])

// Physical direction properties. Every one of these has a logical twin.
const RULES = [
  [/(^|[^-\w])margin-(left|right)\s*:/g,   'margin-inline-start / margin-inline-end'],
  [/(^|[^-\w])padding-(left|right)\s*:/g,  'padding-inline-start / padding-inline-end'],
  [/(^|[^-\w])border-(left|right)(-\w+)?\s*:/g, 'border-inline-start / border-inline-end'],
  [/(^|[^-\w])(left|right)\s*:/g,          'inset-inline-start / inset-inline-end'],
  [/text-align\s*:\s*(left|right)/g,       'text-align: start / end'],
  [/float\s*:\s*(left|right)/g,            'float: inline-start / inline-end'],
  [/border-radius[^;]*\b(top|bottom)-(left|right)/g, 'the logical corner properties'],
]

// Legitimate exceptions: transforms and background positions are geometric,
// not directional, and flipping them would be wrong.
const ALLOW = /(transform|background-position|translate|scaleX|rotate|linear-gradient)/

let failures = 0

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) { walk(p); continue }
    if (!EXT.has(extname(p))) continue

    const lines = readFileSync(p, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (ALLOW.test(line)) return
      for (const [re, fix] of RULES) {
        re.lastIndex = 0
        if (re.test(line)) {
          console.error(`${p}:${i + 1}  physical property — use ${fix}`)
          console.error(`    ${line.trim()}`)
          failures++
          break
        }
      }
    })
  }
}

walk(ROOT)

if (failures > 0) {
  console.error(`\nRTL audit failed: ${failures} physical propert${failures === 1 ? 'y' : 'ies'}.`)
  process.exit(1)
}
console.log('RTL audit passed — logical properties only.')
