import { resolve } from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import viteCompression from 'vite-plugin-compression';
import viteImagemin from 'vite-plugin-imagemin';
import autoprefixer from 'autoprefixer';
import mobileBackgrounds from './vite-plugin-mobile-backgrounds.js';

/**
 * VITE CONFIG С ПОДДЕРЖКОЙ GITHUB PAGES
 * 
 * Автоматически определяет base path:
 * - Development: '/'
 * - GitHub Pages: '/repo-name/'
 */

export default defineConfig(({ command, mode }) => {
  // Определяем base path:
  // - production: '/flipbook/' (GitHub Pages)
  // - capacitor: './' (локальные файлы в WebView)
  // - development: '/'
  const base = mode === 'capacitor' ? './' : mode === 'production' ? '/flipbook/' : '/';

  return {
    base,

    define: {
      // Флаг для условного импорта PWA в рантайме
      'import.meta.env.VITE_CAPACITOR': JSON.stringify(mode === 'capacitor'),
    },

    server: {
      port: 3000,
      open: true,
      host: true,
    },

    preview: {
      port: 4173,
      open: true,
    },

    css: {
      devSourcemap: true,
      postcss: {
        plugins: [
          autoprefixer({
            flexbox: 'no-2009',
            grid: 'autoplace',
          }),
        ],
      },
    },

    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: true,
      
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_debugger: true,
          // Удаляем только debug-логи, сохраняем error/warn для диагностики в production
          pure_funcs: ['console.log', 'console.debug', 'console.info'],
        },
        format: {
          comments: false,
        },
      },

      rollupOptions: {
        // В capacitor-режиме virtual:pwa-register недоступен (плагин отключён)
        ...(mode === 'capacitor' ? { external: ['virtual:pwa-register'] } : {}),
        input: {
          main: resolve(__dirname, 'index.html'),
          admin: resolve(__dirname, 'admin.html'),
        },
        output: {
          manualChunks: {
            'utils': [
              './js/utils/CSSVariables.js',
              './js/utils/MediaQueryManager.js',
              './js/utils/EventEmitter.js',
              './js/utils/EventListenerManager.js',
              './js/utils/TimerManager.js',
              './js/utils/LRUCache.js',
              './js/utils/TransitionHelper.js',
              './js/utils/HTMLSanitizer.js',
              './js/utils/ErrorHandler.js',
              './js/utils/StorageManager.js',
            ],
            'managers': [
              './js/managers/BookStateMachine.js',
              './js/managers/SettingsManager.js',
              './js/managers/BackgroundManager.js',
              './js/managers/ContentLoader.js',
              './js/managers/AsyncPaginator.js',
            ],
            'delegates': [
              './js/core/delegates/NavigationDelegate.js',
              './js/core/delegates/SettingsDelegate.js',
              './js/core/delegates/LifecycleDelegate.js',
              './js/core/delegates/ChapterDelegate.js',
              './js/core/delegates/DragDelegate.js',
              './js/core/delegates/DragDOMPreparer.js',
            ],
          },
          
          entryFileNames: 'assets/js/[name]-[hash].js',
          chunkFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            if (!assetInfo.name) {
              return 'assets/[name]-[hash][extname]';
            }
            
            const name = assetInfo.name;
            
            if (/\.(png|jpe?g|webp|svg|gif|tiff|bmp|ico)$/i.test(name)) {
              return 'assets/images/[name]-[hash][extname]';
            }
            
            if (/\.(woff2?|eot|ttf|otf)$/i.test(name)) {
              return 'assets/fonts/[name]-[hash][extname]';
            }
            
            if (/\.css$/i.test(name)) {
              return 'assets/css/[name]-[hash][extname]';
            }
            
            return 'assets/[name]-[hash][extname]';
          },
        },
      },

      chunkSizeWarningLimit: 600,
      cssCodeSplit: true,
      cssMinify: true,
      copyPublicDir: true,
    },

    plugins: [
      // Генерация мобильных фоновых изображений (960px)
      mobileBackgrounds(),

      // PWA поддержка (Service Worker + Manifest) — отключаем для Capacitor
      ...(mode !== 'capacitor' ? [VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.ico',
          'icons/*.png',
          'sounds/**/*.mp3',
        ],
        workbox: {
          // Предварительное кэширование статики
          globPatterns: [
            '**/*.{js,css,html,woff2}',
            'content/*.html',
          ],
          // Кэширование в рантайме для больших файлов
          runtimeCaching: [
            {
              urlPattern: /\.(?:png|jpg|jpeg|webp)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 60,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 дней
                },
              },
            },
            {
              urlPattern: /\.(?:mp3|wav|ogg)$/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'audio-cache',
                expiration: {
                  maxEntries: 15,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 дней
                },
              },
            },
          ],
        },
        manifest: {
          name: 'Flipbook — Интерактивная читалка',
          short_name: 'Flipbook',
          description: 'Электронная книга с реалистичной 3D анимацией перелистывания страниц',
          theme_color: '#1a1a2e',
          background_color: '#1a1a2e',
          display: 'standalone',
          orientation: 'any',
          start_url: '.',
          icons: [
            {
              src: 'icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'icons/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
      })] : []),

      // Gzip сжатие (не нужно для Capacitor — WebView не использует pre-compressed файлы)
      viteCompression({
        verbose: true,
        disable: mode === 'capacitor',
        threshold: 10240,
        algorithm: 'gzip',
        ext: '.gz',
        deleteOriginFile: false,
      }),

      // Brotli сжатие (не нужно для Capacitor)
      viteCompression({
        verbose: true,
        disable: mode === 'capacitor',
        threshold: 10240,
        algorithm: 'brotliCompress',
        ext: '.br',
        deleteOriginFile: false,
      }),

      // Оптимизация изображений
      viteImagemin({
        gifsicle: {
          optimizationLevel: 7,
          interlaced: false,
        },
        optipng: {
          optimizationLevel: 7,
        },
        mozjpeg: {
          quality: 85,
        },
        pngquant: {
          quality: [0.8, 0.9],
          speed: 4,
        },
        svgo: {
          plugins: [
            {
              name: 'removeViewBox',
              active: false,
            },
            {
              name: 'removeEmptyAttrs',
              active: true,
            },
          ],
        },
        webp: {
          quality: 85,
        },
      }),
    ],

    resolve: {
      alias: {
        '@': '/js',
        '@utils': '/js/utils',
        '@managers': '/js/managers',
        '@core': '/js/core',
        '@css': '/css',
        '@images': '/images',
        '@fonts': '/fonts',
      },
    },
  };
});