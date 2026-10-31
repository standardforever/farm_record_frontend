import { Suspense } from "react";
import { EmailCodeForm } from "@/features/auth/codes";

export const metadata = { title: "Sign in with a code" };

export default function LoginCodePage() {
  return (
    <>
      <h2 className="font-display text-[30px] font-bold">Sign in with a code</h2>
      <p className="mb-7 mt-1.5 text-ink-2">No password needed. We email you a 6-digit code.</p>
      <Suspense><EmailCodeForm flow="login" /></Suspense>
    </>
  );
}
