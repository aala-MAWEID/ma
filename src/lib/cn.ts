export function cn(
  ...classes: Array<string | boolean | undefined | null | { [key: string]: boolean | undefined | null }>
): string {
  const out: string[] = []
  for (const c of classes) {
    if (!c) continue
    if (typeof c === 'string') {
      out.push(c)
    } else if (typeof c === 'object') {
      for (const [key, val] of Object.entries(c)) {
        if (val) out.push(key)
      }
    }
  }
  return out.join(' ')
}
