import { ShellViews } from "@/components/shell/ShellViews";

export const metadata = { title: "تنظیمات سرور" };

export default function ServerSettingsPage() {
  return <ShellViews initial="serverSettings" />;
}
