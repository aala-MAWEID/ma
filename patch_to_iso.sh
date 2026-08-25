awk '
/function toCamel/ {
  print "function toIso(v: Date | string | number): string {"
  print "  const d = v instanceof Date ? v : new Date(v)"
  print "  if (!Number.isFinite(d.getTime())) throw new AppError('\''unknown'\'', `bad starts_at: ${String(v)}`)"
  print "  return d.toISOString()"
  print "}"
  print ""
}
{ print $0 }
' src/data/supabase/adapter.ts > temp.ts
mv temp.ts src/data/supabase/adapter.ts
