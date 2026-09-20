import { NextResponse } from "next/server";
import type { Attachment } from "@sr/protocol";
import { LIMITS } from "@sr/protocol";
import { one } from "@/lib/db/pool";
import { handle, HttpError, requireUser } from "@/lib/auth/guard";
import { imageSize, isImage, mimeAllowed, storeFile } from "@/lib/uploads";
import { serverEnv } from "@/lib/env";
import { rateLimit, RATE } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
// آپلود روی رانتایم نود انجام می‌شود چون به فایل‌سیستم نیاز دارد.
export const runtime = "nodejs";

/**
 * آپلود یک یا چند فایل. پیوست ابتدا «یتیم» ذخیره می‌شود و بعد هنگام ارسال پیام
 * به آن وصل می‌شود؛ این‌طور کاربر می‌تواند قبل از نوشتن متن فایل را بفرستد.
 * با ?kind=avatar فقط یک تصویر با سقف کوچک‌تر پذیرفته می‌شود.
 */
export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const kind = new URL(req.url).searchParams.get("kind") === "avatar" ? "avatar" : "file";

    const limited = rateLimit(`up:${user.id}`, RATE.upload.limit, RATE.upload.windowMs);
    if (!limited.ok) throw new HttpError(429, "تعداد آپلود زیاد شد، چند دقیقه صبر کن");

    const form = await req.formData().catch(() => null);
    if (!form) throw new HttpError(400, "فرم نامعتبر است");

    const raw = [...form.getAll("files"), ...form.getAll("file"), ...form.getAll("avatar")];
    const files = raw.filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) throw new HttpError(400, "فایلی فرستاده نشد");
    if (kind === "avatar" && files.length > 1) throw new HttpError(400, "فقط یک آواتار");
    if (files.length > LIMITS.attachmentsPerMessage) {
      throw new HttpError(400, `حداکثر ${LIMITS.attachmentsPerMessage} فایل در هر پیام`);
    }

    const max =
      kind === "avatar"
        ? LIMITS.avatarBytes
        : Math.min(serverEnv.maxUploadBytes, LIMITS.attachmentBytes);

    const attachments: Attachment[] = [];
    for (const file of files) {
      if (file.size > max) {
        throw new HttpError(413, `حداکثر حجم ${Math.round(max / 1024 / 1024)} مگابایت است`);
      }
      if (!mimeAllowed(file.type)) throw new HttpError(415, `نوع فایل ${file.type} مجاز نیست`);
      if (kind === "avatar" && !isImage(file.type)) {
        throw new HttpError(415, "آواتار باید تصویر باشد");
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const { stored, size } = await storeFile(bytes, file.name);
      const dim = isImage(file.type) ? imageSize(bytes) : null;

      const row = await one<{ id: string }>(
        `insert into attachments (message_id, filename, size, mime, path, width, height)
         values (null, $1, $2, $3, $4, $5, $6) returning id`,
        [file.name.slice(0, 200), size, file.type, stored, dim?.width ?? null, dim?.height ?? null],
      );

      attachments.push({
        id: row!.id,
        filename: file.name,
        size,
        mime: file.type,
        url: `/api/files/${stored}`,
        width: dim?.width ?? null,
        height: dim?.height ?? null,
      });
    }

    return NextResponse.json({ attachments, attachment: attachments[0] }, { status: 201 });
  });
}
