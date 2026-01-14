# BTEC zone (Cloudflare Pages + D1) — بدون تشغيل جهازك

هذا المشروع نسخة جاهزة لتشغيل منصة BTEC zone على **Cloudflare Pages** بدون سيرفر تقليدي:
- Frontend: Cloudflare Pages (تحديث تلقائي عند أي Push على GitHub)
- Backend: Cloudflare Pages Functions (Serverless)
- Database: Cloudflare D1 (SQL)
- ملفات المهمات: يتم رفعها تلقائياً إلى GitHub Repo عبر GitHub API (مخزنة كنسخة احتياطية دائمة)

> ملاحظة: رفع الملفات عبر GitHub API مناسب للملفات الصغيرة/المتوسطة (مثلاً ≤ 20MB). لو احتجت ملفات كبيرة لاحقاً نضيف تخزين بديل.

---

## 1) المتطلبات
- حساب GitHub
- حساب Cloudflare (مجاني)
- (اختياري للتجربة محلياً) Node.js + npm

---

## 2) رفع المشروع إلى GitHub
1. أنشئ Repository جديد على GitHub (مثلاً: `btec`)
2. ارفع محتويات هذا المشروع كما هي إلى الـ repo (باستخدام Upload في GitHub أو Git)
3. تأكد أن الفرع الأساسي اسمه `main`

---

## 3) إنشاء قاعدة بيانات D1 (من لوحة Cloudflare)
1. افتح Cloudflare Dashboard
2. اذهب إلى **Workers & Pages**
3. اذهب إلى **D1**
4. اضغط **Create database**
5. سمّها مثلاً: `btec`

بعد الإنشاء: افتح قاعدة البيانات ثم **Run SQL** والصق محتوى ملف `schema.sql` واضغط Run.

---

## 4) إنشاء مشروع Cloudflare Pages وربطه مع GitHub (نشر تلقائي)
1. اذهب إلى **Workers & Pages**
2. اختر **Pages** ثم **Create a project**
3. اختر **Connect to Git** ثم اربط GitHub
4. اختر Repository الخاص بالمنصة
5. Build settings:
   - Framework preset: None
   - Build command: (اتركه فارغ)
   - Output directory: `public`
6. اضغط Deploy

---

## 5) إضافة Bindings (ربط D1 + Secrets) — أهم خطوة
افتح Pages project > **Settings** > **Bindings**:

### A) ربط قاعدة البيانات (D1 Binding)
- Add > D1 database
- Variable name: `DB`
- اختر قاعدة `btec`

### B) Secrets (بيانات الأدمن + JWT + GitHub)
Add > Environment variables (Secrets):

- `ADMIN_USER`  (مثلاً: admin)
- `ADMIN_PASS`  (كلمة سر قوية)
- `JWT_SECRET`  (أي نص طويل عشوائي)

لرفع الملفات على GitHub (مطلوب لرفع ملفات المهمات):
- `GITHUB_TOKEN`  (GitHub Personal Access Token)
- `GITHUB_OWNER`  (اسم حساب GitHub)
- `GITHUB_REPO`   (اسم الريبو الذي تريد تخزين الملفات بداخله)
- (اختياري) `GITHUB_BRANCH` (افتراضي: main)
- (اختياري) `GITHUB_BASE_PATH` (افتراضي: btec_uploads)

---

## 6) كيف يدخل الأدمن؟
- افتح الموقع > صفحة تسجيل الدخول: `/#/login`
- قسم الأدمن:
  - Username = قيمة `ADMIN_USER`
  - Password = قيمة `ADMIN_PASS`
- ثم ادخل لوحة التحكم: `/#/admin`

---

## 7) رفع ملفات للمهمات (بدون خبرة تقنية)
1. ادخل لوحة التحكم `/#/admin`
2. في قسم "رفع ملف لمهمة"
3. اختر مهمة من القائمة
4. اختر ملف
5. اضغط "رفع"
- الملف سيُرفع إلى GitHub داخل `btec_uploads/<taskId>/...`
- وسيظهر فوراً للطلاب في صفحة المهمة

---

## 8) تشغيل محلي للتجربة (اختياري)
```bash
npm install
npx wrangler pages dev public
```
> ملاحظة: لكي يعمل D1 محلياً تحتاج ضبط `wrangler.toml` أو استخدام Cloudflare dashboard bindings. في الإنتاج الأفضل ضبط bindings من الداشبورد.

---
