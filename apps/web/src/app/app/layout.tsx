import { AuthGate } from "@/components/shell/AuthGate";
import { AppChrome } from "@/components/shell/AppChrome";
import { CallOverlay } from "@/components/shell/CallOverlay";
import { UpdateWatcher } from "@/components/shell/UpdateWatcher";
import { WelcomeGate } from "@/components/shell/WelcomeGate";
import { Toasts } from "@/components/ui/Toasts";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppChrome>{children}</AppChrome>
      <CallOverlay />
      <WelcomeGate />
      <UpdateWatcher />
      <Toasts />
    </AuthGate>
  );
}
