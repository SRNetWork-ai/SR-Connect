import { ServerRail } from "@/components/shell/ServerRail";
import { ChannelSidebar } from "@/components/shell/ChannelSidebar";
import { ScreenShareView } from "@/components/shell/ScreenShareView";
import { UpdateBanner } from "@/components/shell/UpdateBanner";
import { AuthGate } from "@/components/shell/AuthGate";
import { Toasts } from "@/components/ui/Toasts";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <div className="flex h-dvh overflow-hidden">
        <ServerRail />
        <ChannelSidebar />
        <main className="flex min-w-0 flex-1 flex-col bg-chat">
          <UpdateBanner />
          <ScreenShareView />
          {children}
        </main>
      </div>
      <Toasts />
    </AuthGate>
  );
}
