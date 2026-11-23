# راهنمای آپلود روی GitHub (با توکن) و نصب روی Cloudflare Pages

این پروژه به‌طور کامل برای آپلود بدون خطا روی **GitHub** و اجرای هم‌زمان فرانت‌اند + بک‌اند زنده (`/api/*`) روی **Cloudflare Pages + Pages Functions** آماده شده است.

---

## مرحله ۱: آپلود پروژه روی GitHub با توکن (Personal Access Token)

### الف) ساخت توکن در GitHub
1. وارد اکانت GitHub شوید و به مسیر زیر بروید:
   `Settings → Developer settings → Personal access tokens → Tokens (classic)` (یا Fine-grained tokens)
2. یک توکن با دسترسی **`repo`** بسازید و کپی کنید.
3. یک ریپازیتوری خالی (بدون README و gitignore) در GitHub بسازید (مثلاً با نام `football-ai`).

### ب) آپلود امن (روش پیشنهادی با اسکریپت آماده)
در ترمینال پوشه پروژه دستور زیر را اجرا کنید:

```bash
bash scripts/github-push.sh
```

اسکریپت به‌صورت خودکار:
- بیلد و تایپ‌اسکریپت (`npm run lint` و `npm run build`) را چک می‌کند.
- فایل‌های حساس (`.env`, `.dev.vars`, `.wrangler`, `node_modules`, `dist`) را نادیده می‌گیرد.
- نام کاربری، نام ریپازیتوری و توکن شما را می‌پرسد و **بدون ذخیره کردن توکن داخل `.git/config`** کد را روی شاخه `main` آپلود می‌کند.

### ج) روش دستی (در صورت تمایل)
```bash
git init
git branch -M main
git add -A
git commit -m "Initial deploy: Football AI live platform"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```
*(در زمان پرسیدن پسورد در ترمینال، به‌جای رمز اکانت، **Personal Access Token** را وارد کنید.)*

---

## مرحله ۲: نصب و دیپلوی روی Cloudflare Pages

### روش ۱: اتصال مستقیم به GitHub (پیشنهادی — آپدیت خودکار با هر Push)
1. وارد داشبورد **Cloudflare** شوید و از منوی سمت چپ به بخش **Workers & Pages** بروید.
2. روی **Create** → تب **Pages** → **Connect to Git** کلیک کنید و ریپازیتوری GitHub خود را انتخاب کنید.
3. تنظیمات Build را دقیقاً به شکل زیر وارد کنید:
   - **Framework preset:** `Vite` (یا `None`)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. در بخش **Environment variables (Production & Preview)** متغیرهای زیر را اضافه کنید:
   - `NODE_VERSION` = `22`
   - `GEMINI_API_KEY` = کلید واقعی Gemini شما *(به‌صورت Secret/Encrypted ذخیره شود — برای بخش AI Football Lab)*
   - `GEMINI_MODEL` = `gemini-2.5-flash` *(اختیاری)*
5. روی **Save and Deploy** کلیک کنید.

> نکته: پوشه `functions/api/[[path]].ts` به‌صورت خودکار توسط Cloudflare Pages به‌عنوان **Pages Functions** شناسایی و اجرا می‌شود؛ بنابراین تمام APIهای زنده فوتبال جهان، **لیگ برتر خلیج فارس ایران**، مرکز بازی و **AI Football Lab** بدون نیاز به سرور جداگانه کار خواهند کرد!

### روش ۲: دیپلوی مستقیم از ترمینال با Wrangler CLI
```bash
npm install
npm run build
npx wrangler login
npx wrangler pages project create football-ai --production-branch=main
npx wrangler pages secret put GEMINI_API_KEY --project-name=football-ai
npx wrangler pages deploy dist --project-name=football-ai
```

---

## بررسی پس از نصب
پس از اتمام دیپلوی، آدرس‌های زیر را روی دامنه Cloudflare خود باز کنید:
- `/` — صفحه اصلی داشبورد زنده فوتبال + لیگ برتر ایران
- `/api/health` — باید `{ "ok": true, "runtime": "cloudflare-pages" }` برگرداند
- `/api/football/bootstrap` — باید لیست کامل ۸ لیگ (از جمله `pgpl` لیگ برتر ایران)، جداول و نتایج زنده را برگرداند
