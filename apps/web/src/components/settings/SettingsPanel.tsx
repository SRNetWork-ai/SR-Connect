"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  Ban,
  DatabaseBackup,
  ImagePlus,
  Hash,
  Link2,
  Plus,
  ScrollText,
  Shield,
  Trash2,
  UserRound,
  Users,
  Volume2,
  Waves,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AuditEntry, Category, Channel } from "@sr/protocol";
import { PERMISSION_BITS, PERMISSION_LABELS, has } from "@sr/protocol";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { riseIn, springSnappy, tap } from "@/lib/motion";
import { fa } from "@/lib/fmt";
import { useApp } from "@/store/use-app";

interface Role {
  id: string;
  name: string;
  color: string;
  permissions: number;
  position: number;
  isDefault: boolean;
  members: number;
}

interface Invite {
  code: string;
  uses: number;
  maxUses: number;
  expiresAt: string | null;
}

type Tab =
  | "profile"
  | "channels"
  | "emoji"
  | "members"
  | "roles"
  | "invites"
  | "audit"
  | "bans"
  | "welcome"
  | "backup"
  | "danger";

export function SettingsPanel() {
  const me = useApp((s) => s.me);
  const channels = useApp((s) => s.channels);
  const categories = useApp((s) => s.categories);
  const refreshChannels = useApp((s) => s.refreshChannels);
  const [tab, setTab] = useState<Tab>("profile");
  const [error, setError] = useState<string | null>(null);

  const canManageChannels = me ? me.isAdmin || has(me.permissions, "MANAGE_CHANNELS") : false;
  const canManageRoles = me ? me.isAdmin || has(me.permissions, "MANAGE_ROLES") : false;
  const canInvite = me ? me.isAdmin || has(me.permissions, "CREATE_INVITE") : false;
  const canAudit = canManageRoles;

  const onError = useCallback((e: string | null) => setError(e), []);

  return (
    <div className="scroll-y flex-1 p-6">
      <div className="mx-auto max-w-[820px] space-y-5">
        <header className="flex items-center gap-3">
          <Shield className="size-6 text-brand" />
          <div>
            <h1 className="text-xl font-bold text-t1">تنظیمات سرور</h1>
            <p className="text-sm text-t4">
              پروفایل سرور، اعضا، نقش‌ها، دعوت‌نامه‌ها، گزارش و پشتیبان
            </p>
          </div>
        </header>

        <nav className="scroll-x flex gap-1.5 overflow-x-auto pb-1">
          {(
            [
              ["profile", "پروفایل سرور", UserRound],
              ["channels", "کانال‌ها", Hash],
              ["emoji", "ایموجی و استیکر", ImagePlus],
              ["members", "ممبرها", Users],
              ["roles", "نقش‌ها و دسترسی", Users],
              ["invites", "دعوت‌نامه‌ها", Link2],
              ["audit", "گزارش فعالیت", ScrollText],
              ["bans", "لیست بن", Ban],
              ["welcome", "ولکام اسکرین", Waves],
              ["backup", "بکاپ", DatabaseBackup],
              ["danger", "حذف سرور", Trash2],
            ] as const
          ).map(([id, label, Icon]) => (
            <motion.button
              key={id}
              type="button"
              whileTap={tap}
              onClick={() => setTab(id)}
              aria-selected={tab === id}
              className={cn(
                "relative flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-sm transition-colors",
                tab === id ? "text-white" : "bg-card text-t3 hover:bg-hover",
              )}
            >
              {tab === id && (
                <motion.span
                  layoutId="settings-tab"
                  transition={springSnappy}
                  className="absolute inset-0 -z-10 rounded-[6px] bg-brand shadow-[0_4px_14px_-6px_var(--color-brand)]"
                />
              )}
              <Icon className="size-3.5" />
              {label}
            </motion.button>
          ))}
        </nav>

        {error && (
          <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-[#ff8a8d]">{error}</p>
        )}

        {/* محتوای تب با گذار نرم عوض می‌شود تا جابه‌جایی «پرش» نداشته باشد. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            variants={riseIn}
            initial="hidden"
            animate="show"
            exit="exit"
            className="space-y-5"
          >
            {tab === "profile" && <ServerFeature title="پروفایل سرور" />}
            {tab === "channels" && (
              <ChannelsTab
                canManage={canManageChannels}
                channels={channels}
                categories={categories}
                onChanged={refreshChannels}
                onError={onError}
              />
            )}
            {tab === "roles" && <RolesTab canManage={canManageRoles} onError={onError} />}
            {tab === "invites" && <InvitesTab canManage={canInvite} onError={onError} />}
            {tab === "audit" && <AuditTab canManage={canAudit} onError={onError} />}
            {tab === "emoji" && <ServerFeature title="ایموجی و استیکر اختصاصی" />}
            {tab === "members" && <ServerFeature title="مشاهده، جست‌وجو و مدیریت ممبرها" />}
            {tab === "bans" && <ServerFeature title="لیست کاربران بن‌شده" />}
            {tab === "welcome" && <ServerFeature title="ولکام اسکرین" />}
            {tab === "backup" && <ServerFeature title="بکاپ و بازیابی سرور" />}
            {tab === "danger" && <ServerFeature title="حذف سرور" danger />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function ServerFeature({ title, danger = false }: { title: string; danger?: boolean }) {
  return (
    <section className={cn("rounded-lg bg-card p-6", danger && "border border-danger/30")}>
      <h2 className={cn("text-base font-black", danger ? "text-danger" : "text-t1")}>{title}</h2>
      <p className="mt-2 text-sm text-t4">
        رابط این بخش آماده شده؛ عملیات حساس آن پس از اضافه‌شدن API و تأیید امنیتی فعال می‌شود.
      </p>
    </section>
  );
}

function ChannelsTab({
  canManage,
  channels,
  categories,
  onChanged,
  onError,
}: {
  canManage: boolean;
  channels: Channel[];
  categories: Category[];
  onChanged: () => Promise<void>;
  onError: (e: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "voice" | "stage">("text");
  const [categoryId, setCategoryId] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    setBusy(true);
    try {
      await api.post("/api/channels", { name, type, categoryId: categoryId || null });
      setName("");
      await onChanged();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : "ساخت کانال ناموفق بود");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg bg-card p-5">
      {canManage && (
        <form
          onSubmit={create}
          className="flex flex-wrap items-end gap-3 border-b border-divider pb-5"
        >
          <div className="min-w-[180px] flex-1">
            <Field
              label="نام کانال جدید"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="گفت‌وگوی-عمومی"
            />
          </div>
          <label className="text-sm">
            <span className="mb-1.5 block text-xs font-bold text-t3">نوع</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              className="h-10 rounded-[3px] bg-deep px-3 text-base text-t2 outline-none"
            >
              <option value="text">متنی</option>
              <option value="voice">صوتی</option>
              <option value="stage">استیج</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block text-xs font-bold text-t3">دسته</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-10 rounded-[3px] bg-deep px-3 text-base text-t2 outline-none"
            >
              <option value="">بدون دسته</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" loading={busy} disabled={!name.trim()}>
            <Plus className="size-4" />
            بساز
          </Button>
        </form>
      )}

      <ul className="mt-4 space-y-1">
        {channels.map((c) => (
          <li
            key={c.id}
            className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 hover:bg-hover"
          >
            {c.type === "text" ? (
              <Hash className="size-4 text-t4" />
            ) : (
              <Volume2 className="size-4 text-t4" />
            )}
            <span className="text-base text-t2">{c.name}</span>
            {c.topic && <span className="truncate text-xs text-t5">{c.topic}</span>}
            <span className="ms-auto flex gap-1.5">
              {c.isPrivate && <Badge tone="warning">خصوصی</Badge>}
              {c.type !== "text" && <Badge tone="outline">ظرفیت {fa(c.userLimit)}</Badge>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RolesTab({
  canManage,
  onError,
}: {
  canManage: boolean;
  onError: (e: string | null) => void;
}) {
  const [roles, setRoles] = useState<Role[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (!canManage) return;
    void api
      .get<{ roles: Role[] }>("/api/admin/roles")
      .then((d) => {
        setRoles(d.roles);
        setSelected(d.roles[0]?.id ?? null);
      })
      .catch((err) => onError((err as Error).message));
  }, [canManage, onError]);

  if (!canManage) {
    return <p className="rounded-lg bg-card p-5 text-sm text-t4">دسترسی مدیریت نقش‌ها را نداری.</p>;
  }

  const role = roles.find((r) => r.id === selected);

  async function toggle(bit: keyof typeof PERMISSION_BITS) {
    if (!role) return;
    const next = role.permissions ^ PERMISSION_BITS[bit];
    setRoles((rs) => rs.map((r) => (r.id === role.id ? { ...r, permissions: next } : r)));
    try {
      await api.patch("/api/admin/roles", { id: role.id, permissions: next });
    } catch (err) {
      onError((err as Error).message);
    }
  }

  async function create() {
    if (!newName.trim()) return;
    try {
      const res = await api.post<{ role: Role }>("/api/admin/roles", { name: newName.trim() });
      setRoles((rs) => [...rs, { ...res.role, members: 0 }]);
      setSelected(res.role.id);
      setNewName("");
    } catch (err) {
      onError((err as Error).message);
    }
  }

  return (
    <section className="flex gap-5 rounded-lg bg-card p-5">
      <aside className="w-[200px] shrink-0">
        <ul className="space-y-1">
          {roles.map((r) => (
            <li key={r.id}>
              <button
                onClick={() => setSelected(r.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-[4px] px-2 py-1.5 text-start text-sm",
                  selected === r.id ? "bg-brand text-white" : "text-t3 hover:bg-hover",
                )}
              >
                <span className="size-2.5 rounded-full" style={{ background: r.color }} />
                <span className="truncate">{r.name}</span>
                <span className="tnum ms-auto text-2xs opacity-70">{fa(r.members)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex gap-1.5">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="نقش جدید"
            className="h-8 min-w-0 flex-1 rounded-[3px] bg-deep px-2 text-sm text-t2 outline-none placeholder:text-t5"
          />
          <Button size="sm" onClick={() => void create()}>
            <Plus className="size-3.5" />
          </Button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {role ? (
          <>
            <h3 className="text-base font-bold text-t1">دسترسی‌های «{role.name}»</h3>
            <p className="mt-1 text-xs text-t4">
              ماسک فعلی:{" "}
              <span className="tnum" dir="ltr">
                {role.permissions}
              </span>
            </p>
            <div className="mt-4 grid gap-1.5 sm:grid-cols-2">
              {(Object.keys(PERMISSION_BITS) as (keyof typeof PERMISSION_BITS)[]).map((bit) => (
                <label
                  key={bit}
                  className="flex cursor-pointer items-center gap-2 rounded-[4px] px-2 py-1.5 text-sm text-t3 hover:bg-hover"
                >
                  <input
                    type="checkbox"
                    checked={(role.permissions & PERMISSION_BITS[bit]) !== 0}
                    onChange={() => void toggle(bit)}
                    className="size-4 shrink-0 appearance-none rounded-[3px] border-2 border-t4
                               checked:border-brand checked:bg-brand
                               checked:after:block checked:after:text-center checked:after:text-[11px]
                               checked:after:leading-[13px] checked:after:text-white checked:after:content-['✓']"
                  />
                  {PERMISSION_LABELS[bit]}
                </label>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-t4">نقشی انتخاب نشده.</p>
        )}
      </div>
    </section>
  );
}

function InvitesTab({
  canManage,
  onError,
}: {
  canManage: boolean;
  onError: (e: string | null) => void;
}) {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    void api
      .get<{ invites: Invite[] }>("/api/invites")
      .then((d) => setInvites(d.invites))
      .catch((err) => onError((err as Error).message));
  }, [canManage, onError]);

  if (!canManage) {
    return (
      <p className="rounded-lg bg-card p-5 text-sm text-t4">اجازه‌ی ساخت دعوت‌نامه را نداری.</p>
    );
  }

  async function create() {
    setBusy(true);
    try {
      const res = await api.post<{ invite: Invite }>("/api/invites", {
        maxUses: 10,
        expiresInHours: 168,
      });
      setInvites((xs) => [res.invite, ...xs]);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg bg-card p-5">
      <div className="flex items-center gap-3">
        <p className="text-sm text-t3">هر دعوت‌نامه تا ۱۰ عضو و ۷ روز اعتبار دارد.</p>
        <Button size="sm" className="ms-auto" loading={busy} onClick={() => void create()}>
          <Plus className="size-3.5" />
          دعوت‌نامه‌ی تازه
        </Button>
      </div>

      <ul className="mt-4 space-y-1.5">
        {invites.map((i) => (
          <li
            key={i.code}
            className="flex items-center gap-3 rounded-[4px] bg-deep px-3 py-2 text-sm"
          >
            <code dir="ltr" className="font-mono text-t1">
              {i.code}
            </code>
            <button
              className="text-xs text-link hover:underline"
              onClick={() => void navigator.clipboard.writeText(i.code)}
            >
              کپی
            </button>
            <span className="tnum ms-auto text-xs text-t4">
              {fa(i.uses)}/{i.maxUses ? fa(i.maxUses) : "∞"}
            </span>
          </li>
        ))}
        {invites.length === 0 && (
          <li className="py-3 text-center text-sm text-t4">دعوت‌نامه‌ای نیست.</li>
        )}
      </ul>
    </section>
  );
}

const PALETTE = [
  "#5865F2",
  "#EB459E",
  "#57F287",
  "#FEE75C",
  "#ED4245",
  "#3BA55D",
  "#FAA81A",
  "#9B59B6",
  "#1ABC9C",
  "#E67E22",
];

function ProfileTab() {
  const me = useApp((s) => s.me);
  const updateProfile = useApp((s) => s.updateProfile);
  const [displayName, setDisplayName] = useState(me?.displayName ?? "");
  const [bio, setBio] = useState(me?.bio ?? "");
  const [color, setColor] = useState(me?.avatarColor ?? PALETTE[0]!);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!avatar) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatar);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  const dirty =
    displayName !== (me?.displayName ?? "") ||
    bio !== (me?.bio ?? "") ||
    color !== (me?.avatarColor ?? "") ||
    Boolean(avatar);

  async function save() {
    setBusy(true);
    await updateProfile({ displayName, bio, avatarColor: color, avatar });
    setAvatar(null);
    setBusy(false);
  }

  return (
    <section className="rounded-lg bg-card p-5">
      <div className="flex flex-wrap items-start gap-6">
        <div className="text-center">
          <button
            onClick={() => fileRef.current?.click()}
            className="group relative grid size-20 place-items-center rounded-full"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="پیش‌نمایش" className="size-20 rounded-full object-cover" />
            ) : (
              <Avatar name={displayName || "کاربر"} color={color} url={me?.avatarUrl} size="xl" />
            )}
            <span className="absolute inset-0 grid place-items-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
              <Camera className="size-5 text-white" />
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => setAvatar(e.target.files?.[0] ?? null)}
          />
          <p className="mt-2 text-2xs text-t4">حداکثر ۴ مگابایت</p>
          {me?.avatarUrl && (
            <button
              onClick={() => void updateProfile({ avatar: null })}
              className="mt-1 flex items-center gap-1 text-2xs text-danger hover:underline"
            >
              <Trash2 className="size-3" />
              حذف آواتار
            </button>
          )}
        </div>

        <div className="min-w-[240px] flex-1 space-y-3">
          <Field
            label="نام نمایشی"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="نامی که دیگران می‌بینند"
          />
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-bold text-t3">درباره‌ی من</span>
            <textarea
              rows={3}
              maxLength={280}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="یک خط درباره‌ی خودت"
              className="w-full resize-none rounded-[4px] bg-deep px-3 py-2 text-base text-t2 outline-none focus:ring-1 focus:ring-brand"
            />
            <span className="tnum mt-1 block text-end text-2xs text-t5">
              {fa(280 - bio.length)}
            </span>
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-bold text-t3">رنگ آواتار</span>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((c) => (
                <motion.button
                  key={c}
                  whileHover={{ scale: 1.14 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setColor(c)}
                  style={{ background: c }}
                  className={cn(
                    "size-7 rounded-full transition-shadow",
                    color === c && "ring-2 ring-white ring-offset-2 ring-offset-card",
                  )}
                />
              ))}
            </div>
          </div>

          <Button loading={busy} disabled={!dirty} onClick={() => void save()}>
            ذخیره‌ی تغییرات
          </Button>
        </div>
      </div>
    </section>
  );
}

const ACTION_LABELS: Record<string, string> = {
  "channel.create": "ساخت کانال",
  "channel.update": "ویرایش کانال",
  "channel.delete": "حذف کانال",
  "message.delete": "حذف پیام",
  "message.edit": "ویرایش پیام",
  "role.create": "ساخت نقش",
  "role.update": "ویرایش نقش",
  "invite.create": "ساخت دعوت‌نامه",
  "user.login": "ورود کاربر",
  "user.register": "ثبت‌نام کاربر",
  "release.publish": "انتشار نسخه",
};

const stamp = new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" });

function AuditTab({
  canManage,
  onError,
}: {
  canManage: boolean;
  onError: (e: string | null) => void;
}) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    void api
      .get<{ entries: AuditEntry[] }>("/api/admin/audit")
      .then((d) => setEntries(d.entries))
      .catch((err) => onError((err as Error).message))
      .finally(() => setLoading(false));
  }, [canManage, onError]);

  if (!canManage) {
    return <p className="rounded-lg bg-card p-5 text-sm text-t4">دسترسی دیدن گزارش را نداری.</p>;
  }

  return (
    <section className="rounded-lg bg-card p-5">
      <p className="text-sm text-t3">آخرین کارهای مدیریتی روی سرور.</p>
      <ul className="mt-4 space-y-1">
        {loading && <li className="py-3 text-center text-sm text-t4">در حال بارگذاری…</li>}
        {entries.map((e, i) => (
          <motion.li
            key={e.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.015, 0.3) }}
            className="flex items-center gap-3 rounded-[5px] bg-deep px-3 py-2 text-sm"
          >
            <Badge tone="outline">{ACTION_LABELS[e.action] ?? e.action}</Badge>
            <span className="text-t2">{e.actorName}</span>
            {e.target && (
              <code dir="ltr" className="truncate text-2xs text-t5">
                {e.target}
              </code>
            )}
            <span className="tnum ms-auto shrink-0 text-2xs text-t4">
              {stamp.format(new Date(e.createdAt))}
            </span>
          </motion.li>
        ))}
        {!loading && entries.length === 0 && (
          <li className="py-3 text-center text-sm text-t4">هنوز رویدادی ثبت نشده.</li>
        )}
      </ul>
    </section>
  );
}
