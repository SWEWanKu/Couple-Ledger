"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function RouteWarmup() {
  const router = useRouter();

  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    [
      "/dashboard",
      "/records",
      "/imports",
      `/settlement?month=${month}`,
      `/reports/monthly?month=${month}`
    ].forEach((href) => router.prefetch(href));
  }, [router]);

  return null;
}
