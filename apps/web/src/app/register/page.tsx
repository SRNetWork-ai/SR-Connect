import { Suspense } from "react";
import { Aurora } from "@/components/ui/Aurora";
import { RegisterForm } from "@/components/register/RegisterForm";

export const metadata = { title: "ساخت حساب — SR-Connect" };

export default function RegisterPage() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-floating p-6">
      <Aurora />
      <Suspense>
        <RegisterForm />
      </Suspense>
    </main>
  );
}
