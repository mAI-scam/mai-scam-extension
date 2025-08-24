import { defineConfig } from 'wxt';
import tailwindcss from "@tailwindcss/vite";
// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // @ts-ignore - Tailwind v4 plugin type compatibility with WXT
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  srcDir: 'src',
  manifest: {
    permissions: [
      'activeTab',
      'tabs',
      'scripting',
      'storage'
    ],
    host_permissions: [
      '*://mail.google.com/*',
      'http://*/*',
      'https://*/*'
    ],
    content_security_policy: {
      extension_pages: "script-src 'self'; object-src 'self'"
    }
  },
});
