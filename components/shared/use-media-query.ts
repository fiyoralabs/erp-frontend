"use client";

import * as React from "react";

// useSyncExternalStore, not useState+useEffect -- matchMedia is a genuine
// external store, and the effect-based version trips the "no setState
// synchronously in an effect body" lint rule. getServerSnapshot returns
// `false` so SSR/first paint always renders the desktop-first layout, then
// syncs to the real value on the client.
function subscribe(query: string, onChange: () => void) {
  const mql = window.matchMedia(query);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

export function useMediaQuery(query: string) {
  return React.useSyncExternalStore(
    (onChange) => subscribe(query, onChange),
    () => window.matchMedia(query).matches,
    () => false
  );
}

export function useIsMobile() {
  return useMediaQuery("(max-width: 639px)");
}
