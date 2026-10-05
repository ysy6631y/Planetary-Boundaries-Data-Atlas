import { readFile, writeFile, mkdir } from 'node:fs/promises';
const packages = [
  ['three', 'LICENSE'], ['lucide', 'LICENSE'], ['vite', 'LICENSE.md'],
  ['playwright', 'LICENSE'], ['pngjs', 'LICENSE'],
];
await mkdir('public/licenses', { recursive: true });
for (const [name, filename] of packages) {
  await writeFile(`public/licenses/${name}.txt`, await readFile(`node_modules/${name}/${filename}`));
}
console.log('Saved original dependency license notices in public/licenses/');
