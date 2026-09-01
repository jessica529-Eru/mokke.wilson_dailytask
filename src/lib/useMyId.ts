"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiClient";

type MeResponse = { member: { id: number } | null };

// The current room member's own id — every room subpage needed this via
// its own copy of the same MeResponse type + "/api/auth/me" fetch +
// setMyId call. It never changes mid-session (a login is a full page
// nav), so it doesn't need to ride along with each page's own
// reload-after-mutation cycle; fetching it once here is enough.
export function useMyId(): number | null {
  const [myId, setMyId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch<MeResponse>("/api/auth/me")
      .then((data) => {
        if (!cancelled) setMyId(data.member?.id ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return myId;
}
