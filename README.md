<div align="center">

# مواعيد · Maweid

**نظام حجز مواعيد للصالونات والعيادات — عربي/فرنسي، RTL أولاً، وقت فعلي.**

[![deploy](https://github.com/aala-MAWEID/ma/actions/workflows/deploy.yml/badge.svg)](https://github.com/aala-MAWEID/ma/actions/workflows/deploy.yml)

### 🔗 الموقع الحي

**https://aala-maweid.github.io/ma/**

صفحة الصالون: `/zaytouna` · لوحة الإدارة: `/zaytouna/admin` · فحص الاتصال: `/__health`

</div>

---

## المميزات

- حجز في خمس خطوات مع حجز مؤقت للفترة (hold) ومؤقّت انتهاء.
- طابور انتظار لحظي (Realtime) للزبون وللمحل.
- لوحة إدارة كاملة: لوحة قيادة، أجندة، طلبات، زبائن، موظفون، خدمات، هوية، إعدادات، إحصاء، بروفايل.
- دخول بالبريد وكلمة السر أو بحساب جوجل (Supabase Auth) مع صلاحيات دقيقة.
- تعدد المحلات (multi-tenant) عبر المسار `/:slug`.
- واجهة عربية/فرنسية مع دعم RTL كامل وخصائص CSS منطقية.

## التقنيات

| الطبقة | التقنية |
| --- | --- |
| الواجهة | React 19 + TypeScript + Vite 6 |
| التوجيه | React Router 7 |
| البيانات | Supabase (Postgres + RPC + Realtime + Auth) |
| النشر | GitHub Actions → GitHub Pages |

كل القراءات والكتابات تمر عبر واجهة واحدة: `src/data/adapter.ts`، ولها تنفيذان:
`src/data/supabase/adapter.ts` (حقيقي) و `src/data/mock/adapter.ts` (بيانات وهمية دون إنترنت).

## التشغيل محلياً

```bash
git clone https://github.com/aala-MAWEID/ma.git
cd ma
npm install
cp .env.example .env.local   # ثم املأ القيم
npm run dev                  # http://localhost:3000
```

معاينة نسخة الإنتاج كما ستظهر على GitHub Pages:

```bash
VITE_BASE_PATH=/ma/ npm run build:pages
npm run preview:pages        # http://localhost:4173/ma/
```

## متغيرات البيئة

| المتغير | مثال | الوصف |
| --- | --- | --- |
| `VITE_DATA_BACKEND` | `supabase` | `supabase` أو `mock` |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | الأصل فقط بدون `/rest/v1` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` | مفتاح publishable أو anon |
| `VITE_DEFAULT_TENANT` | `zaytouna` | المحل الذي يفتح من الجذر |
| `VITE_BASE_PATH` | `/ma/` | يُضبط في النشر فقط |

لا تضع أبداً `service_role` أو `sb_secret_...` في هذا المشروع: كل ما يبدأ بـ `VITE_` يُدمج في ملفات المتصفح.

## قاعدة البيانات

مخطط كامل جاهز في `supabase/MAWEID-SUPABASE.sql`: ١٤ جدولاً، دوال RPC، RLS، وبيانات بداية.

1. Supabase ← SQL Editor ← الصق الملف كاملاً ← Run.
2. تحقق: `select public.health_check('zaytouna');`
3. ربط حساب المالك: `select public.bind_owner('you@example.com','zaytouna');`

## النشر على GitHub Pages

1. **Settings ← Pages ← Source: GitHub Actions**.
2. **Settings ← Secrets and variables ← Actions ← Variables** أضف:
   `VITE_SUPABASE_URL`، `VITE_SUPABASE_ANON_KEY`، `VITE_DATA_BACKEND=supabase`، `VITE_DEFAULT_TENANT=zaytouna`.
3. أي دفعة إلى `main` تشغّل `deploy.yml` تلقائياً، أو شغّله يدوياً من Actions ← deploy ← Run workflow.
4. النتيجة: https://aala-maweid.github.io/ma/

بعد أول نشر، أضف في Supabase ← Authentication ← URL Configuration:

- Site URL: `https://aala-maweid.github.io/ma/`
- Redirect URLs: `https://aala-maweid.github.io/ma/**` و `http://localhost:3000/**`

## بنية المشروع

```
src/
  components/   مكوّنات admin و booking و shared و ui
  contexts/     Auth · Locale · Tenant · Toast
  data/         adapter.ts + supabase/ + mock/ + domain و errors
  hooks/        useBookingFlow · useAvailability · useAdminCalendar ...
  i18n/         قواميس ar و fr
  pages/        public/ · admin/ · dev/
  routes.tsx    كل المسارات
supabase/       مخطط قاعدة البيانات الكامل
scripts/        تدقيق RTL وملحق النشر
```

## المسارات

| المسار | الصفحة |
| --- | --- |
| `/:slug` | واجهة المحل |
| `/:slug/book` | رحلة الحجز |
| `/:slug/queue` | طابور الانتظار |
| `/:slug/confirm/:code` | تأكيد الحجز |
| `/:slug/me` | حجوزاتي |
| `/:slug/admin/login` | دخول الإدارة |
| `/:slug/admin` | لوحة القيادة |
| `/__health` | فحص الاتصال بـ Supabase |

## الرخصة

استعمال خاص · © aala-MAWEID
