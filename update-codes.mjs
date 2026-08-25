import fs from 'node:fs'

const codes = JSON.parse(fs.readFileSync('supabase/error-codes.json', 'utf8'))
const clientCodes = ['auth_failed', 'network', 'unknown', 'unsupported']
const databaseCodes = codes.filter(c => !clientCodes.includes(c))

const newStructure = {
  database: databaseCodes,
  client: clientCodes
}

fs.writeFileSync('supabase/error-codes.json', JSON.stringify(newStructure, null, 2))
console.log('updated')
