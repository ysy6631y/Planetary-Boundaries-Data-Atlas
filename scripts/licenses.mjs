import { readFile, writeFile, mkdir } from 'node:fs/promises';
const packages = [
  ['three', 'LICENSE'], ['lucide', 'LICENSE'], ['vite', 'LICENSE.md'],
  ['playwright', 'LICENSE'], ['pngjs', 'LICENSE'], ['@fontsource/ibm-plex-mono', 'LICENSE'],
];
await mkdir('public/licenses', { recursive: true });
for (const [name, filename] of packages) {
  const outputName = name.replace('@fontsource/', 'fontsource-');
  await writeFile(`public/licenses/${outputName}.txt`, await readFile(`node_modules/${name}/${filename}`));
}
console.log('Saved original dependency license notices in public/licenses/');
