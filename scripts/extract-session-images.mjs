/**
 * One-off: scan the current session jsonl for inline image attachments and
 * dump them to disk so a chat-attached image can be wired into the project.
 *
 * Each user message can contain content blocks like:
 *   { type: "image", source: { type: "base64", media_type: "image/png", data: "<base64>" } }
 *
 *   node scripts/extract-session-images.mjs <session.jsonl> <output-dir>
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const [, , sessionPath, outDir] = process.argv;
if (!sessionPath || !outDir) {
  console.error("usage: node extract-session-images.mjs <session.jsonl> <out-dir>");
  process.exit(1);
}

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const lines = readFileSync(sessionPath, "utf8").split("\n").filter(Boolean);

let idx = 0;
for (const line of lines) {
  let entry;
  try { entry = JSON.parse(line); } catch { continue; }
  const msg = entry.message ?? entry;
  const content = msg?.content;
  if (!Array.isArray(content)) continue;
  for (const block of content) {
    if (block?.type === "image" && block.source?.type === "base64") {
      const media = block.source.media_type || "image/png";
      const ext = media.split("/")[1] || "bin";
      const data = block.source.data;
      if (!data) continue;
      idx += 1;
      const ts = entry.timestamp ? entry.timestamp.replace(/[:.]/g, "-") : "no-ts";
      const fname = `img-${String(idx).padStart(2, "0")}-${ts}.${ext}`;
      const path = join(outDir, fname);
      writeFileSync(path, Buffer.from(data, "base64"));
      const sizeKb = (Buffer.from(data, "base64").length / 1024).toFixed(1);
      console.log(`[${idx}] ${ext}  ${sizeKb} KB  ${fname}`);
    }
  }
}

console.log(`[done] ${idx} images extracted to ${outDir}`);
