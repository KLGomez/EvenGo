# 🗺️ EvenGo — Agenda, Radar Cultural & PWA de Buenos Aires

> **La PWA definitiva para descubrir, analizar y guardar los eventos culturales, musicales, deportivos y gastronómicos más relevantes de la Ciudad de Buenos Aires en tiempo real, impulsada por un Agente Ejecutivo Autónomo de IA.**

[![CI](https://github.com/KLGomez/EvenGo/actions/workflows/ci.yml/badge.svg)](https://github.com/KLGomez/EvenGo/actions/workflows/ci.yml)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Gemini AI](https://img.shields.io/badge/Gemini-Flash-8E75FF?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

---

## 📌 Descripción General

**EvenGo** es una **Progressive Web App (PWA)** de alto rendimiento diseñada para revolucionar la manera en que residentes y turistas exploran la vibrante oferta cultural de Buenos Aires.

Construida con un enfoque **Mobile First** y estética *Dark Glassmorphism*, la plataforma combina cuatro pilares principales:

- **Motor de Búsqueda y Filtrado Reactivo** multicriterio sobre eventos en tiempo real.
- **Dashboard Analítico "Radar Cultural"** con gráficos interactivos por categoría y zona.
- **Capacidades nativas de PWA** instalable y con soporte offline (Service Worker + Workbox).
- **Agente Ejecutivo Autónomo de IA** (Gemini Flash) capaz de planificar salidas completas, combinar datos de eventos con el clima en vivo y generar pases de calendario `.ics` con un solo clic.

---

## ✨ Funcionalidades Principales

### 🤖 Agente Ejecutivo Autónomo & Concierge de IA

El widget **ChatBot** flotante es el corazón interactivo de EvenGo. Utiliza **Gemini Flash** con **Function Calling nativo** (multi-hop autónomo de hasta 5 pasos) para ejecutar herramientas reales sin guiones fijos.

**Herramientas disponibles:**

| Herramienta | Descripción |
| :--- | :--- |
| `search_events` | Busca eventos en la agenda del GCBA por categoría, barrio, precio y palabra clave. |
| `check_weather` | Consulta el pronóstico en tiempo real desde Open-Meteo para Buenos Aires. |
| `save_favorite` | Guarda un evento en los favoritos del usuario vía `localStorage`. |
| `generate_calendar_invite` | Genera una invitación `.ics` (RFC 5545) descargable en memoria. |
| `plan_itinerary` | Planificación autónoma completa: combina eventos + clima + cronograma + `.ics`. |

**Capacidades del agente:**
- **Planificación autónoma de itinerarios (`plan_itinerary`)**: evalúa simultáneamente la agenda cultural, el pronóstico meteorológico, consejos de vestimenta y transporte, y un cronograma paso a paso.
- **Tarjetas UI interactivas**: los itinerarios se renderizan como tarjetas visuales ricas con insignias de clima, eventos alternativos y botón de descarga de calendario.
- **Sincronización atómica con `localStorage`**: al guardar un favorito, el agente dispara el evento global `favoritesUpdated` para refrescar la UI al instante.
- **Markdown enriquecido**: las respuestas del agente usan `react-markdown` con componentes personalizados. Los anchorLinks (`#event-{id}`) hacen scroll hasta la tarjeta del evento y la resaltan con animación visual.
- **Plan B automático (fallback a Grok)**: si Gemini falla, el sistema intenta continuar con **x.ai (Grok 4.6)** vía `/v1/responses`. Si también falla, activa una respuesta estática de contingencia **(Plan C)**, garantizando cero pantallas de error para el usuario.

---

### 🔍 Filtrado Combinable & Búsqueda Avanzada

- **Motor multicriterio reactivo**: filtrado simultáneo por **Categoría** (Cultural, Musical, Deportivo, Gastronomía), **Zona / Barrio** (Palermo, San Telmo, Belgrano, Recoleta, Obelisco/Centro, etc.), **Rango de Fecha** (Hoy, Este fin de semana, Esta semana, Próximamente) y **Precio** (Gratis / Pago).
- **Búsqueda full-text**: búsqueda instantánea por palabras clave en títulos y descripciones con debounce visual.
- **Filtro temporal inteligente** (`isEventUpcoming`): descarta automáticamente eventos ya finalizados respetando tanto la fecha como la hora de inicio, con soporte para los formatos `YYYY-MM-DD` y `DD/MM/YYYY`.

---

### ⭐ "Mi Ruta" — Planner Personal de Favoritos

- **Persistencia local**: los eventos seleccionados se guardan en `localStorage` del navegador, sin necesidad de cuenta ni backend.
- **Drawer deslizable**: interfaz lateral con lista de favoritos guardados, botón de eliminación por ítem y vaciado total.
- **Contador dinámico**: la Navbar muestra en tiempo real la cantidad de favoritos activos.

---

### 📊 Dashboard "Radar Cultural" & Analytics

- **Ruta dedicada** (`/radar-cultural`) con visualizaciones avanzadas usando **Recharts**.
- **Tipos de gráfico**: Radar temático, Donut de distribución por categoría, y Barras por zona/barrio.
- **Exportación nativa a CSV**: con BOM UTF-8 (`\uFEFF`) para compatibilidad total con Microsoft Excel.
- **Banner de estado de fuente de datos** (`DataSourceBanner`): informa al usuario en tiempo real si los eventos provienen de la API oficial del GCBA o de los datos de demostración (mocks).

---

### ⚡ PWA & Capacidades Offline

- **Instalable multiplataforma**: funciona como app nativa en iOS, Android, Windows y macOS gracias al `manifest.webmanifest` generado automáticamente.
- **Service Worker con Workbox** (`vite-plugin-pwa`): estrategia `autoUpdate` para cacheo adaptativo y actualización en segundo plano, garantizando navegación rápida incluso ante pérdida de conectividad.

---

## 🧠 Arquitectura del Agente (Function Calling Multi-hop)

```
[ Usuario — ChatBot UI ]
       │  "Armame un plan para este sábado en Palermo"
       ▼
[ POST /api/chat ] ──► [ Gemini Flash (gemini-flash-latest) ]
                                │
               ┌────────────────┼────────────────┐
               ▼                ▼                ▼
       searchEvents()    checkWeather()   planItinerary()
       (API Linda GCBA)   (Open-Meteo)    (herramienta compuesta)
               │                │                │
               └────────────────┼────────────────┘
                                ▼
                       generateCalendarInvite()
                                │ (.ics — Base64 Data URI)
                                ▼
                  [ Respuesta UI: Tarjeta + Botón .ics ]

── En caso de fallo de Gemini ──────────────────────────────
       ▼
[ Plan B: x.ai Grok 4.6 ]  (POST https://api.x.ai/v1/responses)
       │  prompt combinado (SYSTEM_INSTRUCTION + historial)
       ▼
[ Plan C: Respuesta estática de contingencia (sin error visible) ]
```

---

## 🔄 Flujo ETL de Datos (GCBA → EvenGo)

EvenGo es intencionalmente **stateless**: no persiste eventos en una base de datos propia. Resincroniza contra la fuente oficial (API Linda del GCBA) en cada request, con caché en memoria de corto plazo. Esta es una **decisión de arquitectura** tomada para:

1. **Eliminar staleness**: los eventos de Buenos Aires cambian diariamente; una DB propia requeriría un job de sincronización adicional sin reducir latencia perceptible.
2. **Minimizar infraestructura**: Serverless + caché en memoria (TTL 10 min) cubre el 80 %+ del tráfico sin costo operativo.
3. **Resiliencia por diseño**: si la API falla, un conjunto de datos mock con estructura idéntica garantiza continuidad de la experiencia.

```
[ API Linda (GCBA) ]              [ Open-Meteo ]
        │                               │
        │  fetch (limit: 200, timeout: 10s)  │ fetch (timeout: 8s)
        ▼                               ▼
[ extractFromLinda() ]         [ checkWeather() ]
        │                               │
        │  Fallback automático          │
        ▼  si la API falla              │
[ MOCK_RECORDS ]                        │
        │                               │
        ▼                               │
[ normalizeRecord() ]                   │
  ├── stripHtml()                       │
  ├── classifyCategory()  ◄─── CLASSIFICATION_RULES
  └── normalizeLocation()               │
        │                               │
        ▼                               ▼
[ Caché en memoria (TTL: 10 min) ] ─────┘
        │
        ▼
[ GET /api/events ] ─────────────────► [ React Frontend ]
                                              │
                                    useEvents() → filtros reactivos
                                    useEventAnalytics() → Recharts
                                              │
                                    [ EventCard / Dashboard ]
```

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Versión | Descripción |
| :--- | :--- | :---: | :--- |
| **Core Framework** | React | 19 | UI reactiva con Hooks avanzados (`useMemo`, `useCallback`, `useEffect`). |
| **Agente de IA (Plan A)** | Gemini Flash | `gemini-flash-latest` | LLM con Function Calling nativo, reintentos automáticos y preservación de candidatos de razonamiento. |
| **Agente de IA (Plan B)** | x.ai Grok | `grok-4.6` | Fallback automático vía endpoint `/v1/responses` si Gemini no está disponible. |
| **Build System** | Vite | 8 | Bundler de ultra alta velocidad con HMR. |
| **Routing** | React Router DOM | 7 | SPA routing con dos rutas: `/` (agenda) y `/radar-cultural` (dashboard). |
| **Styling** | Tailwind CSS | v4 | Framework CSS utilitario, Dark Mode Glassmorphism. |
| **Markdown** | react-markdown | 10 | Renderizado de respuestas del agente con componentes personalizados y anchorLinks interactivos. |
| **Analytics & Data** | Recharts | 3 | Gráficos SVG interactivos (Radar, Donut, Barras). |
| **Calendario .ics** | ics | 3 | Generación de invitaciones iCalendar RFC 5545 en memoria (Base64 Data URI). |
| **PWA & Offline** | vite-plugin-pwa / Workbox | 1 | Service Worker autogestionado con estrategia `autoUpdate`. |
| **Backend & ETL** | Vercel Serverless Functions | — | Endpoints Node.js: `/api/events` (ETL + caché) y `/api/chat` (orquestador IA). |
| **Linter** | oxlint | 1 | Linter de alto rendimiento (Rust-based). |
| **Testing** | Vitest | 4 | Tests unitarios para lógica ETL, fechas y hooks. |
| **CI/CD** | GitHub Actions | — | Pipeline automático: lint + tests + build en cada push/PR a `main` y `develop`. |

---

## 🗂️ Estructura del Proyecto

```
EvenGo/
├── api/                        # Vercel Serverless Functions (Node.js)
│   ├── _cache.js               # Módulo de caché en memoria (TTL configurable)
│   ├── chat.js                 # Orquestador del Agente IA (Plan A: Gemini, Plan B: Grok, Plan C: static)
│   ├── events.js               # ETL: extracción, normalización y caché de eventos del GCBA
│   ├── sync-gcba.js            # Script de sincronización manual con la API de Linda
│   └── sync-gcba.test.js       # Tests unitarios del pipeline ETL
│
├── src/
│   ├── components/
│   │   ├── ChatBot.jsx         # Widget conversacional flotante (Agente IA)
│   │   ├── Dashboard.jsx       # Vista /radar-cultural con gráficos Recharts
│   │   ├── DataSourceBanner.jsx# Banner de estado de fuente de datos (live/mock)
│   │   ├── EventCard.jsx       # Tarjeta individual de evento con anchorLink
│   │   ├── EventGrid.jsx       # Grid responsivo de EventCards
│   │   ├── FavoritesDrawer.jsx # Drawer lateral "Mi Ruta" (favoritos)
│   │   ├── FilterPanel.jsx     # Sidebar de filtros combinables
│   │   ├── Hero.jsx            # Sección hero con contador de eventos
│   │   ├── Navbar.jsx          # Barra de navegación con contador de favoritos
│   │   └── ScrollToTop.jsx     # Botón flotante de regreso al inicio
│   │
│   ├── context/
│   │   ├── EventContext.js     # Definición del Contexto global de eventos
│   │   └── EventProvider.jsx   # Proveedor del contexto (wrappea useEvents)
│   │
│   ├── hooks/
│   │   ├── useEventAnalytics.js# Métricas derivadas para los gráficos del Dashboard
│   │   ├── useEventContext.js  # Accessor del EventContext (con validación)
│   │   ├── useEvents.js        # Hook principal: carga, filtrado y estado de eventos
│   │   ├── useEvents.test.js   # Tests unitarios del hook useEvents
│   │   └── useFavorites.js     # Gestión de favoritos con localStorage
│   │
│   ├── services/
│   │   └── evengoService.js    # Cliente HTTP hacia /api/events
│   │
│   ├── data/                   # Eventos mock de demostración (fallback)
│   ├── utils/                  # Utilidades de fechas y calendario
│   ├── assets/                 # Recursos estáticos (íconos, imágenes)
│   ├── App.jsx                 # Componente raíz: Router + rutas + layout global
│   └── main.jsx                # Entry point de React + registro del Service Worker
│
├── public/                     # Assets públicos (manifest, íconos PWA)
├── .env.example                # Plantilla de variables de entorno
├── vercel.json                 # Rewrites de Vercel para SPA routing
├── vite.config.js              # Configuración de Vite (React + PWA + Tailwind)
└── package.json
```

---

## ⚙️ Instalación y Uso Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/KLGomez/EvenGo.git

# 2. Instalar dependencias
cd EvenGo
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editá .env.local y completá GEMINI_API_KEY con tu clave de Google AI Studio

# 4. Iniciar el servidor de desarrollo
npx vercel dev
# ⚠️  NO usar `npm run dev` solo — las funciones /api/* requieren Vercel CLI
#     para ser emuladas correctamente en entorno local.

# 5. Correr los tests
npm test

# 6. Compilar para producción
npm run build

# 7. Vista previa del build de producción
npm run preview
```

---

## 🔑 Variables de Entorno

| Variable | Tipo | Requerida | Descripción |
| :--- | :--- | :---: | :--- |
| `GEMINI_API_KEY` | Server-side | ✅ | Clave de la API de Gemini. Obtenerla en [Google AI Studio](https://aistudio.google.com/app/apikey). |
| `XAI_API_KEY` | Server-side | ❌ | Clave de la API de x.ai (Grok). Habilita el Plan B de fallback del agente. |
| `FALLBACK_API_KEY` | Server-side | ❌ | Alias alternativo para `XAI_API_KEY` (se usa si esta no está definida). |

> **Importante:** Las variables **sin** prefijo `VITE_` son exclusivamente server-side (Vercel Serverless) y nunca se exponen en el bundle del cliente. Nunca uses el prefijo `VITE_` para claves privadas.

---

## 🔌 Endpoints de la API

| Método | Ruta | Descripción |
| :--- | :--- | :--- |
| `GET` | `/api/events` | Retorna la agenda de eventos normalizados del GCBA (con caché de 10 min y fallback a mocks). |
| `POST` | `/api/chat` | Orquesta el agente IA (Gemini → Grok → fallback estático). Body: `{ messages: [...] }`. |

---

## 🧪 Testing

El proyecto incluye tests unitarios con **Vitest** y **@testing-library/jest-dom**:

```bash
npm test          # Ejecuta los tests una vez
npm run test:watch  # Modo watch (re-ejecuta al guardar)
```

**Cobertura actual:**
- `api/sync-gcba.test.js` — lógica de normalización y clasificación del pipeline ETL.
- `src/hooks/useEvents.test.js` — lógica de filtrado, detección de eventos vigentes y manejo de errores del hook principal.

---

## 🚀 Despliegue

El proyecto está optimizado para desplegarse en **Vercel** con zero-config:

1. Conectar el repositorio en [vercel.com](https://vercel.com).
2. Agregar las variables de entorno (`GEMINI_API_KEY`, `XAI_API_KEY`) en el panel de Vercel.
3. Vercel detecta automáticamente la carpeta `api/` como Serverless Functions y `vite build` como el comando de build del frontend.

El archivo `vercel.json` configura los rewrites necesarios para el SPA routing (`react-router-dom`).

---

## 📄 Licencia y Autoría

Diseñado y desarrollado por **Katherine Gomez**.  
*Quilmes, Buenos Aires, Argentina — © 2026*
