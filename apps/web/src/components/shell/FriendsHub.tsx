"use client";

import { motion } from "framer-motion";
import { MessageCircle, Phone, Search, UserPlus, Users, Video, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { useApp, type Member } from "@/store/use-app";

type FriendFilter = "online" | "all";

export function FriendsHub() {
  const members = useApp((s) => s.members);
  const me = useApp((s) => s.me);
  const presence = useApp((s) => s.presence);
  const pushToast = useApp((s) => s.pushToast);
  const [section, setSection] = useState<"friends" | "booster">("friends");
  const [filter, setFilter] = useState<FriendFilter>("online");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);

  const people = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fa");
    return members.filter((member) => {
      if (member.id === me?.id) return false;
      if (filter === "online" && (presence[member.id] ?? member.status) === "offline") return false;
      if (!needle) return true;
      return `${member.displayName} ${member.username}`.toLocaleLowerCase("fa").includes(needle);
    });
  }, [filter, me?.id, members, presence, query]);

  if (section === "booster") {
    return (
      <div className="grid flex-1 place-items-center p-8">
        <div className="max-w-md rounded-xl bg-card p-8 text-center">
          <Zap className="mx-auto size-12 text-accent" />
          <h1 className="mt-4 text-xl font-black text-t1">بوستر</h1>
          <span className="mt-3 inline-flex rounded-pill bg-accent/15 px-3 py-1 text-xs font-bold text-accent">
            COMING SOON
          </span>
          <button
            type="button"
            onClick={() => setSection("friends")}
            className="mt-6 block w-full rounded-md bg-brand px-4 py-2 text-sm font-bold text-white"
          >
            برگشت به دوستان
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-[280px] shrink-0 flex-col border-s border-divider bg-sidebar-deep p-3">
        <div className="grid grid-cols-2 gap-2">
          <button className="rounded-md bg-brand px-3 py-2 text-sm font-bold text-white">
            <Users className="me-1 inline size-4" />
            فرندز
          </button>
          <button
            onClick={() => setSection("booster")}
            className="rounded-md bg-card px-3 py-2 text-sm font-bold text-t3 hover:bg-hover"
          >
            <Zap className="me-1 inline size-4" />
            بوستر
          </button>
        </div>

        <label className="mt-4 flex h-9 items-center gap-2 rounded-md bg-deep px-3">
          <Search className="size-4 text-t5" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="جست‌وجو بین دوستان"
            className="w-full bg-transparent text-sm text-t2 outline-none placeholder:text-t5"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-md bg-deep p-1">
          {(["online", "all"] as const).map((id) => (
            <button
              key={id}
              onClick={() => setFilter(id)}
              className={cn(
                "rounded-[5px] px-2 py-1.5 text-xs font-bold",
                filter === id ? "bg-card text-t1" : "text-t4 hover:text-t2",
              )}
            >
              {id === "online" ? "آنلاین" : "همه"}
            </button>
          ))}
        </div>

        <button
          onClick={() => pushToast("ارسال درخواست دوستی در مرحله‌ی بعد به API متصل می‌شود", "info")}
          className="mt-2 flex items-center justify-center gap-2 rounded-md border border-dashed border-brand/70 px-3 py-2 text-sm font-bold text-brand hover:bg-brand-soft"
        >
          <UserPlus className="size-4" />
          افزودن دوست
        </button>

        <p className="mt-5 px-1 text-xs font-bold text-t4">پیام‌های خصوصی</p>
        <div className="scroll-y mt-2 space-y-1">
          {people.map((member) => (
            <button
              key={member.id}
              onClick={() => setSelected(member)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-start hover:bg-hover",
                selected?.id === member.id && "bg-card",
              )}
            >
              <Avatar
                name={member.displayName}
                color={member.avatarColor}
                url={member.avatarUrl}
                size="md"
                presence={presence[member.id] ?? member.status}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-t2">
                  {member.displayName}
                </span>
                <span className="block truncate text-2xs text-t5" dir="ltr">
                  @{member.username}
                </span>
              </span>
            </button>
          ))}
          {people.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-t5">دوستی با این فیلتر پیدا نشد.</p>
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <header className="flex h-[50px] items-center gap-3 border-b border-divider px-4">
              <Avatar
                name={selected.displayName}
                color={selected.avatarColor}
                url={selected.avatarUrl}
                size="sm"
                presence={presence[selected.id] ?? selected.status}
              />
              <strong className="text-t1">{selected.displayName}</strong>
              <div className="ms-auto flex gap-1">
                <Action
                  label="تماس خصوصی"
                  onClick={() =>
                    pushToast("تماس خصوصی پس از اتصال سرویس دایرکت فعال می‌شود", "info")
                  }
                >
                  <Phone className="size-4" />
                </Action>
                <Action
                  label="تماس تصویری"
                  onClick={() => pushToast("تماس تصویری به‌زودی فعال می‌شود", "info")}
                >
                  <Video className="size-4" />
                </Action>
              </div>
            </header>
            <div className="grid flex-1 place-items-center p-6 text-center">
              <div>
                <Avatar
                  name={selected.displayName}
                  color={selected.avatarColor}
                  url={selected.avatarUrl}
                  size="xl"
                />
                <h2 className="mt-3 text-xl font-black text-t1">{selected.displayName}</h2>
                <p className="mt-2 max-w-sm text-sm text-t4">
                  فضای دایرکت آماده است؛ ذخیره و ارسال پیام خصوصی در مهاجرت بعدی دیتابیس فعال
                  می‌شود.
                </p>
              </div>
            </div>
            <div className="m-4 flex h-11 items-center rounded-lg bg-card px-4 text-sm text-t5">
              <MessageCircle className="me-2 size-4" />
              پیام خصوصی هنوز به API متصل نشده است
            </div>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <Users className="mx-auto size-14 text-t5" />
              <h1 className="mt-4 text-xl font-black text-t1">دوستان</h1>
              <p className="mt-2 text-sm text-t4">یک نفر را برای دیدن دایرکت انتخاب کن.</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Action({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-md text-t3 hover:bg-hover hover:text-t1"
    >
      {children}
    </motion.button>
  );
}
