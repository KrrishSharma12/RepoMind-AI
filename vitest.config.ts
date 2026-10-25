import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      // "@/lib/x" means "src/lib/x", the same as in the app.
      { find: /^@\//, replacement: `${src}/` },
      // The real "server-only" package throws outside Next.js. Tests run on the server, so use an empty stand-in.
      { find: "server-only", replacement: fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
});
