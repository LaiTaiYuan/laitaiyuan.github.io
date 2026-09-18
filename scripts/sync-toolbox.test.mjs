import assert from "node:assert/strict";
import test from "node:test";
import {
  extractHighlights,
  selectStableRelease,
  syncToolbox,
} from "./sync-toolbox.mjs";

const tool = {
  id: "slides",
  repository: "example/slides",
  releaseTagPrefix: "@slides/core@",
};
const release = (tag, overrides = {}) => ({
  tag_name: tag,
  draft: false,
  prerelease: false,
  published_at: "2026-09-17T10:00:00Z",
  html_url: `https://github.com/example/slides/releases/tag/${encodeURIComponent(tag)}`,
  body: "- Fix navigation\n- Improve export",
  ...overrides,
});

test("selects the correct package's highest stable version, excluding draft and beta tags", () => {
  const releases = [
    release("@slides/core@3.0.0", { prerelease: true }),
    release("@slides/core@4.0.0-beta.1"),
    release("@slides/core@5.0.0", { draft: true }),
    release("@slides/cli@9.0.0"),
    release("@slides/core@1.9.0"),
    release("@slides/core@1.10.0"),
    release("@slides/core@1.11.0", { published_at: "invalid" }),
  ];
  assert.equal(
    selectStableRelease(releases, tool.releaseTagPrefix).tag_name,
    "@slides/core@1.10.0",
  );
});

test("extracts readable bounded release notes without code blocks, markup or attribution", () => {
  const body =
    "```sh\n- not a note\n```\n- [#12](https://github.com/pull/12) [`abc123`](https://github.com/commit/a) Thanks [@dev](https://github.com/dev)! - Fix **menus**.\n- [New export](https://example.org) by @dev in https://example.org/pull/1\n- <img src=x>Better preview\n- fourth note";
  assert.deepEqual(extractHighlights(body), [
    "Fix menus.",
    "New export",
    "Better preview",
  ]);
  assert.deepEqual(extractHighlights("## Release without notes"), []);
});

test("sync records official metadata and only uses a translation for the matching release", async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => [release("@slides/core@1.10.0")],
  });
  const result = await syncToolbox({
    catalog: [tool],
    fetchImpl,
    now: "2026-09-18T01:00:00Z",
    notes: { slides: { "@slides/core@1.9.0": ["過期翻譯"] } },
  });
  assert.equal(result.tools.slides.version, "1.10.0");
  assert.equal(result.tools.slides.summaryLanguage, "en");
  assert.deepEqual(result.tools.slides.highlights, [
    "Fix navigation",
    "Improve export",
  ]);
});

test("a source failure preserves the last known release and its original verification date", async () => {
  const previous = {
    tools: {
      slides: {
        version: "1.9.0",
        checkedAt: "2026-09-01T00:00:00Z",
        highlights: ["Known notes"],
      },
    },
  };
  const result = await syncToolbox({
    catalog: [tool],
    previous,
    now: "2026-09-18T01:00:00Z",
    fetchImpl: async () => ({ ok: false, status: 429 }),
  });
  assert.equal(result.tools.slides.version, "1.9.0");
  assert.equal(result.tools.slides.checkedAt, previous.tools.slides.checkedAt);
  assert.equal(result.tools.slides.status, "error");
  assert.deepEqual(result.tools.slides.highlights, ["Known notes"]);
});

test("a missing stable release or untrusted release URL cannot produce a verified version", async () => {
  for (const releases of [
    [],
    [release("@slides/core@1.0.0", { html_url: "javascript:alert(1)" })],
  ]) {
    const result = await syncToolbox({
      catalog: [tool],
      fetchImpl: async () => ({ ok: true, json: async () => releases }),
    });
    assert.equal(result.tools.slides.status, "error");
    assert.equal(result.tools.slides.version, null);
    assert.equal(result.tools.slides.checkedAt, null);
  }
});
