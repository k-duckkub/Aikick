import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'superdev/assets/vendor');
const fonts = path.join(output, 'fonts');
await mkdir(path.join(fonts, 'files'), { recursive: true });
const entries = [
  ['kanit', '600.css'], ['kanit', '800.css'], ['kanit', '800-italic.css'],
  ['noto-sans-thai', '400.css'], ['noto-sans-thai', '600.css'], ['jersey-10', '400.css'],
];
const sheets = [];
for (const [family, filename] of entries) {
  const dir = path.join(root, 'node_modules/@fontsource', family);
  const css = await readFile(path.join(dir, filename), 'utf8');
  sheets.push(css);
  for (const match of css.matchAll(/url\(['"]?(\.\/files\/[^)'"\s]+)['"]?\)/g)) {
    await copyFile(path.join(dir, match[1]), path.join(fonts, match[1]));
  }
}
await writeFile(path.join(fonts, 'fonts.css'), sheets.join('\n'));
for (const family of new Set(entries.map(([family]) => family))) {
  await copyFile(path.join(root, 'node_modules/@fontsource', family, 'LICENSE'), path.join(fonts, `${family}-LICENSE.txt`));
}
await copyFile(path.join(root, 'node_modules/three/build/three.module.min.js'), path.join(output, 'three.module.min.js'));
await copyFile(path.join(root, 'node_modules/three/LICENSE'), path.join(output, 'three-LICENSE.txt'));
console.log('Original fonts and Three.js prepared locally.');
