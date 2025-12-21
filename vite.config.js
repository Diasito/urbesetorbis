import { defineConfig } from 'vite'

export default defineConfig({
  base: '/',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    assetsDir: 'assets',
    copyPublicDir: false, // ВАЖНО: не копируем public автоматически
    rollupOptions: {
      input: './index.html',
      output: {
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.')
          const ext = info[info.length - 1]
          // Файлы которые должны быть без хэша
          if (['ico', 'webmanifest', 'txt', 'xml', 'woff2'].includes(ext)) {
            return '[name][extname]'
          }
          // Всё остальное в assets с хэшем
          return 'assets/[name]-[hash][extname]'
        }
      }
    }
  },
  server: {
    port: 5173
  }
})