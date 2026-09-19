# مشارکت در SR-Connect

## راه‌اندازی محلی

```bash
git clone https://github.com/SRNetWork-ai/SR-Connect.git
cd SR-Connect
npm install
cp .env.example .env
npm run keygen -- deploy/keys
npm run migrate && npm run seed
npm run dev
```

بدون `DATABASE_URL` هم بالا می‌آید (حالت دمو in-memory).

## قبل از ارسال PR

```bash
npm run typecheck     # باید تمیز باشد
npm run build         # باید موفق باشد
npm run format        # Prettier
bash -n deploy/scripts/*.sh
```

## قواعد

- کامیت‌ها به سبک Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`
- تایپ‌های مشترک را در `packages/protocol` بگذار، نه در اپ‌ها
- اگر پروتکل بلادرنگ را تغییر دادی، `API_VERSION` را بالا ببر
- هیچ secret، کلید یا فایل `.env` واقعی کامیت نشود
- برای مهاجرت دیتابیس، فایل جدید با شمارهٔ بعدی بساز — فایل‌های قبلی را ویرایش نکن
