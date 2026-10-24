import { createRoot } from "react-dom/client";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");
const splash = document.getElementById("app-splash");
const frame = splash?.querySelector("iframe");

if (!rootElement) {
  throw new Error("Playground Life root element was not found.");
}

createRoot(rootElement).render(<App />);

const isNative = Capacitor.isNativePlatform();
let appReady = false;
let frameReady = !frame;
let nativeHidden = false;
let dismissed = false;
let readyTimer: number | undefined;

function dismissHtmlSplash() {
  if (dismissed || !splash) return;
  dismissed = true;

  splash.style.opacity = "0";
  splash.style.pointerEvents = "none";

  window.setTimeout(() => splash.remove(), 400);
}

function tryFinishStartup() {
  if (!appReady || !frameReady || nativeHidden) return;

  nativeHidden = true;

  if (isNative) {
    void SplashScreen.hide()
      .then(() => {
        readyTimer = window.setTimeout(dismissHtmlSplash, 900);
      })
      .catch((error) => {
        console.error("Could not hide native splash screen:", error);
        dismissHtmlSplash();
      });
  } else {
    readyTimer = window.setTimeout(dismissHtmlSplash, 900);
  }
}

if (frame) {
  frame.addEventListener("load", () => {
    frameReady = true;
    tryFinishStartup();
  }, { once: true });
}

const observer = new MutationObserver(() => {
  if (rootElement.textContent?.trim()) {
    appReady = true;
    observer.disconnect();
    tryFinishStartup();
  }
});

observer.observe(rootElement, {
  childList: true,
  subtree: true,
  characterData: true,
});

if (rootElement.textContent?.trim()) {
  appReady = true;
  observer.disconnect();
  tryFinishStartup();
}

// Safety fallback in case a component or external resource never finishes.
window.setTimeout(() => {
  if (dismissed) return;

  if (isNative && !nativeHidden) {
    nativeHidden = true;
    void SplashScreen.hide().finally(dismissHtmlSplash);
  } else {
    dismissHtmlSplash();
  }
}, 10000);
