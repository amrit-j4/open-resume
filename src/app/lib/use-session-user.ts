"use client";
import { useEffect, useState } from "react";
import { API_URL } from "lib/site-config";

export interface SessionUser {
  name: string;
  email: string;
}

/**
 * The signed-in Job4online user, or null when nobody is signed in (or it can't be determined yet). The job board's refresh cookie is
 * shared with this app, so `POST /auth/refresh` yields an access token and `GET /auth/me` says who it is. Failures are silent: the
 * header just renders its signed-out state.
 */
export const useSessionUser = (): SessionUser | null => {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const refresh = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        if (!refresh.ok) return;
        const { accessToken } = (await refresh.json()) as { accessToken?: string };
        if (!accessToken) return;

        const me = await fetch(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        if (!me.ok) return;
        const data = (await me.json()) as { name?: string; email?: string };
        if (!cancelled && data.name) {
          setUser({ name: data.name, email: data.email ?? "" });
        }
      } catch {
        // Offline or blocked: stay in the signed-out state.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return user;
};

export const getInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("") || "U";
