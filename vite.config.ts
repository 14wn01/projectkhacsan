import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'


function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Casso / SePay không cho trình duyệt gọi thẳng (CORS). Dev/preview đi qua proxy này.
  server: {
    proxy: {
      '/api/casso': {
        target: 'https://oauth.casso.vn',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/casso/, ''),
      },
      '/api/sepay': {
        target: 'https://my.sepay.vn',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/sepay/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/api/casso': {
        target: 'https://oauth.casso.vn',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/casso/, ''),
      },
      '/api/sepay': {
        target: 'https://my.sepay.vn',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/sepay/, ''),
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
