import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  // base: '/sugimarukun/', // ルートデプロイを標準とするため削除. デフォルトは'/'

  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});