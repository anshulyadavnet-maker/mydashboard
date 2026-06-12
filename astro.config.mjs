import { defineConfig, passthroughImageService } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import AstroPWA from '@vite-pwa/astro';

export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  integrations: [
    AstroPWA({
      mode: 'production',
      base: '/',
      scope: '/',
      includeAssets: ['favicon.svg'],
      registerType: 'autoUpdate',
      manifest: {
        name: 'Milk Hissab - Daily Tracker',
        short_name: 'Milk Hissab',
        description: 'Track daily milk delivery, expenses, notes, and passwords.',
        theme_color: '#00d4aa',
        background_color: '#0a0a0b',
        display: 'standalone',
        icons: [
          {
            src: 'favicon.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
          },
          {
            src: 'favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        navigateFallback: '/',
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,gif,webp,woff,woff2}'],
      },
      devOptions: {
        enabled: true,
        navigateFallbackAllowlist: [/^\//],
      },
    }),
  ],
  image: {
    service: passthroughImageService(),
  },
  vite: {
    ssr: {
      noExternal: ['bcryptjs'],
    },
  },
});
