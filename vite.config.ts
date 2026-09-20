import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/aeww/' : '/ai-estimating-work-weixin/',
  plugins: [vue()],
  server: { proxy: { '/ai-estimating-work-weixin/api': { target: 'http://127.0.0.1:8003', changeOrigin: true, rewrite: (path) => path.replace(/^\/ai-estimating-work-weixin\/api/, '') } } },
}));
