import { NextResponse } from "next/server";
import type { Channel } from "@sr/protocol";
import { one, q } from "@/lib/db/pool";
import { handle, HttpError, requirePermission, requireUser } from "@/lib/auth/guard";
import { notify } from "@/lib/db/events";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    await requireUser();
    const channels = await q<Channel>(
      `select id, category_id as "categoryId", name, type, topic, position,
              is_private as "isPrivate", user_limit as "userLimit", bitrate
         from channels order by position, name`,
    );
    return NextResponse.json({ channels });
  });
}

export function POST(req: Request) {
  return handle(async () => {
    await requirePermission("MANAGE_CHANNELS");

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      type?: Channel["type"];
      categoryId?: string | null;
      topic?: string | null;
      userLimit?: number;
    };

    const name = (body.name ?? "").trim().replace(/\s+/g, "-").slice(0, 40);
    if (name.length < 2) throw new HttpError(400, "نام کانال حداقل ۲ نویسه باشد");

    const type = body.type ?? "text";
    if (!["text", "voice", "stage"].includes(type))
      throw new HttpError(400, "نوع کانال نامعتبر است");

    const channel = await one<Channel>(
      `insert into channels (name, type, category_id, topic, user_limit)
       values ($1, $2, $3, $4, coalesce($5, 20))
       returning id, category_id as "categoryId", name, type, topic, position,
                 is_private as "isPrivate", user_limit as "userLimit", bitrate`,
      [name, type, body.categoryId ?? null, body.topic ?? null, body.userLimit ?? null],
    );

    await notify({ t: "channels_changed" });
    return NextResponse.json({ channel }, { status: 201 });
  });
}
