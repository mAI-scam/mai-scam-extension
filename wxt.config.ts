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
});
