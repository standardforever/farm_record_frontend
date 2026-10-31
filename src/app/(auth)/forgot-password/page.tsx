import { Suspense } from "react";
import { EmailCodeForm } from "@/features/auth/codes";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h2 className="font-display text-[30px] font-bold">Reset your password</h2>
      <p className="mb-7 mt-1.5 text-ink-2">We email you a code, then you choose a new password. Other devices are signed out.</p>
      <Suspense><EmailCodeForm flow="reset" /></Suspense>
    </>
  );
}
