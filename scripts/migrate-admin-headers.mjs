import fs from 'fs'
import path from 'path'
const dir = 'src/pages/admin'
for(const f of fs.readdirSync(dir)){
  if(!f.endsWith('.tsx')) continue
  let c = fs.readFileSync(path.join(dir,f),'utf8')
  if(!c.includes('admin-page__head')) continue
  // replace
  c = c.replace(/<header className="admin-page__head">[\s\S]*?<\/header>/g, (match) => {
    const tMatch = match.match(/<h1[^>]*>(?:\{t\('([^']+)'\)\}|([^<]+))<\/h1>/)
    const sMatch = match.match(/<p[^>]*>(?:\{t\('([^']+)'\)\}|([^<]+))<\/p>/)
    
    let titleCode = "'Title'"
    if(tMatch) {
      if(tMatch[1]) titleCode = `t('${tMatch[1]}')`
      else titleCode = `'${tMatch[2]}'`
    }
    
    let subCode = "undefined"
    if(sMatch) {
      if(sMatch[1]) subCode = `t('${sMatch[1]}')`
      else subCode = `'${sMatch[2]}'`
    }
    
    return `<PageHeader title={${titleCode}} ${subCode !== 'undefined' ? `description={${subCode}} ` : ''}/>`
  })
  // add import if missing
  if(!c.includes('PageHeader')) {
    c = c.replace(/import {/, `import { PageHeader } from '@/components/shared/PageHeader'\nimport {`)
  }
  fs.writeFileSync(path.join(dir,f), c)
}
console.log('Done migration')
