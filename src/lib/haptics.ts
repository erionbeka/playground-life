import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

export async function tapHaptic() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    /* ignore */
  }
}

export async function successHaptic() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Haptics.notification({ type: "SUCCESS" as never });
  } catch {
    /* ignore */
  }
}
