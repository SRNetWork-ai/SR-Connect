# تست‌های E2E

این تست‌ها روی بیلد واقعی اجرا می‌شوند و به یک پستگرس مهاجرت‌شده نیاز دارند.

```bash
export DATABASE_URL=postgres://sr:sr@127.0.0.1:5432/sr
npm run migrate
ADMIN_USERNAME=e2e ADMIN_PASSWORD='E2e-passw0rd!' npm run seed
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

اگر سروری از قبل بالا است:

```bash
E2E_BASE_URL=https://sr.example.ir npm run test:e2e
```
