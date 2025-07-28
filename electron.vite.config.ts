import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import angular from '@analogjs/vite-plugin-angular'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.ts')
        },
        watch: {
          include: 'electron/main/**'
        }
      }
    },
    plugins: [
      externalizeDepsPlugin()
    ]
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload.ts')
        },
        watch: {
          include: 'electron/preload/**'
        }
      }
    },
    plugins: [
      externalizeDepsPlugin()
    ]
  },
  renderer: {
    root: '.',
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html')
        }
      }
    },
    resolve: {
      mainFields: ['module'],
      alias: {
        'sailpoint-components': resolve(__dirname, 'libs/sailpoint-components/index.ts')
      }
    },
    plugins: [
      angular()
    ]
  }
})
