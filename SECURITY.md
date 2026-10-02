# SECURITY.md — قائمة فحص يدوية لمالك المشروع

هذا الملف يكمّل ما يفعله الكود. نفّذ البنود أدناه في لوحات التحكم الخارجية.

## Supabase

- [ ] عطّل التسجيل العام (Authentication → Providers → Email → Disable sign-ups) إلا إذا احتجت مستخدمين جدد؛ أضف الأدمن يدوياً ثم صفّاً في جدول `admins`.
- [ ] سياسة كلمات مرور قوية (Auth → Settings): طول أدنى، وتعقيد إن توفر.
- [ ] فعّل MFA على مستوى المشروع إن لزم، وفعّل TOTP لحسابات الأدمن من `/admin/mfa/setup`.
- [ ] راجع أن سياسات Storage لـ `menu-images` مطبّقة (ترحيل `007_security_hardening.sql`).
- [ ] نفّذ ترحيلات `007` و`008` بعد المراجعة فقط (لا تُنفَّذ تلقائياً من التطبيق).
- [ ] فعّل النسخ الاحتياطي / Point-in-time recovery حسب خطتك.
- [ ] قيّد شبكة قاعدة البيانات إن توفر (Network restrictions).
- [ ] دوّر `service_role` و`anon` فوراً إذا تسرب أي مفتاح.
- [ ] جدول `admins`: أضف فقط `user_id` للمالكين؛ لا تمنح صلاحيات عبر الواجهة العامة.

## Vercel

- [ ] أضف كل المتغيرات من `.env.local` في Project → Settings → Environment Variables.
- [ ] افصل قيم **Production** عن **Preview** (مفاتيح مختلفة إن أمكن).
- [ ] احمِ نسخ Preview (Password Protection / Deployment Protection).
- [ ] فعّل Vercel Firewall / Attack Challenge Mode إن توفر.
- [ ] تأكد أن `NEXT_PUBLIC_SITE_URL` هو النطاق الحقيقي للإنتاج (HTTPS).
- [ ] بعد أي تغيير env: Redeploy.

## Upstash (Rate limiting)

- [ ] أنشئ قاعدة Redis (REST) واربط:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`
- [ ] بدونها يعمل حدّ الطلبات في الذاكرة لكل instance فقط (موثّق في السجلات في الإنتاج).

## Google Cloud (Maps)

- [ ] قيّد مفتاح Maps بنطاقات الموقع الحقيقي فقط (HTTP referrers).
- [ ] فعّل الميزانية والتنبيهات على الفوترة.
- [ ] لا تضع مفاتيح غير ضرورية في `NEXT_PUBLIC_*`.

## متغيرات البيئة المطلوبة

| المتغير | أين | ملاحظات |
|---------|-----|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + محلي | عام |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + محلي | عام (مقيد بـ RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (Server) فقط | سرّ — لا `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | Vercel | أصل الموقع |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | اختياري | مقيّد بالنطاق |
| `NEXT_PUBLIC_GOOGLE_MAP_ID` | اختياري | Map ID |
| `UPSTASH_REDIS_REST_URL` | مُستحسن للإنتاج | |
| `UPSTASH_REDIS_REST_TOKEN` | مُستحسن للإنتاج | |
| `SENTRY_DSN` | اختياري | جاهزية مستقبلية — انظر أدناه |
| `CUSTOMER_PII_RETENTION_MONTHS` | اختياري | توثيق / وظائف مجدولة |

## Sentry (اختياري)

1. أنشئ مشروع Next.js في Sentry.
2. ضع `SENTRY_DSN` في Vercel (Server).
3. أضف `@sentry/nextjs` واتبع معالجهم الرسمي؛ لا ترسل PII (اسم/هاتف/عنوان) في الأحداث.
4. الكود الحالي يستخدم `lib/logger.ts` بتنسيق JSON جاهز للربط.

## جدولة إخفاء بيانات الزبون

بعد تطبيق `008_privacy_anonymize.sql`:

```sql
-- يدوياً أو عبر cron (service_role)
SELECT public.anonymize_old_order_pii(6);
```

## تحقق بعد النشر

1. `npm run build && npm run lint && npm test && npm run rls-check`
2. جرّب طلب من الواجهة + خريطة + صور.
3. حاول دخول `/admin` بمستخدم غير أدمن — يجب الرفض.
4. تأكد من ترويسات الأمان في استجابة الصفحة (`Content-Security-Policy`, `Strict-Transport-Security`, …).
