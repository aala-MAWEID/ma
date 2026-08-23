#!/usr/bin/env node
/**
 * يقارن كل t('key') في src مع مفاتيح ar/fr ويفشل البناء عند أي نقص.
 * يتجاهل المفاتيح الديناميكية (المنتهية بنقطة) لأنها تُبنى في وقت التشغيل.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'

const SRC = 'src'
const I18N = join(SRC, 'i18n', 'index.ts')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (['.ts', '.tsx'].includes(extname(full))) out.push(full)
  }
  return out
}

const source = readFileSync(I18N, 'utf8')
const frAt = source.indexOf('export const fr')
const arBlock = source.slice(0, frAt)
const frBlock = source.slice(frAt)
const keysOf = (block) =>
  new Set([...block.matchAll(/'([A-Za-z0-9_.]+)':/g)].map((m) => m[1]))

const arKeys = keysOf(arBlock)
const frKeys = keysOf(frBlock)

const used = new Map()
for (const file of walk(SRC)) {
  if (file === I18N) continue
  const text = readFileSync(file, 'utf8')
  for (const m of text.matchAll(/\bt\(\s*'([A-Za-z0-9_.]+)'/g)) {
    if (m[1].endsWith('.')) continue
    if (!used.has(m[1])) used.set(m[1], file)
  }
}

const missingAr = [...used.keys()].filter((k) => !arKeys.has(k))
const missingFr = [...arKeys].filter((k) => !frKeys.has(k))

if (missingAr.length || missingFr.length) {
  for (const k of missingAr) console.error('[i18n] مفتاح مفقود في ar:', k, '←', used.get(k))
  for (const k of missingFr) console.error('[i18n] مفتاح مفقود في fr:', k)
  process.exit(1)
}

console.log('[i18n] سليم:', used.size, 'مفتاح مستعمل،', arKeys.size, 'معرّف في اللغتين.')
