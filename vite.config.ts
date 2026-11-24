import { defineConfig, type Plugin } from 'vite'

/**
 * The privacy promise in one string: the page may only load from and connect to its own site, so a picture can't
 * be sent anywhere. 'wasm-unsafe-eval' lets the AI model's WebAssembly run.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

// Hot reload needs inline scripts and websockets, so the CSP goes in only for builds.
const cspMeta = (): Plugin => ({
  name: 'crispwall-csp',
  apply: 'build',
  transformIndexHtml: (html) =>
    html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
    ),
})

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  worker: { format: 'es' },
  build: { assetsInlineLimit: 0, target: 'es2022' },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  plugins: [cspMeta()],
})
