"use client";

import { Hash, Radio, Users, Volume2, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { fa } from "@/lib/fmt";
import { useApp } from "@/store/use-app";

const STATUS_DOT: Record<string, string> = {
  online: "bg-success",
  idle: "bg-warning",
  dnd: "bg-danger",
  offline: "bg-offline",
};

export function TopBar() {
  const channel = useApp((s) => s.channels.find((c) => c.id === s.activeChannelId));
  const socketStatus = useApp((s) => s.socketStatus);
  const members = useApp((s) => s.members);
  const presence = useApp((s) => s.presence);
  const [showMembers, setShowMembers] = useState(false);

  const Icon =
    !channel ? Hash : channel.type === "text" ? Hash : channel.type === "stage" ? Radio : Volume2;
  const online = members.filter((m) => (presence[m.id] ?? "offline") !== "offline").length;

  return (
    <>
      <header className="relative flex h-[50px] shrink-0 items-center gap-2.5 px-4 shadow-line">
        <Icon className="size-5 text-t4" />
        <h1 className="text-base font-bold text-t1">{channel?.name ?? "کانالی انتخاب نشده"}</h1>
        {channel?.topic && (
          <p className="ms-1 truncate border-s border-divider ps-2.5 text-sm text-t4">
            {channel.topic}
          </p>
        )}

        <div className="ms-auto flex items-center gap-1.5">
          <span
            title={socketStatus === "open" ? "اتصال زنده برقرار است" : "در حال اتصال مجدد"}
            className={cn(
              "flex items-center gap-1 rounded-pill px-2 py-0.5 text-2xs",
              socketStatus === "open"
                ? "bg-success-soft text-success"
                : "bg-warning-soft text-warning",
            )}
          >
            {socketStatus === "open" ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
            {socketStatus === "open" ? "زنده" : "اتصال مجدد…"}
          </span>
          <button
            onClick={() => setShowMembers((v) => !v)}
            className={cn(
              "flex h-8 items-center gap-1 rounded-[4px] px-2 text-t3 transition-colors hover:bg-hover hover:text-t1",
              showMembers && "bg-hover text-t1",
            )}
          >
            <Users className="size-4.5" />
            <span className="tnum text-xs">{fa(online)}</span>
          </button>
        </div>

        {showMembers && (
          <aside className="scroll-y absolute end-2 top-[50px] z-20 max-h-[60vh] w-[240px] rounded-b-lg bg-sidebar p-2 shadow-float">
            <p className="px-2 pb-1 text-2xs font-bold text-t4">
              اعضا — {fa(online)} آنلاین از {fa(members.length)}
            </p>
            {members.map((m) => {
              const status = presence[m.id] ?? "offline";
              return (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center gap-2 rounded-[4px] px-2 py-1 text-sm hover:bg-hover",
                    status === "offline" ? "text-t5 opacity-60" : "text-t2",
                  )}
                >
                  <span className="relative">
                    <span
                      className="grid size-7 place-items-center rounded-full text-2xs font-bold text-white"
                      style={{ background: m.avatarColor }}
                    >
                      {m.displayName[0]}
                    </span>
                    <span
                      className={cn(
                        "absolute -bottom-px -start-px size-2.5 rounded-full border-2 border-sidebar",
                        STATUS_DOT[status],
                      )}
                    />
                  </span>
                  <span className="truncate">{m.displayName}</span>
                </div>
              );
            })}
          </aside>
        )}
      </header>
    </>
  );
}
