# تقرير التدقيق الأمني — Debbo / Romario

تاريخ التدقيق: 2026-10-02  
آخر تحديث بعد التنفيذ: 2026-10-02  
النطاق: Next.js 16 + Supabase + Vercel

---

## ملخص تنفيذي

تم تنفيذ تقوية أمنية شاملة عبر المراحل 1–10 دون كسر الميزات الحالية.  
`lint` / `test` / `build` / `rls-check` نجحت. ترحيلات `007` و`008` **للمراجعة فقط** ولم تُنفَّذ على القاعدة من هنا.

---

## الثغرات الأصلية وحالة الإصلاح

### حرجة — أُصلحت

| # | المشكلة | الحالة |
|---|---------|--------|
| C1 | `requireAdmin` بدون `is_admin` | ✅ يتحقق عبر `rpc('is_admin')` |
| C2 | Middleware يقبل أي مستخدم Auth | ✅ فحص أدمن + MFA AAL |
| C3 | تسجيل دخول بدون عضوية admins | ✅ رفض + signOut + رسالة موحّدة |

### عالية — أُصلحت

| # | المشكلة | الحالة |
|---|---------|--------|
| H1 | Rate limit في الذاكرة فقط | ✅ Upstash مع fallback موثّق |
| H2 | لا ترويسات أمان | ✅ HSTS, CSP, XFO, … + `poweredByHeader: false` |
| H3 | سياسات Storage معلّقة | ✅ في ترحيل 007 (للمراجعة) — الـ rls-check أكّد رفض الرفع حالياً |
| H4 | RLS أصناف بلا `is_available` | ✅ إصلاح في 007 + فلتر في صفحات الزبون |
| H5 | service role بدون server-only | ✅ `server-only` + `lib/env.ts` |
| H6 | لا حد لتخمين دخول الأدمن | ✅ حد IP + إيميل |

### متوسطة — أُصلحت

| # | المشكلة | الحالة |
|---|---------|--------|
| M1 | لا تحقق env | ✅ `lib/env.ts` |
| M2 | لا Idempotency / Origin | ✅ في `/api/orders` |
| M3 | حدود zod ضعيفة نسبياً | ✅ `.strict()`، كمية ≤20، رفض HTML، حد جسم |
| M4 | `select('*')` عام | ✅ أعمدة صريحة في صفحات الزبون |
| M5 | رفع صور ضعيف | ✅ MIME/حجم/UUID + تحقق URL سيرفر |
| M6 | لا MFA | ✅ `/admin/mfa/setup` + `/admin/mfa/verify` |
| M7 | لا allowedOrigins | ✅ `experimental.serverActions.allowedOrigins` |
| M8 | لا error pages | ✅ `error.tsx` + `global-error.tsx` |
| M9 | تسريب `error.message` | ✅ رسالة عامة |
| M10 | لا Dependabot/audit | ✅ `.github/dependabot.yml` + `npm run audit` |

### منخفضة — أُصلحت / موثّقة

| # | المشكلة | الحالة |
|---|---------|--------|
| L1 | لا CHECK أطوال نصوص | ✅ ترحيل 007 (مراجعة) |
| L2 | تسجيل غير منظّم | ✅ `lib/logger.ts` بدون PII |
| L3 | لا إشعار خصوصية | ✅ في CartCheckout |
| L4 | لا إخفاء PII قديم | ✅ ترحيل 008 (مراجعة) |
| L5 | window.open بدون noopener | ✅ أُصلح |
| L6 | روابط خارجية | ✅ كانت محمية مسبقاً |

---

## ما بقي على المالك (يدوياً)

انظر `SECURITY.md` بالكامل. أهمه:

1. مراجعة وتطبيق `007_security_hardening.sql` ثم `008_privacy_anonymize.sql`
2. إعداد Upstash على Vercel للإنتاج
3. تقييد مفتاح Google Maps بالنطاق
4. تعطيل التسجيل العام في Supabase
5. تفعيل MFA لحساب الأدمن من `/admin/mfa/setup`
6. فصل env Production/Preview وحماية Preview على Vercel

---

## ملاحظات تقنية

- **CSP:** فُرضت (enforce) مع allowlist لـ Supabase وGoogle Maps. `unsafe-inline` / `unsafe-eval` موثّقان في `next.config.ts` لأن Next.js RSC + Maps لا يدعمون حالياً nonce بسيطاً دون كسر.
- **أسرار:** لا مفاتيح في الكود أو في git. `.env*` في `.gitignore`.
- **npm audit --omit=dev:** 0 vulnerabilities.
- **rls-check:** 12/12 نجحت ضد مشروعك الحالي.

---

## اعتماديات متبقية (مرحلة 8)

| الحزمة | الخطورة | القرار |
|--------|---------|--------|
| `vitest` / `@vitest/mocker` | متوسطة (dev فقط) | لم نرفع لـ vitest 5 عبر `--force` لتجنب كسر الاختبارات. Dependabot سيُنبّه أسبوعياً. الإنتاج (`npm run audit`) = 0. |

لا حزم إنتاج غير مستخدمة واضحة؛ `package-lock` مثبّت بعد تثبيت `server-only` وUpstash و`tsx`.
