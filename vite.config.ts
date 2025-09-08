import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { securityHeadersPlugin } from './utils/security-headers';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isDevelopment = mode === 'development';
    
    return {
      define: {
        'process.env.REACT_APP_SUPABASE_URL': JSON.stringify(env.REACT_APP_SUPABASE_URL),
        'process.env.REACT_APP_SUPABASE_ANON_KEY': JSON.stringify(env.REACT_APP_SUPABASE_ANON_KEY),
        'process.env.REACT_APP_STREAM_API_KEY': JSON.stringify(env.REACT_APP_STREAM_API_KEY),
        'process.env.NODE_ENV': JSON.stringify(env.NODE_ENV || mode)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        target: 'esnext',
        rollupOptions: {
          output: {
            manualChunks: {
              // Separate vendor chunks for better caching
              'react-vendor': ['react', 'react-dom', 'react-router-dom'],
              'stream-vendor': ['@stream-io/video-client', '@stream-io/video-react-sdk', 'stream-chat', 'stream-chat-react'],
              'ui-vendor': ['framer-motion', 'lucide-react', 'recharts'],
              'supabase-vendor': ['@supabase/supabase-js']
            }
          }
        },
        // Enable minification for production
        minify: true,
        // Enable source maps for debugging
        sourcemap: mode === 'development',
        // Optimize chunk size
        chunkSizeWarningLimit: 1000
      },
      // Enable code splitting
      optimizeDeps: {
        include: ['react', 'react-dom', '@supabase/supabase-js']
      },
      // Add security headers plugin (temporarily disabled for development)
      plugins: [
        // securityHeadersPlugin(isDevelopment) // Temporarily disabled
      ]
    };
});
