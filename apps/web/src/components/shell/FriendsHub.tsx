"use client";

import { motion } from "framer-motion";
import {
  Check,
  MessageCircle,
  Phone,
  Search,
  Send,
  UserPlus,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useApp, type Member } from "@/store/use-app";

type FriendFilter = "online" | "all";
interface Friendship {
  id: string;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing";
  user: Member;
}
interface DirectMessage {
  id: string;
  content: string;
  createdAt: string;
  author: Pick<Member, "id" | "username" | "displayName" | "avatarColor" | "avatarUrl">;
}

export function FriendsHub() {
  const me = useApp((s) => s.me);
  const presence = useApp((s) => s.presence);
  const pushToast = useApp((s) => s.pushToast);
  const [section, setSection] = useState<"friends" | "booster">("friends");
  const [filter, setFilter] = useState<FriendFilter>("online");
  const [query, setQuery] = useState("");
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [selected, setSelected] = useState<Friendship | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const loadFriends = useCallback(async () => {
    const data = await api.get<{ friendships: Friendship[] }>("/api/friends");
    setFriendships(data.friendships);
    setSelected((current) =>
      current
        ? (data.friendships.find((friendship) => friendship.id === current.id) ?? null)
        : current,
    );
  }, []);

  useEffect(() => {
    void loadFriends().catch((error) => pushToast((error as Error).message, "error"));
  }, [loadFriends, pushToast]);

  const loadMessages = useCallback(async () => {
    if (!selected || selected.status !== "accepted") return;
    const data = await api.get<{ messages: DirectMessage[] }>(
      `/api/dm/${selected.user.id}/messages`,
    );
    setMessages(data.messages);
  }, [selected]);

  useEffect(() => {
    setMessages([]);
    if (!selected || selected.status !== "accepted") return;
    void loadMessages();
    const timer = window.setInterval(() => void loadMessages(), 4_000);
    return () => window.clearInterval(timer);
  }, [loadMessages, selected]);

  const accepted = friendships.filter((friendship) => friendship.status === "accepted");
  const incoming = friendships.filter(
    (friendship) => friendship.status === "pending" && friendship.direction === "incoming",
  );
  const people = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fa");
    return accepted.filter(({ user }) => {
      if (filter === "online" && (presence[user.id] ?? user.status) === "offline") return false;
      return (
        !needle || `${user.displayName} ${user.username}`.toLocaleLowerCase("fa").includes(needle)
      );
    });
  }, [accepted, filter, presence, query]);

  async function addFriend(event: React.FormEvent) {
    event.preventDefault();
    if (!username.trim()) return;
    setBusy(true);
    try {
      await api.post("/api/friends", { username });
      setUsername("");
      setAddOpen(false);
      await loadFriends();
      pushToast("درخواست دوستی فرستاده شد", "success");
    } catch (error) {
      pushToast(error instanceof ApiError ? error.message : "ارسال درخواست ناموفق بود", "error");
    } finally {
      setBusy(false);
    }
  }

  async function respond(friendship: Friendship, accept: boolean) {
    try {
      if (accept) await api.patch(`/api/friends/${friendship.id}`, {});
      else await api.del(`/api/friends/${friendship.id}`);
      await loadFriends();
      pushToast(accept ? "درخواست دوستی پذیرفته شد" : "درخواست رد شد", "success");
    } catch (error) {
      pushToast((error as Error).message, "error");
    }
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !draft.trim() || busy) return;
    const content = draft.trim();
    setDraft("");
    setBusy(true);
    try {
      const data = await api.post<{ message: DirectMessage }>(
        `/api/dm/${selected.user.id}/messages`,
        { content },
      );
      setMessages((current) => [...current, data.message]);
    } catch (error) {
      setDraft(content);
      pushToast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

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
            <Users className="me-1 inline size-4" /> فرندز
          </button>
          <button
            onClick={() => setSection("booster")}
            className="rounded-md bg-card px-3 py-2 text-sm font-bold text-t3 hover:bg-hover"
          >
            <Zap className="me-1 inline size-4" /> بوستر
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

        {addOpen ? (
          <form onSubmit={addFriend} className="mt-2 flex gap-1.5">
            <input
              autoFocus
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="نام کاربری"
              dir="ltr"
              className="h-9 min-w-0 flex-1 rounded-md bg-deep px-2 text-sm text-t2 outline-none focus:ring-1 focus:ring-brand"
            />
            <button
              disabled={busy}
              className="grid size-9 place-items-center rounded-md bg-brand text-white disabled:opacity-50"
            >
              <Send className="size-4" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => setAddOpen(true)}
            className="mt-2 flex items-center justify-center gap-2 rounded-md border border-dashed border-brand/70 px-3 py-2 text-sm font-bold text-brand hover:bg-brand-soft"
          >
            <UserPlus className="size-4" /> افزودن دوست
          </button>
        )}

        {incoming.length > 0 && (
          <>
            <p className="mt-4 px-1 text-xs font-bold text-warning">درخواست‌های دوستی</p>
            <div className="mt-1 space-y-1">
              {incoming.map((friendship) => (
                <div key={friendship.id} className="flex items-center gap-2 rounded-md bg-card p-2">
                  <Avatar
                    name={friendship.user.displayName}
                    color={friendship.user.avatarColor}
                    url={friendship.user.avatarUrl}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-t2">
                    {friendship.user.displayName}
                  </span>
                  <button
                    onClick={() => void respond(friendship, true)}
                    aria-label="پذیرفتن"
                    className="text-success"
                  >
                    <Check className="size-4" />
                  </button>
                  <button
                    onClick={() => void respond(friendship, false)}
                    aria-label="رد کردن"
                    className="text-danger"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="mt-5 px-1 text-xs font-bold text-t4">پیام‌های خصوصی</p>
        <div className="scroll-y mt-2 space-y-1">
          {people.map((friendship) => (
            <button
              key={friendship.id}
              onClick={() => setSelected(friendship)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-start hover:bg-hover",
                selected?.id === friendship.id && "bg-card",
              )}
            >
              <Avatar
                name={friendship.user.displayName}
                color={friendship.user.avatarColor}
                url={friendship.user.avatarUrl}
                size="md"
                presence={presence[friendship.user.id] ?? friendship.user.status}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-t2">
                  {friendship.user.displayName}
                </span>
                <span className="block truncate text-2xs text-t5" dir="ltr">
                  @{friendship.user.username}
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
                name={selected.user.displayName}
                color={selected.user.avatarColor}
                url={selected.user.avatarUrl}
                size="sm"
                presence={presence[selected.user.id] ?? selected.user.status}
              />
              <strong className="text-t1">{selected.user.displayName}</strong>
              <div className="ms-auto flex gap-1">
                <Action
                  label="تماس خصوصی"
                  onClick={() => pushToast("تماس خصوصی در مرحله‌ی بعد فعال می‌شود", "info")}
                >
                  <Phone className="size-4" />
                </Action>
                <Action
                  label="تماس تصویری"
                  onClick={() => pushToast("تماس تصویری در مرحله‌ی بعد فعال می‌شود", "info")}
                >
                  <Video className="size-4" />
                </Action>
              </div>
            </header>
            <div className="scroll-y flex-1 space-y-3 p-5">
              {messages.length === 0 && (
                <div className="grid h-full place-items-center text-center">
                  <div>
                    <Avatar
                      name={selected.user.displayName}
                      color={selected.user.avatarColor}
                      url={selected.user.avatarUrl}
                      size="xl"
                    />
                    <h2 className="mt-3 text-xl font-black text-t1">{selected.user.displayName}</h2>
                    <p className="mt-2 text-sm text-t4">اولین پیام خصوصی را بفرست.</p>
                  </div>
                </div>
              )}
              {messages.map((message) => {
                const mine = message.author.id === me?.id;
                return (
                  <div
                    key={message.id}
                    className={cn("flex", mine ? "justify-start" : "justify-end")}
                  >
                    <div
                      className={cn(
                        "max-w-[72%] rounded-xl px-3 py-2 text-sm",
                        mine ? "bg-brand text-white" : "bg-card text-t2",
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>
                      <time className="mt-1 block text-[9px] opacity-60">
                        {new Date(message.createdAt).toLocaleTimeString("fa-IR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                  </div>
                );
              })}
            </div>
            <form
              onSubmit={sendMessage}
              className="m-4 flex h-11 items-center rounded-lg bg-card px-3"
            >
              <MessageCircle className="me-2 size-4 text-t5" />
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`پیام به ${selected.user.displayName}`}
                className="min-w-0 flex-1 bg-transparent text-sm text-t2 outline-none placeholder:text-t5"
              />
              <button
                disabled={!draft.trim() || busy}
                className="grid size-8 place-items-center text-brand disabled:text-t5"
                aria-label="ارسال پیام"
              >
                <Send className="size-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <Users className="mx-auto size-14 text-t5" />
              <h1 className="mt-4 text-xl font-black text-t1">دوستان</h1>
              <p className="mt-2 text-sm text-t4">یک دوست را برای شروع دایرکت انتخاب کن.</p>
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
