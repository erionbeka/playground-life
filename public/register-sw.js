// Registers the service worker.
//
// This lives in its own file instead of an inline script in index.html so
// the app can send a Content-Security-Policy that allows scripts from its own
// origin only. An inline script is what that policy blocks.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/sw.js").catch(function () {});
  });
}
