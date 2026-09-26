import { ShellViews } from "@/components/shell/ShellViews";

export const metadata = { title: "تنظیمات حساب" };

export default function SettingsPage() {
  return <ShellViews initial="accountSettings" />;
}
