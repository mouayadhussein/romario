# نظام قائمة وطلبات المطعم

تطبيق ويب كامل لإدارة قائمة المطعم واستقبال الطلبات (الدفع نقداً عند الاستلام فقط).

## التقنيات

- **Next.js** (App Router) + TypeScript + Tailwind CSS
- **Supabase**: Postgres, Auth, Storage, Realtime
- النشر المقترح: **Vercel**
- الواجهة بالعربية وRTL افتراضياً

## المتطلبات

- Node.js 20+
- مشروع Supabase

## الإعداد

### 1) تثبيت الحزم

```bash
npm install
```

### 2) متغيرات البيئة

انسخ `.env.example` إلى `.env.local` واملأ القيم من لوحة Supabase (Settings → API):

```bash
cp .env.example .env.local
```

| المتغير | الوصف |
|---------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | المفتاح العام (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح الخدمة — **للخادم فقط، لا تعرضه للمتصفح** |
| `NEXT_PUBLIC_SITE_URL` | رابط الموقع (لـ QR و SEO)، مثال: `http://localhost:3000` |

### 3) قاعدة البيانات

في Supabase SQL Editor نفّذ الملفات بالترتيب:

1. `supabase/migrations/001_schema.sql`
2. `supabase/migrations/002_rls.sql`
3. `supabase/migrations/003_seed.sql`

### 4) Storage

1. أنشئ bucket باسم `menu-images` واجعله **Public**
2. أضف سياسات التخزين (موجودة كتعليقات في `002_rls.sql`) أو نفّذ:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read menu images"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'menu-images');

CREATE POLICY "Admin upload menu images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'menu-images' AND is_admin());

CREATE POLICY "Admin update menu images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'menu-images' AND is_admin())
  WITH CHECK (bucket_id = 'menu-images' AND is_admin());

CREATE POLICY "Admin delete menu images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'menu-images' AND is_admin());
```

### 5) Realtime

في Supabase → Database → Replication فعّل Realtime لجدول `orders`.

### 6) حساب المدير

1. Authentication → Users → Add user (Email + Password)
2. انسخ `user id` للمستخدم، ثم في SQL Editor:

```sql
INSERT INTO admins (user_id) VALUES ('PASTE-USER-UUID-HERE');
```

3. سجّل الدخول عبر `/admin/login` (المستخدم يجب أن يكون في جدول `admins` وإلا لن تمر سياسات RLS)

### 7) التشغيل محلياً

```bash
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000)

## المسارات

| المسار | الوصف |
|--------|--------|
| `/` | قائمة الفروع النشطة |
| `/[branchSlug]` | قائمة الفرع + بحث |
| `/[branchSlug]/cart` | السلة وإتمام الطلب |
| `/admin/login` | دخول المدير |
| `/admin` | الطلبات (Realtime) |
| `/admin/branches` | إدارة الفروع |
| `/admin/branches/[id]` | تصنيفات الفرع |
| `/admin/categories/[id]` | أصناف التصنيف |

## العملة

عدّل العملة من ملف واحد:

```ts
// lib/config.ts
currency: "ILS",
currencySymbol: "₪",
```

## النشر على Vercel

1. ادفع المشروع إلى GitHub
2. Import في Vercel
3. أضف نفس متغيرات البيئة
4. حدّث `NEXT_PUBLIC_SITE_URL` لرابط الإنتاج
5. Deploy

## الأمان

- RLS مفعّل على كل الجداول
- إنشاء الطلبات فقط عبر `POST /api/orders` بمفتاح service role
- الأسعار تُعاد جلبها من قاعدة البيانات (لا يُوثق بسعر العميل)
- Rate limiting أساسي على مسار الطلبات
- مسارات `/admin/*` محمية بـ middleware

## السكربتات

```bash
npm run dev    # تطوير
npm run build  # بناء للإنتاج
npm run lint   # فحص ESLint
npm start      # تشغيل البناء
```
