import { ServerRail } from "@/components/shell/ServerRail";
import { ChannelSidebar } from "@/components/shell/ChannelSidebar";
import { UpdateBanner } from "@/components/shell/UpdateBanner";
import { AuthGate } from "@/components/shell/AuthGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="flex h-dvh overflow-hidden">
        <ServerRail />
        <ChannelSidebar />
        <main className="flex min-w-0 flex-1 flex-col bg-chat">
          <UpdateBanner />
          {children}
        </main>
      </div>
    </AuthGate>
  );
}
