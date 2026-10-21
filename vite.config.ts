import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// The app is a single-page app, so these routes have no real file. Nginx is
// expected to fall back to index.html, but the production host has served a 404
// there, and _redirects only works on Netlify/Cloudflare Pages. Emitting a real
// copy of the shell at these paths makes the links work no matter how the
// server is configured. `reset` and `accept-invite` are the targets of emailed
// links, so a 404 there would break password reset and staff invitations.
const spaFallbackRoutes = ["terms", "reset", "accept-invite"];

const spaFallback = () => ({
  name: "spa-fallback-routes",
  apply: "build",
  closeBundle() {
    const outDir = path.resolve(__dirname, "dist");
    const shell = path.join(outDir, "index.html");
    if (!fs.existsSync(shell)) return;
    const html = fs.readFileSync(shell, "utf-8");
    for (const route of spaFallbackRoutes) {
      const dir = path.join(outDir, route);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "index.html"), html);
    }
  },
});

// React picks its dev/prod runtime, and Vite picks esbuild's jsxDEV vs jsx, from
// process.env.NODE_ENV at startup. This repo keeps NODE_ENV=development in .env
// for the API server. Vite does not populate process.env from the env file
// while it evaluates this file, so the guard below reads NODE_ENV out of the
// env file with `loadEnv` instead. A production build used to emit `jsxDEV`
// calls against the production React runtime (crashing on load) and ship the
// React development runtime. Vite reads NODE_ENV as it starts, so it must be
// corrected in the npm script, not here. See the "build" script. This guard
// fails loudly if that ever regresses.

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const production = mode !== "development";

  // Vite does not put `.env` values into `process.env` while it evaluates this
  // file, so the dev proxy target has to be read out of the env file directly.
  // An empty prefix loads every variable, not only the `VITE_`-prefixed ones,
  // which matches how this repo configures everything else.
  const env = loadEnv(mode, process.cwd(), "");

  // A real shell variable wins over the env file. `npm run build` pins
  // NODE_ENV=production in the shell; `npm run dev` relies on `.env`.
  const nodeEnv = process.env.NODE_ENV || env.NODE_ENV;
  const buildMode = process.env.VITE_BUILD_MODE || env.VITE_BUILD_MODE;

  // React picks its dev/prod runtime from NODE_ENV, and Vite picks esbuild's
  // jsxDEV vs jsx from the same value, so a production build that compiles
  // against the dev runtime crashes on load. The dev server never needs this
  // guard. VITE_BUILD_MODE=development opts out for a production-mode build
  // that should still use the development runtime.
  if (production && buildMode !== "development" && nodeEnv !== "production") {
    throw new Error(
      "NODE_ENV must be 'production' for a production build (it is set from .env). "
        + "Run `npm run build`, which pins it, or set NODE_ENV=production explicitly.",
    );
  }

  return {
    define: {
      "process.env.NODE_ENV": JSON.stringify(production ? "production" : "development"),
    },
    build: {
      chunkSizeWarningLimit: 650,
      modulePreload: {
        // The homepage is where every visitor lands. These chunks are only
        // reachable from the therapist report and insight screens, but Vite
        // hoists them into the landing page's modulepreload list, charging
        // ~980 KB of PDF generation and charting to visitors who never open a
        // report. They still download on demand when their route opens.
        resolveDependencies: (_filename, deps) =>
          deps.filter((dep) => !/(^|\/)(pdf|charts)-[\w-]+\.js$/.test(dep)),
      },
      rollupOptions: {
        output: {
          // Only vendor code is grouped here. Never add app source: a manual
          // chunk becomes the sole owner of whatever it contains, so putting a
          // shared component in `pdf` or `charts` would make the entry bundle
          // import those 400-580 KB chunks just to reach a shared helper.
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            ui: [
              "@radix-ui/react-accordion",
              "@radix-ui/react-alert-dialog",
              "@radix-ui/react-avatar",
              "@radix-ui/react-checkbox",
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-label",
              "@radix-ui/react-popover",
              "@radix-ui/react-progress",
              "@radix-ui/react-radio-group",
              "@radix-ui/react-scroll-area",
              "@radix-ui/react-select",
              "@radix-ui/react-separator",
              "@radix-ui/react-slider",
              "@radix-ui/react-slot",
              "@radix-ui/react-switch",
              "@radix-ui/react-tabs",
              "@radix-ui/react-toast",
              "@radix-ui/react-toggle",
              "@radix-ui/react-toggle-group",
              "@radix-ui/react-tooltip",
            ],
          },
        },
      },
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      // The frontend calls `/api/...` on its own origin so the session cookie
      // is first-party. In dev there is no nginx in front, so Vite proxies
      // those calls to the API process.
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET || "http://localhost:4000",
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), !production && componentTagger(), production && spaFallback()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
