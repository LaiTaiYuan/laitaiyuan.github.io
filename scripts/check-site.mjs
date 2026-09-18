import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

for (const route of ["index.html", "tools/index.html"]) {
  const html = await readFile(`dist/${route}`, "utf8");
  assert(
    !/noindex|http-equiv="refresh"/i.test(html),
    `${route} must be indexable`,
  );
  assert.match(html, /<h1\b/);
  assert.match(html, /rel="canonical"/);
  assert.match(html, /name="description"/);
  assert.match(html, /<main\b/);
  const json = html.match(
    /<script type="application\/ld\+json">(.*?)<\/script>/s,
  );
  assert(json, `${route} has structured data`);
  const graph = JSON.parse(json[1])["@graph"];
  assert(graph.some((item) => item["@type"] === "Person"));
  assert(html.length > 15000, `${route} contains real rendered content`);
}
const home = await readFile("dist/index.html", "utf8");
for (const content of [
  "賴泰元",
  "好理家在",
  "AWS Certified",
  "Aurora in July",
  "eGroupAI",
  "leonard-lion-studio.png",
  "leonard-it-matters-2025.jpg",
])
  assert(home.includes(content), `Homepage includes ${content}`);
const sitemap = await readFile("dist/sitemap.xml", "utf8");
assert(sitemap.includes("https://laitaiyuan.github.io/tools/"));
const files = await readdir("dist", { recursive: true });
const socialImage = await readFile("dist/og-image.png");
assert.equal(socialImage.readUInt32BE(16), 1200, "Share image width");
assert.equal(socialImage.readUInt32BE(20), 630, "Share image height");
assert(
  !files.some((file) =>
    /(^|[/\\])(monthly|asr|technology|research)([/\\]|$)/i.test(file),
  ),
  "Only public site assets are shipped",
);
console.log(
  "Static content, identity, metadata, sitemap and public asset checks passed.",
);
