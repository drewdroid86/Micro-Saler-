import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.VERCEL ? '/' : '/Micro-Saler-/',
  server: {
    port: 3000,
    host: true
  }
});
