/** Minimal CSV export. UTF-8 BOM so Excel opens Arabic correctly. */

function cell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: Array<{ key: keyof T | string; label: string; map?: (row: T) => unknown }>,
): string {
  const head = columns.map((c) => cell(c.label)).join(',')
  const body = rows
    .map((row) =>
      columns
        .map((c) => cell(c.map ? c.map(row) : (row as Record<string, unknown>)[c.key as string]))
        .join(','),
    )
    .join('\n')
  return `\uFEFF${head}\n${body}\n`
}

export function downloadCsv(filename: string, content: string): void {
  try {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch {
    /* ignore — export is a convenience, never a crash */
  }
}
