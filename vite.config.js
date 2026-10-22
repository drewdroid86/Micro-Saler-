import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function swAutoVersionPlugin() {
  return {
    name: 'sw-auto-version-plugin',
    apply: 'build',
    closeBundle() {
      const distDir = path.resolve(process.cwd(), 'dist');
      const swPath = path.join(distDir, 'sw.js');
      if (!fs.existsSync(swPath)) return;

      const assetsDir = path.join(distDir, 'assets');
      const builtAssets = [
        './',
        './index.html',
        './manifest.json',
        './icon-192.png',
        './icon-512.png'
      ];

      if (fs.existsSync(assetsDir)) {
        const files = fs.readdirSync(assetsDir).sort();
        for (const file of files) {
          if (file.endsWith('.js') || file.endsWith('.css')) {
            builtAssets.push(`./assets/${file}`);
          }
        }
      }

      const pkgPath = path.resolve(process.cwd(), 'package.json');
      const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : { version: '1.7.0' };
      const hash = crypto.createHash('sha256').update(builtAssets.join('|') + '|' + pkg.version).digest('hex').slice(0, 8);
      const cacheName = `microsaler-v${pkg.version}-${hash}`;

      let swContent = fs.readFileSync(swPath, 'utf8');
      swContent = swContent.replace(
        /const CACHE_NAME = ['"][^'"]+['"];/,
        `const CACHE_NAME = '${cacheName}';`
      );
      swContent = swContent.replace(
        /const ASSETS_TO_CACHE = \[[\s\S]*?\];/,
        `const ASSETS_TO_CACHE = ${JSON.stringify(builtAssets, null, 2)};`
      );
      fs.writeFileSync(swPath, swContent, 'utf8');
    }
  };
}

export default defineConfig({
  plugins: [react(), swAutoVersionPlugin()],
  base: process.env.VERCEL ? '/' : '/Micro-Saler-/',
  server: {
    port: 3000,
    host: true
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    }
  }
});
