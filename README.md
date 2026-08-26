<div align="center">

# 🗺️ EvenGo — Smart Cultural Event Planner

**PWA interactiva con IA Conversacional, Streaming en tiempo real y Arquitectura de Alta Disponibilidad para la agenda cultural de Buenos Aires.**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Serverless-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless-000000?style=flat-square&logo=vercel)](https://vercel.com/)
[![Google Gemini](https://img.shields.io/badge/Gemini-Flash-4285F4?style=flat-square&logo=google)](https://ai.google.dev/)
[![Groq](https://img.shields.io/badge/Groq-llama--3.1-F55036?style=flat-square)](https://groq.com/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-4-06B6D4?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Vitest-67%20tests-6E9F18?style=flat-square&logo=vitest)](https://vitest.dev/)
[![PWA](https://img.shields.io/badge/PWA-Installable-5A0FC8?style=flat-square&logo=pwa)](https://web.dev/progressive-web-apps/)

</div>

---

> **EvenGo no es solo un CRUD de eventos.** Es un sistema completo con un agente autónomo con herramientas reales, streaming de respuestas, fallback automático entre proveedores de IA, y una capa de optimización FinOps que reduce el consumo de tokens entre un **60% y un 77%** por llamada. Todo deployado en edge con Vercel Serverless.

---

## ✨ Características Principales

| Área | Capacidad |
|---|---|
| 🤖 **IA Agentic** | Ciclo autónomo de tool-calling (hasta 5 hops) con Gemini + function declarations |
| 📡 **Streaming SSE** | Respuesta token a token vía Server-Sent Events — TTFB percibido < 100ms |
| 🔄 **Alta Disponibilidad** | Fallback automático Plan A → B → C sin intervención del usuario |
| 📅 **Calendario .ics** | Generación de invitaciones descargables con la librería `ics` |
| 🌦️ **Clima real** | Pronóstico de Open-Meteo con traducción semántica del WMO weathercode |
| 🏙️ **Datos live** | Integración con la API interna del portal cultural GCBA (linda.buenosaires.gob.ar) |
| 💾 **Persistencia** | Favoritos en `localStorage` con sincronización vía `CustomEvent` entre componentes |
| 📱 **PWA Instalable** | Manifest + Service Worker (Workbox) — funciona offline con datos en caché |
| 🔍 **Filtros en tiempo real** | Búsqueda, categoría, barrio y precio sin petición de red adicional |
| 💡 **FinOps** | `trimForLLM()` separa el payload del frontend del payload del modelo |

---

## 🏗️ Arquitectura del Sistema

```
+------------------------------------------------------------------+
|                        CLIENTE (React PWA)                       |
|                                                                  |
|  ChatBot.jsx --SSE ReadableStream--> Render token a token        |
|  useEvents.js --fetch--> /api/events --> EventGrid / FilterPanel |
+---------------------+--------------------------------------------+
                       | HTTPS / Vercel Edge
+---------------------v--------------------------------------------+
|                  SERVERLESS FUNCTIONS (Vercel)                   |
|                                                                  |
|  /api/chat.js                                                    |
|    +-- Plan A: Gemini Flash (generateContentStream)              |
|    |     +-- Tool Loop (max 5 hops, non-stream) -> SSE stream    |
|    +-- Plan B: Groq llama-3.1-8b (stream: true)                 |
|    +-- Plan C: Graceful degradation (chunk SSE estatico)         |
|                                                                  |
|  /api/events.js                                                  |
|    +-- In-memory cache (TTL: 10 min, warm instance)              |
|    +-- LIVE: linda.buenosaires.gob.ar/api/frontend/events/filter |
|    +-- FALLBACK: 10 mock records normalizados                    |
+------------------------------------------------------------------+
```

---

## 🤖 Arquitectura de IA & Resiliencia

### Plan A / B / C — Fallback Automático

EvenGo implementa un patrón de **Alta Disponibilidad de tres niveles** para el agente conversacional. La conmutación es completamente invisible para el usuario final.

```
Request /api/chat
      |
      v
[PLAN A]  --OK--> Gemini Flash (gemini-flash-latest)
(Primario)        Tool-calling nativo + SSE stream
      |
      | Error 503/429/timeout
      v
[PLAN B]  --OK--> Groq llama-3.1-8b-instant
(Fallback)        stream: true, OpenAI-compatible API
      |
      | Error
      v
[PLAN C]  ------> Mensaje de contingencia via SSE.
(Graceful         El stream cierra limpiamente.
 Degrade)         Cero errores sin manejar hacia el usuario.
```

**Retry con backoff exponencial (Plan A):** Los errores transitorios de capacidad (`503`, `429`, `high demand`) activan hasta 3 reintentos automáticos con espera progresiva de `600ms × numero_de_intento`.

---

### Streaming con Server-Sent Events (SSE)

El backend **no espera a que el modelo termine** de generar la respuesta completa. Abre una conexión SSE inmediatamente y transmite cada token en cuanto llega del modelo. El resultado es una experiencia de "escritura en vivo" con TTFB percibido cercano a cero.

**Protocolo SSE emitido por `/api/chat`:**

```
data: {"text":"Hola! Encontre"}\n\n
data: {"text":" 3 eventos en Palermo"}\n\n
data: {"text":" para este sabado:"}\n\n
data: {"done":true,"toolCalls":[...],"actions":{...}}\n\n
```

**Flujo del ciclo agentic:**

```javascript
// Fase 1: Tool-calls (NON-stream — limitación del protocolo functionResponse)
while (hops < MAX_TOOL_HOPS) {
  const result = await generateContent({ contents });     // respuesta completa
  if (!result.functionCalls()) break;
  const toolResult = await executeTool(call.name, call.args);
  contents.push({ functionResponse: trimForLLM(toolResult) });
}

// Fase 2: Turno textual final (STREAM — el usuario ve esto token a token)
const stream = await model.generateContentStream({ contents });
initSSE(res);   // writeHead 200 + Content-Type: text/event-stream
for await (const chunk of stream.stream) {
  res.write(`data: ${JSON.stringify({ text: chunk.text() })}\n\n`);
}
res.write(`data: ${JSON.stringify({ done: true, toolCalls, actions })}\n\n`);
res.end();
```

**En el cliente (`ChatBot.jsx`):** Se inserta un mensaje vacío del asistente en el estado *antes* de hacer el fetch. Cada `payload.text` se concatena usando la forma funcional de `setState`, evitando closures stale en el loop async. Las tarjetas de itinerario y botones `.ics` aparecen únicamente cuando llega el evento `done`.

---

### Integración con API GCBA — Reverse Engineering

La plataforma **Linda** (`linda.buenosaires.gob.ar`) es el portal cultural oficial del Gobierno de la Ciudad de Buenos Aires. Su API de backend carece de documentación pública; fue identificada mediante inspección del tráfico de red del portal.

```
Endpoint descubierto:
  GET https://linda.buenosaires.gob.ar/api/frontend/events/filter?limit=200

Response schema (inferido por observacion):
  {
    events:     [ { id, title, description, imageUrl, fechaInicio, fechaFin,
                    horarios, etiquetas, ubicacion, barrio, pathAlias,
                    slug, acceso, precio, drupalNid, componentes, ... } ],
    pagination: { page, limit, total, totalPages },
    filters:    { ... }
  }
```

La capa `normalizeRecord()` transforma este schema al schema propio de EvenGo:

- **HTML stripping:** limpia tags y entidades HTML de las descripciones
- **Normalización de barrios:** mapeo de keys `snake_case` (`villa_crespo`) a nombres legibles
- **Ajuste de zona horaria:** horas en UTC ajustadas a GMT-3 (Argentina)
- **Clasificación de categorías:** sistema de reglas con normalización de tildes y case-insensitive matching sobre `etiquetas[]` y `tipoEvento`
- **Cache in-memory:** TTL de 10 min aprovechando instancias warm de Vercel

**Resiliencia de datos:** Si Linda no responde, se sirven 10 registros mock que replican exactamente el schema real. `normalizeRecord()` los procesa de forma idéntica a los datos en vivo.

---

## 💰 Estrategia FinOps — Optimización de Tokens LLM

### 1. Data Trimming — `trimForLLM()`

Las APIs externas devuelven JSONs verbosos. Se diseñó una **separación de capas** entre el payload del frontend y el payload del modelo.

```javascript
// Aplicada en el loop agentic, antes de pushear el functionResponse al modelo.
// El toolResult COMPLETO sigue yendo al toolCallLog para el frontend.
const trimForLLM = (obj) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([k]) => !k.startsWith('_') && k !== 'action')  // elimina _raw, _fullEvents, action
      .map(([k, v]) => [k, typeof v === 'object' && v !== null && !Array.isArray(v)
        ? trimForLLM(v)   // recursivo
        : v
      ])
  );
};
```

**Convención de campos internos:** Los campos prefijados con `_` son datos para el frontend que no deben llegar al LLM (ej: `_fullEvents` con IDs y URLs, `_raw` con datos crudos del clima). El campo `action` es una señal para el cliente React, semánticamente irrelevante para el modelo.

**Reducción de tokens medida:**

| Herramienta | Tokens antes | Tokens después | Ahorro |
|---|---|---|---|
| `search_events` (8 eventos) | ~1.200 | ~480 | **~60%** |
| `check_weather` | ~350 | ~80 | **~77%** |
| `plan_itinerary` (combinada) | ~1.550 | ~560 | **~64%** |

**`checkWeather` — traducción semántica del WMO weathercode:**

```javascript
// El LLM recibe esto (6 campos, sin coordenadas ni arrays horarios)
{
  fecha: "2026-08-25",
  temp_max_c: 16,
  temp_min_c: 10,
  prob_lluvia_pct: 70,
  condicion: "Lluvia 🌧️",           // traduccion del WMO code 61 — no delega razonamiento al LLM
  consejo_ropa: "Llevar paraguas."  // pre-calculado en servidor — no consume tokens de inferencia
}
```

### 2. Ventana Deslizante del Historial

El historial enviado al modelo está acotado a los últimos `N` turnos. Mantiene el costo de contexto proporcional a la longitud real de la conversación activa.

---

## 🧪 Testing & QA

Suite completa en **Vitest** con cobertura de protocolo SSE, optimización FinOps y lógica de negocio ETL.

```bash
npm test            # 67 tests
npm run test:watch  # Modo watch (TDD)
```

**Resultado actual:**

```
 Test Files  3 passed (3)
      Tests  67 passed (67)
   Duration  3.31s
```

| Suite | Tests | Qué valida |
|---|---|---|
| **Parseador SSE Cliente** | 6 | Chunks, reconstrucción de texto, evento `done`, líneas malformadas, **chunks TCP fragmentados** |
| **Helpers SSE Servidor** | 4 | Formato `data: {...}\n\n`, headers, idempotencia de `initSSE`, flujo E2E |
| **FinOps — trimForLLM** | 7 | Eliminación de `_*` y `action`, recursividad, arrays intactos, null-safety |
| **FinOps — searchEvents slim** | 5 | Campos presentes/ausentes, truncado ≤150 chars, `sizeof(slim) < sizeof(full)` |
| **FinOps — checkWeather** | 10 | 6 rangos WMO, 3 consejos de ropa, ausencia de campos basura, ≥60% reducción |
| **ETL — classifyCategory** | 10 | Reglas Musical/Deportivo/Gastronomía, tildes, case-insensitive, null-safety |
| **ETL — normalizeLocation** | 10 | Mapeo barrios snake_case, fallbacks, case-insensitive |
| **Hook — isEventUpcoming** | 15 | Formatos `YYYY-MM-DD`, `DD-MM-YYYY`, `DD/MM/YYYY`, hora pasada/futura, null/undefined |

> **Caso destacado:** El test de **chunks TCP fragmentados** simula que un chunk de red llega cortado a la mitad de una línea SSE (`data: {"tex` / `t":"hola"}\n\n`). El buffer acumulativo del cliente lo reensambla correctamente antes del `JSON.parse`.

---

## 🗂️ Estructura del Proyecto

```
EvenGo/
├── api/                          # Vercel Serverless Functions (Node.js)
│   ├── chat.js                   # Agente IA — SSE, HA Plan A/B/C, trimForLLM
│   ├── events.js                 # GET /api/events — Linda API + cache 10min
│   ├── sync-gcba.js              # ETL pipeline: Datos Abiertos GCBA → schema EvenGo
│   ├── _cache.js                 # Cache in-memory (warm Vercel instance)
│   ├── chat.test.js              # Tests SSE + FinOps (32 tests)
│   └── sync-gcba.test.js         # Tests ETL GCBA (20 tests)
│
├── src/
│   ├── components/
│   │   ├── ChatBot.jsx           # Agente conversacional — SSE token a token
│   │   ├── EventGrid.jsx         # Grid de tarjetas con filtros en tiempo real
│   │   ├── EventCard.jsx         # Tarjeta individual con anchor para el agente IA
│   │   ├── FilterPanel.jsx       # Filtros: categoría, barrio, precio, búsqueda
│   │   └── FavoritesDrawer.jsx   # Panel de favoritos (localStorage)
│   ├── hooks/
│   │   ├── useEvents.js          # Fetch, filtrado, ordenamiento de eventos
│   │   ├── useFavorites.js       # CRUD favoritos + sincronización via CustomEvent
│   │   └── useEvents.test.js     # Tests hook isEventUpcoming (15 tests)
│   └── context/
│       └── EventProvider.jsx     # Context global de eventos
│
├── vite.config.js                # Vite + Vitest (node/jsdom) + Tailwind + PWA
├── vercel.json                   # SPA rewrite rules
└── package.json
```

---

## ⚙️ Instalación y Configuración Local

### Prerrequisitos

- Node.js ≥ 18
- [Vercel CLI](https://vercel.com/docs/cli) — necesario para las Serverless Functions locales

```bash
npm install -g vercel
```

### Setup

```bash
git clone https://github.com/KLGomez/EvenGo.git
cd EvenGo
npm install
cp .env.example .env.local   # completar con tus claves

# IMPORTANTE: usar vercel dev, no npm run dev
# npm run dev: solo frontend (sin /api)
# vercel dev: frontend + Serverless Functions con hot-reload
vercel dev
```

### Variables de Entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Obligatoria | Google AI Studio — [obtener aquí](https://aistudio.google.com/app/apikey) |
| `GROQ_API_KEY` | ⚠️ Recomendada | Groq Console — Plan B del agente — [obtener aquí](https://console.groq.com/) |
| `GEMINI_MODEL` | ❌ Opcional | Nombre del modelo. Default: `gemini-flash-latest` |

> **Graceful Degradation:** Sin `GROQ_API_KEY`, si Gemini falla el Plan B se omite y el Plan C activa una respuesta de contingencia vía SSE. El usuario siempre recibe una respuesta coherente.

> **Seguridad:** Variables sin prefijo `VITE_` son exclusivamente server-side. Vite no las inyecta en el bundle del cliente.

---

## 🚀 Deployment

```bash
vercel --prod   # deploy a producción
vercel          # preview / staging
```

El `vercel.json` configura el rewrite SPA para que React Router coexista con las rutas `/api/*` sin colisiones. Las Serverless Functions heredan el cache in-memory de `api/events.js` en instancias warm, complementado por `Cache-Control: s-maxage=300, stale-while-revalidate=600` en el CDN de Vercel.

---

## 🛠️ Scripts

```bash
npm run dev         # Solo Vite (frontend, sin /api)
vercel dev          # Vite + Serverless Functions (recomendado)
npm run build       # Build de produccion con Vite
npm run preview     # Preview local del build
npm test            # Suite completa Vitest (67 tests)
npm run test:watch  # Vitest en modo watch
npm run lint        # Linting con oxlint
```

---

## 📄 Licencia

MIT — ver [LICENSE](LICENSE) para más detalles.

---

<div align="center">

Hecho con ☕ y demasiados tokens en Buenos Aires.

</div>
