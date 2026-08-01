import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
//
// ⚠️  NO HAY server.proxy para /api aquí.
//
// Con `vercel dev`, Vercel actúa como router y enruta /api/* a las funciones
// serverless antes de que Vite vea la petición. Si Vite tuviera un proxy a /api,
// capturaría las rutas y rompería el enrutamiento de Vercel.
//
// Flujo correcto con `vercel dev`:
//   Browser → Vercel Dev Router → /api/* → Función serverless (Node.js)
//                                → /*     → Vite Dev Server (React)
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // server.proxy intencionalmente ausente
})
