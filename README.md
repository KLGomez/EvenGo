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

**EvenGo** es una **Progressive Web App (PWA)** de alto rendimiento concebida para revolucionar la manera en que residentes y turistas exploran la vibrante oferta cultural de Buenos Aires.

Diseñada con un enfoque **Mobile First** y estética *Dark Glassmorphism*, la plataforma combina la agilidad de un **Motor de Búsqueda y Filtrado Reactivo**, la potencia de un **Dashboard de Inteligencia Cultural (Radar Cultural)**, las capacidades nativas de una **PWA instalable offline** y el **Agente Ejecutivo Autónomo de IA (Gemini Flash)** capaz de planificar salidas completas, coordinar eventos reales con el clima en vivo y generar pases de calendario `.ics` de 1 clic.

---

## ✨ Features Destacadas (Funcionalidades)

### 🤖 Agente Ejecutivo Autónomo & Planificador de Itinerarios (`Gemini Flash`)
- **Planificación Autónoma de Salidas (`plan_itinerary`)**: El agente evalúa simultáneamente eventos reales de la agenda cultural, pronóstico meteorológico en vivo (Open-Meteo), consejos de transporte y vestimenta, y cronogramas paso a paso.
- **Function Calling Multihop Reales**: Encadenamiento autónomo de herramientas (`search_events`, `check_weather`, `save_favorite`, `generate_calendar_invite`, `plan_itinerary`) sin guiones fijos.
- **Pases de Calendario Descargables (.ics)**: Generación dinámica en memoria de invitaciones de calendario estándar descargables con 1 solo clic.
- **Tarjetas UI Interactivas de Itinerario**: Presentación de itinerarios con insignias de clima, cronograma de horarios, eventos alternativos y consejos de vestimenta directamente en el chat.
- **Sincronización Atómica con LocalStorage**: Cuando el agente guarda un favorito a pedido del usuario, el sistema notifica eventos globales (`favoritesUpdated`) para refrescar la interfaz al instante.

### 🔍 Filtrado Combinable & Búsqueda Avanzada
- **Motor Multicriterio**: Filtrado simultáneo y reactivo por **Categoría** (Cultural, Musical, Deportivo, Gastronomía), **Zona / Barrio** (Palermo, San Telmo, Belgrano, Recoleta, Obelisco/Centro, etc.), **Rango de Fecha** (Hoy, Este fin de semana, Esta semana, Próximamente) y **Modalidad de Precio** (Gratis vs. Pago).
- **Búsqueda Full-Text**: Búsqueda instantánea por palabras clave en títulos y descripciones de eventos con debounce visual.

### ⭐ 'Mi Ruta' (Planner Personal de Favoritos)
- **Persistencia Local**: Guardado de eventos seleccionados directamente en el navegador del usuario utilizando `localStorage`.
- **Experiencia de Guardado Fluida**: Indicadores visuales en tiempo real y contador dinámico de favoritos en la barra de navegación.

### 📊 Dashboard "Radar Cultural" & Analytics
- **Visualización Interactiva**: Gráficos (`Recharts`) tipo Radar, Donut y Barras para analizar la distribución temática y territorial de eventos en CABA.
- **Exportación de Datos**: Exportador nativo a **CSV (con BOM UTF-8 `\uFEFF`)** totalmente apto para Microsoft Excel.

### ⚡ PWA & Capacidades Offline (Nativas)
- **Instalación Multiplataforma**: Instalable como aplicación nativa en iOS, Android, Windows y macOS gracias al soporte de Web App Manifest (`manifest.webmanifest`).
- **Service Worker con Workbox**: Estrategias de cacheo adaptativo (`vite-plugin-pwa`) con actualización en segundo plano (`autoUpdate`), garantizando navegación rápida y disponibilidad de datos clave incluso ante pérdida total de conectividad.

---

## 🧠 Arquitectura del Agente Autónomo (Function Calling)

```
[ Usuario Chat UI ]
       │  "Armame un plan para este sábado en Palermo"
       ▼
[ POST /api/chat ] ──> [ Gemini Flash Engine ]
                                │
               ┌────────────────┼────────────────┐
               ▼                ▼                ▼
       searchEvents()    checkWeather()   planItinerary()
       (API GCBA Linda)   (Open-Meteo)     (Composite Tool)
               │                │                │
               └────────────────┼────────────────┘
                                ▼
                       generateCalendarInvite()
                                │ (.ics Base64 Data URI)
                                ▼
                  [ Respuesta UI con Tarjeta + .ics ]
```

---

## 🔄 Flujo ETL de Datos (GCBA → EvenGo)

