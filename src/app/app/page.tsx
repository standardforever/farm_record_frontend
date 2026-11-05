"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageLoader } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { lastWorkspace } from "@/features/workspaces";

/** /app: opens the right place (sign-in, onboarding or the last workspace). The installed app starts here. */
export default function OpenApp() {
  const { status, me } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (status === "signed-out") router.replace("/login");
    if (status === "signed-in" && me) {
      const last = lastWorkspace();
      const pick = me.workspaces.find((w) => w.organization_id === last) ?? me.workspaces[0];
      router.replace(pick ? `/w/${pick.organization_id}` : "/onboarding");
    }
  }, [status, me, router]);
  return <PageLoader label="Opening Oko…" />;
}
