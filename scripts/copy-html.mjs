import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'dist', 'index.html');
const dest = join(root, 'gas', 'Index.html');

async function main() {
  try {
    const info = await stat(src);
    if (!info.isFile()) throw new Error('bukan file');
  } catch {
    console.error(`[copy-html] ${src} tidak ditemukan. Jalankan "vite build" lebih dulu.`);
    process.exit(1);
  }

  await mkdir(dirname(dest), { recursive: true });

  await copyFile(src, dest);

  const { readFile } = await import('node:fs/promises');
  const html = await readFile(dest, 'utf8');
  if (/<script[^>]+src="\/assets\//.test(html) || /<link[^>]+href="\/assets\//.test(html)) {
    console.error('[copy-html] Peringatan: Index.html masih mereferensikan /assets/. Pastikan vite-plugin-singlefile terpasang.');
    process.exit(1);
  }

  console.log(`[copy-html] ${src} -> ${dest}`);
}

main().catch((err) => {
  console.error('[copy-html] Gagal:', err);
  process.exit(1);
});