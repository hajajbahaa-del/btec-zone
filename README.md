# منصة BTEC zone (Cloudflare Pages + D1)

هذا المشروع نسخة جاهزة لتشغيل منصة **BTEC zone** على **Cloudflare Pages**:
- Frontend: Cloudflare Pages (Static)
- Backend: Cloudflare Pages Functions (Serverless)
- Database: Cloudflare D1 (SQL)
- ملفات المهمات: يتم رفعها إلى GitHub Repo (نسخة احتياطية) عبر GitHub API

---

## 1) المتطلبات
- حساب GitHub
- حساب Cloudflare
- (اختياري للتجربة محلياً) Node.js + npm

---

## 2) رفع المشروع إلى GitHub
1. أنشئ Repository جديد على GitHub (مثلاً: `btec-zone`)
2. ارفع محتويات هذا المشروع كما هي إلى الـ repo
3. تأكد أن الفرع الأساسي اسمه `main`

---

## 3) إنشاء قاعدة بيانات D1
1. من Cloudflare Dashboard: **Workers & Pages**
2. اذهب إلى **D1** ثم **Create database**
3. سمّها مثلاً: `btec`

بعد الإنشاء: افتح قاعدة البيانات ثم **Run SQL** والصق محتوى ملف `schema.sql` واضغط Run.

---

## 4) إنشاء مشروع Cloudflare Pages
1. **Workers & Pages** > **Pages** > **Create a project**
2. **Connect to Git** ثم اختر Repository الخاص بالمنصة
3. Build settings:
   - Framework preset: None
   - Build command: (اتركه فارغ)
   - Output directory: `public`
4. Deploy

---

## 5) أهم خطوة: Bindings + Secrets
افتح Pages project > **Settings** > **Bindings**:

### A) D1 Binding
- Add > D1 database
- Variable name: `DB`
- اختر قاعدة `btec`

### B) Secrets
Add > Environment variables (Secrets):

#### بيانات الأدمن (كما طلبت)
- `ADMIN_USER` = `bahaahajaj@btec.com`
- `ADMIN_PASS` = `bahaahajaj0775135361btec2007`

> تنبيه مهم: لا تضع كلمة المرور داخل الكود أو GitHub إذا كان الريبو عام. الأفضل تخزينها كـ Secret داخل Cloudflare فقط.

#### JWT
- `JWT_SECRET` = أي نص طويل وعشوائي (مثلاً 40 حرف أو أكثر)

#### GitHub Upload (لرفع ملفات المهمات)
- `GITHUB_TOKEN`  (GitHub Personal Access Token)
- `GITHUB_OWNER`  (اسم حساب GitHub)
- `GITHUB_REPO`   (اسم الريبو الذي تريد تخزين الملفات بداخله)
- (اختياري) `GITHUB_BRANCH` (افتراضي: main)
- (اختياري) `GITHUB_BASE_PATH` (افتراضي: btec_uploads)

---

## 6) كيف يستخدم الأدمن لوحة التحكم؟
- افتح الموقع ثم: `/#/login`
- قسم الأدمن:
  - البريد = `ADMIN_USER`
  - كلمة المرور = `ADMIN_PASS`
- ثم ادخل لوحة التحكم: `/#/admin`

### داخل لوحة التحكم يمكنك:
- إضافة/تعديل درس:
  - اختيار المسار
  - كتابة **اسم الدرس** + **باقة/مستوى الدرس** + **شرح مختصر**
  - إضافة الشرائح بصيغة JSON
- حذف درس
- إضافة جيل (2008/2009/2010…)
- إنشاء مهمة + كتابة وصفها
- رفع ملفات للمهمة (يمكن اختيار عدة ملفات دفعة واحدة)
- حذف مهمة

---

## 7) الطالب: حفظ التقدم
- افتح: `/#/login`
- اكتب أي **اسم مستخدم** وكلمة مرور ثم اضغط **دخول**
  - إذا لم يكن الحساب موجوداً سيتم إنشاؤه تلقائياً
- أثناء مشاهدة الدرس سيتم حفظ:
  - آخر شريحة وصلت لها
  - هل أكملت الدرس أم لا
- في الرئيسية ستظهر لك بطاقة تقدم ونسبة إنجاز

---

## 8) المساعد الذكي
صفحة: `/#/assistant`
- يقوم بالبحث داخل الدروس/المهمات ثم يجيبك بشرح واضح.
- يعمل داخل المتصفح باستخدام WebLLM (قد يحتاج وقت أول مرة لتحميل النموذج).

---

## 9) تشغيل محلي (اختياري)
```bash
npm install
npx wrangler pages dev public
```
> ملاحظة: في الإنتاج الأفضل ضبط bindings من الداشبورد.

