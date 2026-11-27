/* Gera os arquivos locais distribuídos. A publicação usa os arquivos já gerados. */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('public/assets/vendor/nexus-ui', { recursive: true });
await build({
  entryPoints: ['src/ui/sidebar.tsx'],
  outfile: 'public/assets/vendor/nexus-ui/sidebar.js',
  bundle: true, format: 'esm', minify: true, target: 'es2020',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'linked',
});
execFileSync(process.execPath, ['node_modules/@tailwindcss/cli/dist/index.mjs',
  '-i', 'src/ui/styles.css', '-o', 'public/assets/vendor/nexus-ui/styles.css', '--minify'], { stdio: 'inherit' });
for (const [source, target] of [
  ['motion/dist/motion.js', 'motion/motion.js'],
  ['gsap/dist/gsap.min.js', 'gsap/gsap.min.js'],
  ['gsap/dist/ScrollTrigger.min.js', 'gsap/ScrollTrigger.min.js'],
  ['lenis/dist/lenis.min.js', 'lenis/lenis.min.js'],
]) {
  const directory = 'public/assets/vendor/' + target.split('/')[0];
  mkdirSync(directory, { recursive: true });
  copyFileSync('node_modules/' + source, 'public/assets/vendor/' + target);
}
console.log('Interface shadcn/ui e bibliotecas locais atualizadas.');
