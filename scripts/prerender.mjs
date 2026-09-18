import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
});
try {
  const { render, structuredData } = await server.ssrLoadModule(
    "/src/entry-server.tsx",
  );
  for (const [page, file] of [
    ["home", "index.html"],
    ["tools", "tools/index.html"],
  ]) {
    const path = resolve("dist", file);
    const html = await readFile(path, "utf8");
    const json = JSON.stringify(structuredData(page)).replace(/</g, "\\u003c");
    const rendered = html
      .replace('<div id="root"></div>', `<div id="root">${render(page)}</div>`)
      .replace(
        "<!-- structured-data -->",
        `<script type="application/ld+json">${json}</script>`,
      );
    await writeFile(path, rendered);
    console.log(`Prerendered /${page === "home" ? "" : "tools/"}`);
  }
} finally {
  await server.close();
}
