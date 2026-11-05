"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageLoader } from "@/components/ui";
import { useCurrentWorkspace } from "@/features/workspaces";

/** Links in report emails land here and open the right tab. */
export default function Page() {
  return <Suspense fallback={<PageLoader />}><Go /></Suspense>;
}

function Go() {
  const ws = useCurrentWorkspace();
  const params = useSearchParams();
  const router = useRouter();
  useEffect(() => { router.replace(`/w/${ws.orgId}/reports?tab=weekly&${params.toString()}`); }, [router, ws.orgId, params]);
  return <PageLoader />;
}
