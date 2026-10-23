import { createRoot } from "react-dom/client";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if (Capacitor.isNativePlatform()) {
  void SplashScreen.hide();
}
