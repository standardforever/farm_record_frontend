import { Suspense } from "react";
import { RegisterForm } from "@/features/auth/forms";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <>
      <h2 className="font-display text-[30px] font-bold">Create your account</h2>
      <p className="mb-7 mt-1.5 text-ink-2">Free for small farms. It takes a minute.</p>
      <Suspense><RegisterForm /></Suspense>
    </>
  );
}
