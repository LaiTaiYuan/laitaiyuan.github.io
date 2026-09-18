import { readFile, rename, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);
const snapshotUrl = new URL("src/data/toolboxReleases.json", root);

export function selectStableRelease(releases, prefix) {
  if (!Array.isArray(releases)) throw new Error("Invalid release response");
  const versionParts = (release) =>
    release.tag_name.slice(prefix.length).split(".").map(Number);
  return releases
    .filter(
      (release) =>
        !release.draft &&
        !release.prerelease &&
        typeof release.tag_name === "string" &&
        release.tag_name.startsWith(prefix) &&
        /^\d+\.\d+\.\d+$/.test(release.tag_name.slice(prefix.length)) &&
        Number.isFinite(Date.parse(release.published_at)),
    )
    .sort((a, b) => {
      const left = versionParts(a);
      const right = versionParts(b);
      return (
        right[0] - left[0] ||
        right[1] - left[1] ||
        right[2] - left[2] ||
        Date.parse(b.published_at) - Date.parse(a.published_at)
      );
    })[0];
}

export function extractHighlights(body = "") {
  return body
    .replace(/```[\s\S]*?```/g, "")
    .split(/\r?\n/)
    .filter((line) => /^\s*[-*]\s+/.test(line))
    .map((line) =>
      line
        .replace(/^\s*[-*]\s+/, "")
        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/^.*?Thanks .+?!\s*-\s*/, "")
        .replace(/\s+by @[^\s]+.*$/i, "")
        .replace(/https?:\/\/\S+/g, "")
        .replace(/<[^>]*>/g, "")
        .replace(/[`*_]/g, "")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean)
    .slice(0, 3)
    .map((line) => (line.length > 220 ? `${line.slice(0, 217)}…` : line));
}

async function fetchRelease(tool, fetchImpl, token) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "leonard-toolbox",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  // Monorepos can publish many CLI/beta releases between stable core releases.
  for (let page = 1; page <= 3; page += 1) {
    const response = await fetchImpl(
      `https://api.github.com/repos/${tool.repository}/releases?per_page=100&page=${page}`,
      {
        headers,
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok)
      throw new Error(`GitHub returned HTTP ${response.status}`);
    const releases = await response.json();
    const release = selectStableRelease(releases, tool.releaseTagPrefix);
    if (release) {
      const expectedUrl = `https://github.com/${tool.repository}/releases/tag/`;
      if (
        typeof release.html_url !== "string" ||
        !release.html_url.startsWith(expectedUrl)
      ) {
        throw new Error("Unexpected release URL");
      }
      return release;
    }
    if (releases.length < 100) break;
  }
  throw new Error("No stable release found");
}

export async function syncToolbox({
  catalog,
  notes = {},
  previous = {},
  fetchImpl = fetch,
  token,
  now = new Date().toISOString(),
}) {
  const entries = await Promise.all(
    catalog.map(async (tool) => {
      try {
        const release = await fetchRelease(tool, fetchImpl, token);
        const curated = notes[tool.id]?.[release.tag_name];
        const highlights = curated ?? extractHighlights(release.body ?? "");
        return [
          tool.id,
          {
            version: release.tag_name.slice(tool.releaseTagPrefix.length),
            tag: release.tag_name,
            publishedAt: release.published_at,
            releaseUrl: release.html_url,
            highlights,
            summaryLanguage: curated
              ? "zh-Hant"
              : highlights.length
                ? "en"
                : "none",
            checkedAt: now,
            lastAttemptAt: now,
            status: "ok",
          },
        ];
      } catch (error) {
        console.error(`[toolbox] ${tool.id}: ${error.message}`);
        // Never stamp a failed request as a successful check or discard known data.
        return [
          tool.id,
          {
            ...(previous.tools?.[tool.id] ?? {
              version: null,
              tag: null,
              publishedAt: null,
              releaseUrl: `https://github.com/${tool.repository}/releases`,
              highlights: [],
              summaryLanguage: "none",
              checkedAt: null,
            }),
            lastAttemptAt: now,
            status: "error",
          },
        ];
      }
    }),
  );
  return { generatedAt: now, tools: Object.fromEntries(entries) };
}

async function main() {
  const readJson = async (url) => JSON.parse(await readFile(url, "utf8"));
  const [catalog, notes, previous] = await Promise.all([
    readJson(new URL("src/data/toolbox.json", root)),
    readJson(new URL("src/data/toolboxReleaseNotes.json", root)),
    readJson(snapshotUrl).catch((error) => {
      if (error.code === "ENOENT") return {};
      throw error;
    }),
  ]);
  const result = await syncToolbox({
    catalog,
    notes,
    previous,
    token: process.env.GITHUB_TOKEN,
  });
  const failures = Object.values(result.tools).filter(
    (tool) => tool.status === "error",
  );
  if (failures.length && process.argv.includes("--strict")) {
    throw new Error(
      `${failures.length} source(s) failed; keeping the previous snapshot and deployment.`,
    );
  }
  const temporaryUrl = pathToFileURL(`${fileURLToPath(snapshotUrl)}.tmp`);
  await writeFile(temporaryUrl, `${JSON.stringify(result, null, 2)}\n`);
  await rename(temporaryUrl, snapshotUrl);
  for (const [id, tool] of Object.entries(result.tools)) {
    console.log(
      `[toolbox] ${id}: ${tool.version ?? "unavailable"} (${tool.status})`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
