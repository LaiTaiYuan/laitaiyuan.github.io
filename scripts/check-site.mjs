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
  const person = graph.find((item) => item["@type"] === "Person");
  assert(person, `${route} describes the person`);
  assert.equal(person.name, "賴泰元", `${route} keys the person on 賴泰元`);
  assert(person.alternateName.includes("Leonard Lai"));
  assert(html.length > 15000, `${route} contains real rendered content`);
  // The name people search for must lead the title and description, and
  // appear in the readable body copy, not only in metadata.
  const title = html.match(/<title>(.*?)<\/title>/)[1];
  const description = html.match(
    /<meta\s+name="description"\s+content="(.*?)"/s,
  )[1];
  assert(title.includes("賴泰元"), `${route} title names 賴泰元`);
  assert(
    description.startsWith("賴泰元"),
    `${route} description leads with 賴泰元`,
  );
  const body = html.slice(html.indexOf("<body"));
  assert(
    (body.match(/賴泰元/g) ?? []).length >= 3,
    `${route} body copy names 賴泰元`,
  );
}
const home = await readFile("dist/index.html", "utf8");
assert.match(home, /<title>賴泰元 /, "Homepage title leads with 賴泰元");
assert.match(
  home,
  /name="google-site-verification"/,
  "Homepage keeps the Search Console verification tag",
);
assert(
  (home.match(/賴泰元/g) ?? []).length >= 20,
  "Homepage names 賴泰元 throughout",
);
for (const content of [
  "賴泰元",
  "好理家在",
  "AWS Certified",
  "Aurora in July",
  "eGroupAI",
  "images/lion/base",
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
