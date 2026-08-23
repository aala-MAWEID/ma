import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dist = resolve(process.cwd(), 'dist')
const index = resolve(dist, 'index.html')

if (!existsSync(index)) {
  console.error('✗ dist/index.html غير موجود — هل نجح vite build ؟')
  process.exit(1)
}

// GitHub Pages يعيد 404.html للمسارات غير الموجودة مع الاحتفاظ بالعنوان،
// فيقلع التطبيق ويقرأ المسار بنفسه (حل SPA القياسي).
copyFileSync(index, resolve(dist, '404.html'))

// يمنع Jekyll من حذف الملفات التي تبدأ بـ _
writeFileSync(resolve(dist, '.nojekyll'), '')

console.log('✔ تم إنشاء dist/404.html و dist/.nojekyll')
