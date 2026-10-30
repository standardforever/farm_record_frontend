import { Suspense } from "react";
import { LoginForm } from "@/features/auth/forms";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h2 className="font-display text-[30px] font-bold">Welcome back</h2>
      <p className="mb-7 mt-1.5 text-ink-2">Sign in with your phone number or email.</p>
      <Suspense><LoginForm /></Suspense>
    </>
  );
}
