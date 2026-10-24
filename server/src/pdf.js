// Lectura de PDFs del lado del servidor con poppler (pdftotext / pdftoppm), sin archivos temporales:
// el PDF entra por stdin. Si tiene texto, se manda como texto al modelo; si es un escaneo
// (poco o nada de texto) se rasterizan las primeras páginas a PNG para el modelo de visión.
import { spawn } from "node:child_process";

const MAX_TEXT_PAGES = 10;
const MAX_TEXT_CHARS = 12_000;
const MIN_TEXT_CHARS = 80; // menos que esto ⇒ lo tratamos como escaneo
const MAX_IMG_PAGES = 3;
const DPI = 110;
const TIMEOUT_MS = 20_000;
const MAX_OUT = 12 * 1024 * 1024;

function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["pipe", "pipe", "ignore"] });
    const chunks = [];
    let size = 0;
    const timer = setTimeout(() => p.kill("SIGKILL"), TIMEOUT_MS);
    p.stdout.on("data", (c) => {
      size += c.length;
      if (size > MAX_OUT) p.kill("SIGKILL");
      else chunks.push(c);
    });
    p.on("error", (e) => (clearTimeout(timer), reject(e)));
    p.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`${cmd} salió con código ${code}`));
    });
    p.stdin.on("error", () => {});
    p.stdin.end(input);
  });
}

async function pageCount(buf) {
  const info = (await run("pdfinfo", ["fd://0"], buf)).toString("latin1");
  return Number(/^Pages:\s+(\d+)/m.exec(info)?.[1] || 1);
}

// Devuelve { text, images: [dataUrl], pages }
export async function readPdf(buf) {
  const pages = await pageCount(buf).catch(() => 1);
  const raw = (await run("pdftotext", ["-q", "-layout", "-enc", "UTF-8", "-l", String(MAX_TEXT_PAGES), "fd://0", "-"], buf)).toString("utf8");
  const text = raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (text.replace(/\s/g, "").length >= MIN_TEXT_CHARS) return { text: text.slice(0, MAX_TEXT_CHARS), images: [], pages };
  const images = [];
  for (let i = 1; i <= Math.min(pages, MAX_IMG_PAGES); i++) {
    const png = await run("pdftoppm", ["-q", "-png", "-r", String(DPI), "-f", String(i), "-l", String(i), "-singlefile", "fd://0"], buf);
    images.push(`data:image/png;base64,${png.toString("base64")}`);
  }
  return { text: "", images, pages };
}
