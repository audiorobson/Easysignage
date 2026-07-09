/**
 * Obtém URLs de HTML e imagem do Stitch e descarrega para docs/stitch-exports/<projectId>/
 * Uso: STITCH_API_KEY=... node scripts/fetch-stitch-screens.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

function loadEnvFile(relPath) {
  const p = path.join(ROOT, relPath);
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnvFile("apps/cms/.env.local");
loadEnvFile(".env");

function loadStitchKeyFromCursorMcp() {
  if (process.env.STITCH_API_KEY) return;
  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) return;
  const mcpPath = path.join(home, ".cursor", "mcp.json");
  if (!fs.existsSync(mcpPath)) return;
  try {
    const j = JSON.parse(fs.readFileSync(mcpPath, "utf8"));
    const k =
      j?.mcpServers?.stitch?.headers?.["X-Goog-Api-Key"] ||
      j?.mcpServers?.stitch?.env?.STITCH_API_KEY;
    if (k && typeof k === "string") process.env.STITCH_API_KEY = k.trim();
  } catch {
    /* ignore */
  }
}

loadStitchKeyFromCursorMcp();

const PROJECT_ID = "13461540223753831413";
const SCREENS = [
  { id: "adbb38af43934bbd983a7942371917e4", slug: "assets-library-refined" },
  { id: "4869540338590818283", slug: "image-png" },
];

async function main() {
  if (!process.env.STITCH_API_KEY) {
    console.error(
      "Defina STITCH_API_KEY (ex.: no .env ou apps/cms/.env.local) e volte a executar."
    );
    process.exit(1);
  }

  const { stitch } = await import("@google/stitch-sdk");
  const project = stitch.project(PROJECT_ID);
  const outDir = path.join(ROOT, "docs", "stitch-exports", PROJECT_ID);
  fs.mkdirSync(outDir, { recursive: true });

  async function download(url, dest) {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`GET failed -> ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
  }

  const manifest = [];

  for (const s of SCREENS) {
    const screen = await project.getScreen(s.id);
    const htmlUrl = (await screen.getHtml())?.trim() || "";
    const imageUrl = (await screen.getImage())?.trim() || "";

    const htmlPath = path.join(outDir, `${s.slug}.html`);
    const imgPath = path.join(outDir, `${s.slug}.png`);

    let htmlRel = null;
    if (htmlUrl) {
      await download(htmlUrl, htmlPath);
      htmlRel = path.relative(ROOT, htmlPath).replace(/\\/g, "/");
    }

    if (!imageUrl) {
      throw new Error(`Sem URL de imagem para o ecrã ${s.slug} (${s.id})`);
    }
    await download(imageUrl, imgPath);

    manifest.push({
      screenId: s.id,
      slug: s.slug,
      title: screen.data?.title,
      htmlFile: htmlRel,
      htmlAvailable: Boolean(htmlUrl),
      imageFile: path.relative(ROOT, imgPath).replace(/\\/g, "/"),
    });
  }

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify({ projectId: PROJECT_ID, screens: manifest }, null, 2),
    "utf8"
  );

  console.log("OK:", path.join(outDir, "manifest.json"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
