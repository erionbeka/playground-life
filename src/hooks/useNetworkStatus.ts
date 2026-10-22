import { useEffect, useState } from "react";
import { Network } from "@capacitor/network";

export function useNetworkStatus() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Network.getStatus().then((s) => {
      if (!cancelled) setOnline(s.connected);
    }).catch(() => {});
    const handle = Network.addListener("networkStatusChange", (s) => {
      setOnline(s.connected);
    });
    return () => {
      cancelled = true;
      handle.then((h) => h.remove()).catch(() => {});
    };
  }, []);

  return online;
}
