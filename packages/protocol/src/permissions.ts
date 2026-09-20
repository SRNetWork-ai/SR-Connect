/**
 * ماسک دسترسی‌ها — یک عدد ۳۲ بیتی که در نقش‌ها ذخیره می‌شود.
 * ترتیب بیت‌ها هیچ‌وقت نباید عوض شود؛ فقط بیت جدید ته لیست اضافه کن.
 */
export const PERMISSION_BITS = {
  VIEW_CHANNEL: 1 << 0,
  SEND_MESSAGE: 1 << 1,
  EMBED_LINKS: 1 << 2,
  ATTACH_FILES: 1 << 3,
  ADD_REACTION: 1 << 4,
  MENTION_EVERYONE: 1 << 5,
  MANAGE_MESSAGES: 1 << 6,
  CONNECT_VOICE: 1 << 7,
  SPEAK: 1 << 8,
  VIDEO: 1 << 9,
  SCREEN_SHARE: 1 << 10,
  PRIORITY_SPEAKER: 1 << 11,
  MUTE_MEMBERS: 1 << 12,
  MOVE_MEMBERS: 1 << 13,
  MANAGE_CHANNELS: 1 << 14,
  MANAGE_ROLES: 1 << 15,
  CREATE_INVITE: 1 << 16,
  MANAGE_UPDATES: 1 << 17,
  ADMINISTRATOR: 1 << 18,
} as const;

export type PermissionName = keyof typeof PERMISSION_BITS;

export const PERMISSION_LABELS: Record<PermissionName, string> = {
  VIEW_CHANNEL: "دیدن کانال",
  SEND_MESSAGE: "ارسال پیام",
  EMBED_LINKS: "پیش‌نمایش لینک",
  ATTACH_FILES: "پیوست فایل",
  ADD_REACTION: "واکنش",
  MENTION_EVERYONE: "منشن همه",
  MANAGE_MESSAGES: "مدیریت پیام‌ها",
  CONNECT_VOICE: "اتصال به صوت",
  SPEAK: "صحبت کردن",
  VIDEO: "دوربین",
  SCREEN_SHARE: "پخش صفحه",
  PRIORITY_SPEAKER: "گوینده‌ی اولویت‌دار",
  MUTE_MEMBERS: "بی‌صدا کردن دیگران",
  MOVE_MEMBERS: "جابه‌جایی اعضا",
  MANAGE_CHANNELS: "مدیریت کانال‌ها",
  MANAGE_ROLES: "مدیریت نقش‌ها",
  CREATE_INVITE: "ساخت دعوت‌نامه",
  MANAGE_UPDATES: "مدیریت آپدیت‌ها",
  ADMINISTRATOR: "دسترسی کامل",
};

export const ALL_PERMISSIONS = Object.values(PERMISSION_BITS).reduce((a, b) => a | b, 0);

export const DEFAULT_MEMBER_PERMISSIONS =
  PERMISSION_BITS.VIEW_CHANNEL |
  PERMISSION_BITS.SEND_MESSAGE |
  PERMISSION_BITS.EMBED_LINKS |
  PERMISSION_BITS.ATTACH_FILES |
  PERMISSION_BITS.ADD_REACTION |
  PERMISSION_BITS.CONNECT_VOICE |
  PERMISSION_BITS.SPEAK |
  PERMISSION_BITS.VIDEO |
  PERMISSION_BITS.SCREEN_SHARE;

/** ساخت ماسک از روی نام دسترسی‌ها — برای تست و seed. */
export function maskOf(...names: PermissionName[]): number {
  return names.reduce((acc, n) => acc | PERMISSION_BITS[n], 0);
}

export function has(mask: number, permission: PermissionName): boolean {
  if (mask & PERMISSION_BITS.ADMINISTRATOR) return true;
  return (mask & PERMISSION_BITS[permission]) !== 0;
}

export function listPermissions(mask: number): PermissionName[] {
  return (Object.keys(PERMISSION_BITS) as PermissionName[]).filter((p) => has(mask, p));
}

/** ترکیب نقش‌ها و سپس اعمال allow/deny مخصوص کانال. */
export function effectivePermissions(
  roleMasks: number[],
  overrides: { allow: number; deny: number }[] = [],
): number {
  let mask = roleMasks.reduce((a, b) => a | b, 0);
  if (mask & PERMISSION_BITS.ADMINISTRATOR) return ALL_PERMISSIONS;
  for (const o of overrides) mask = (mask & ~o.deny) | o.allow;
  return mask;
}
