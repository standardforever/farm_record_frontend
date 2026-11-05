import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-32 max-w-md px-4 text-center">
      <div className="eyebrow">404</div>
      <h1 className="mt-1 text-[28px] font-bold">This page does not exist</h1>
      <Link href="/app" className="mt-4 inline-block font-semibold text-brand">Go to my workspaces</Link>
    </div>
  );
}
