import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// The app is a single-page app, so /terms has no real file. Nginx is expected to
// fall back to index.html, but the production host has served a 404 there, and
// _redirects only works on Netlify/Cloudflare Pages. Emitting a real copy of the
// shell at that path makes the link work no matter how the server is configured.
const spaFallbackRoutes = ["terms"];

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
// for the API server, and Vite loads that file before any config runs, so a
// production build used to emit `jsxDEV` calls against the production React
// runtime (crashing on load) and ship the React development runtime. Vite reads
// NODE_ENV as it starts, so it must be corrected in the npm script, not here.
// See the "build" script. This guard fails loudly if that ever regresses.
const isProd = process.env.VITE_BUILD_MODE !== "development";

if (isProd && process.env.NODE_ENV !== "production") {
  throw new Error(
    "NODE_ENV must be 'production' for a production build (it is set from .env). "
      + "Run `npm run build`, which pins it, or set NODE_ENV=production explicitly.",
  );
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const production = mode !== "development";

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
