import { createRoot } from "react-dom/client";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Smoothly fade out and remove the HTML splash overlay once React mounts
const splash = document.getElementById("app-splash");
if (splash) {
  splash.style.opacity = "0";
  setTimeout(() => splash.remove(), 400);
}

if (Capacitor.isNativePlatform()) {
  void SplashScreen.hide();
}
