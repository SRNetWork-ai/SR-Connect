"use client";

import { Hash, Link2, Plus, Shield, Users, Volume2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Category, Channel } from "@sr/protocol";
import { PERMISSION_BITS, PERMISSION_LABELS, has } from "@sr/protocol";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
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

type Tab = "channels" | "roles" | "invites";

export function SettingsPanel() {
  const me = useApp((s) => s.me);
  const channels = useApp((s) => s.channels);
  const categories = useApp((s) => s.categories);
  const refreshChannels = useApp((s) => s.refreshChannels);
  const [tab, setTab] = useState<Tab>("channels");
  const [error, setError] = useState<string | null>(null);

  const canManageChannels = me ? me.isAdmin || has(me.permissions, "MANAGE_CHANNELS") : false;
  const canManageRoles = me ? me.isAdmin || has(me.permissions, "MANAGE_ROLES") : false;
  const canInvite = me ? me.isAdmin || has(me.permissions, "CREATE_INVITE") : false;

  const onError = useCallback((e: string | null) => setError(e), []);

  return (
    <div className="scroll-y flex-1 p-6">
      <div className="mx-auto max-w-[820px] space-y-5">
        <header className="flex items-center gap-3">
          <Shield className="size-6 text-brand" />
          <div>
            <h1 className="text-xl font-bold text-t1">تنظیمات سرور</h1>
            <p className="text-sm text-t4">کانال‌ها، نقش‌ها و دعوت‌نامه‌ها</p>
          </div>
        </header>

        <nav className="flex gap-1.5">
          {(
            [
              ["channels", "کانال‌ها", Hash],
              ["roles", "نقش‌ها و دسترسی", Users],
              ["invites", "دعوت‌نامه‌ها", Link2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-sm transition-colors",
                tab === id ? "bg-brand text-white" : "bg-card text-t3 hover:bg-hover",
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </nav>

        {error && (
          <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-[#ff8a8d]">{error}</p>
        )}

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
      </div>
    </div>
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
