"use client";

import { VoiceStatus } from "@/components/shell/VoiceStatus";
import { UserPanel } from "@/components/shell/UserPanel";

/**
 * پایین هر نوار کناری یکسان است: وضعیت صدا و پنل کاربر.
 * قبلاً فقط داخل نوار کانال‌ها بود، برای همین در نمای دایرکت ناپدید می‌شد.
 */
export function SidebarFooter() {
  return (
    <div className="mt-auto">
      <VoiceStatus />
      <UserPanel />
    </div>
  );
}