EvenGo es intencionalmente **stateless**: no persiste eventos en una base de datos propia, sino que resincroniza contra la fuente oficial (portal cultural del GCBA — API Linda) en cada request, con caché de corto plazo. Esta es una **decisión de arquitectura**, no una tarea pendiente, tomada para:

1. **Eliminar staleness**: Los eventos de Buenos Aires cambian diariamente; una DB propia requeriría un job de sincronización adicional sin reducir la latencia perceptible.
2. **Minimizar infra**: Serverless + caché en memoria (TTL 10 min) cubre el 80%+ del tráfico sin costo operativo.
3. **Resiliencia por diseño**: Si la API falla, un conjunto de datos mock con estructura idéntica garantiza continuidad de la experiencia.

```
[ API Linda (GCBA) ]          [ Open-Meteo ]
        │                           │
        │  fetch (timeout: 10s)     │ fetch (timeout: 8s)
        ▼                           ▼
[ extractFromLinda() ]     [ checkWeather() ]
        │                           │
        │  Fallback automático      │
        ▼  si la API falla          │
[ MOCK_RECORDS ]                    │
        │                           │
        ▼                           │
[ normalizeRecord() ]               │
  ├── stripHtml()                   │
  ├── classifyCategory()            │
  └── normalizeLocation()           │
        │                           │
        ▼                           ▼
[ Caché en memoria (TTL: 10 min) ] ─┘
        │
        ▼
[ GET /api/events ] ─────────────────> [ React Frontend ]
                                              │
                                    useEvents() → filtros reactivos
                                              │
                                    [ EventCard / RadarCultural ]
```

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Descripción |
| :--- | :--- | :--- |
| **Core Framework** | **React 19** | Biblioteca principal de UI utilizando Hooks avanzados (`useMemo`, `useCallback`, `useEffect`). |
| **Agente de IA** | **Gemini Flash** | Motor LLM con Function Calling nativo, reintentos automáticos y preservación de razonamiento. |
| **Build System** | **Vite 8** | Bundler de ultra alta velocidad con reemplazo de módulos en caliente (HMR). |
| **Styling** | **Tailwind CSS v4** | Framework CSS utilitario para diseño responsivo y Dark Mode Glassmorphism. |
| **Testing** | **Vitest** | Suite de tests unitarios para funciones puras del pipeline ETL y lógica de fechas. |
| **CI/CD** | **GitHub Actions** | Pipeline automático: lint + tests + build en cada push/PR a `main` y `develop`. |
| **PWA & Offline** | **Vite Plugin PWA / Workbox** | Generación autogestionada de Service Worker y Web App Manifest. |
| **Analytics & Data** | **Recharts** | Generación de gráficos SVG interactivos y adaptativos. |
| **Calendario .ics** | **ics** | Motor de generación de invitaciones iCalendar RFC 5545 en memoria. |
| **Backend & ETL** | **Vercel Serverless Functions** | Endpoints Node.js para API Gateway, sanitización de datos y orquestación del agente. |

---

## ⚙️ Instalación y Uso

```bash
# 1. Clonar el repositorio
git clone https://github.com/KLGomez/EvenGo.git

# 2. Navegar a la carpeta del proyecto
cd EvenGo

# 3. Instalar las dependencias
npm install

# 4. Configurar las variables de entorno
cp .env.example .env.local
# Editá .env.local y completá GEMINI_API_KEY con tu clave de Google AI Studio

# 5. Iniciar el servidor de desarrollo con soporte de funciones serverless
npx vercel dev
# ⚠️  NO usar `npm run dev` solo — las funciones /api/* requieren Vercel CLI
#      para funcionar correctamente en entorno local.

# 6. Correr los tests
npm test

# 7. Compilar para producción
npm run build
```

---

## 🔑 Variables de Entorno

| Variable | Tipo | Requerida | Descripción |
| :--- | :--- | :---: | :--- |
| `GEMINI_API_KEY` | Server-side | ✅ | Clave de la API de Gemini. Obtenerla en [Google AI Studio](https://aistudio.google.com/app/apikey). |
| `GEMINI_MODEL` | Server-side | ❌ | Nombre del modelo Gemini a usar. Default: `gemini-1.5-flash`. Útil para cambiar de modelo sin modificar código. |

> **Variables con prefijo `VITE_`** se inyectan en el bundle del cliente en build time — nunca uses este prefijo para claves privadas.

---

## 📄 Licencia y Autoría

Diseñado y desarrollado por **Katherine Gomez**.  
*Quilmes, Buenos Aires, Argentina.*

