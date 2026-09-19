import { Suspense } from "react";
import { Aurora } from "@/components/ui/Aurora";
import { LoginForm } from "@/components/login/LoginForm";

export const metadata = { title: "ورود" };

export default function LoginPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-floating p-6">
      <Aurora />
      {/* useSearchParams برای ?next= — پس باید در Suspense باشد */}
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
