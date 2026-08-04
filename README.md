# 🗺️ EvenGo — Agenda, Radar Cultural & PWA de Buenos Aires

> **La PWA definitiva para descubrir, analizar y guardar los eventos culturales, musicales, deportivos y gastronómicos más relevantes de la Ciudad de Buenos Aires en tiempo real.**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Vercel](https://img.shields.io/badge/Vercel-Serverless-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://vercel.com/)

---

## 📌 Descripción General

**EvenGo** es una **Progressive Web App (PWA)** de alto rendimiento concebida para revolucionar la manera en que residentes y turistas exploran la vibrante oferta cultural de Buenos Aires.

Diseñada con un enfoque **Mobile First** y estética *Dark Glassmorphism*, la plataforma combina la agilidad de un **Motor de Búsqueda y Filtrado Reactivo**, la potencia de un **Dashboard de Inteligencia Cultural (Radar Cultural)**, la interacción con un **Asistente de IA (Gemini)** y las capacidades nativas de una **PWA instalable offline**.

---

## ✨ Features Destacadas (Funcionalidades)

### 🔍 Filtrado Combinable & Búsqueda Avanzada
- **Motor Multicriterio**: Filtrado simultáneo y reactivo por **Categoría** (Cultural, Musical, Deportivo, Gastronomía), **Zona / Barrio** (Palermo, San Telmo, Belgrano, Recoleta, Obelisco/Centro, etc.), **Rango de Fecha** (Hoy, Este fin de semana, Esta semana, Próximamente) y **Modalidad de Precio** (Gratis vs. Pago).
- **Búsqueda Full-Text**: Búsqueda instantánea por palabras clave en títulos y descripciones de eventos con debounce visual.

### ⭐ 'Mi Ruta' (Planner Personal de Favoritos)
- **Persistencia Local**: Guardado de eventos seleccionados directamente en el navegador del usuario utilizando `localStorage`.
- **Experiencia de Guardado Fluida**: Indicadores visuales en tiempo real y contador dinámico de favoritos en la barra de navegación.

### 📱 Experiencia de Usuario & UI Inmersiva
- **Drawer Lateral (Slide-over)**: Panel deslizable de acceso rápido para gestionar la lista de 'Mi Ruta' sin interrumpir la navegación.
- **Scroll to Top Dinámico**: Botón flotante que detecta automáticamente la posición del scroll vertical para retornar fluidamente al encabezado.
- **Dashboard "Radar Cultural"**: Módulo de Inteligencia de Datos con gráficos interactivos (`Recharts`) tipo Radar, Donut y Barras, complementado con exportador nativo de reportes a **CSV (con BOM UTF-8 `\uFEFF`)** apto para Microsoft Excel.
- **Asistente de IA Cultural ("Lina")**: Chatbot inteligente integrado a la API de **Google Gemini** (`@google/generative-ai`) contextualizado para recomendar eventos y responder inquietudes sobre la agenda de la ciudad.

### ⚡ PWA & Capacidades Offline (Nativas)
- **Instalación Multiplataforma**: Instalable como aplicación nativa en iOS, Android, Windows y macOS gracias al soporte de Web App Manifest (`manifest.webmanifest`).
- **Service Worker con Workbox**: Estrategias de cacheo adaptativo (`vite-plugin-pwa`) con actualización en segundo plano (`autoUpdate`), garantizando navegación rápida y disponibilidad de datos clave incluso ante pérdida total de conectividad.

---

## 🔌 Fuente de Datos y Reverse Engineering

Una de las piezas arquitectónicas más destacadas de **EvenGo** es su estrategia de ingesta y extracción de datos reales. La aplicación **no depende de datos estáticos ni de fuentes simuladas**, sino de la infraestructura oficial del portal cultural **"Linda" del Gobierno de la Ciudad de Buenos Aires (GCBA)**.

```
[ Frontend PWA ] ──> fetch('/api/events') ──> [ Vercel Serverless Function ]
                                                       │
                                            Network Request / Reverse Eng.
                                                       ▼
                                       https://linda.buenosaires.gob.ar
```

### 🛠️ Proceso de Ingeniería Inversa & Pipeline ETL:
1. **Network Sniffing & Discovery**: Al tratarse de una API pública no documentada oficialmente, se efectuó un análisis exhaustivo del tráfico HTTP (`Network Tab` de Chrome DevTools) para interceptar las consultas internas del portal *Linda*.
2. **Identificación de Endpoints y Payload**: Se descubrieron las rutas internas REST (`/api/frontend/events/filter`) y los patrones de parámetros para paginación, filtros de fecha y etiquetas temáticas.
3. **Servidor Intermedio (Vercel Serverless Function)**: Se desarrolló un backend liviano en Node.js (`api/events.js` y `api/sync-gcba.js`) que actúa como API Gateway y normalizador.
4. **Normalización & Sanitizado O(N)**: El backend intercepta la estructura JSON cruda de GCBA, mapea nombres de barrios en `snake_case` (ej: `villa_crespo` → `Villa Crespo`), clasifica eventos mediante expresiones regulares sobre etiquetas/tags y estandariza los esquemas a la interfaz esperada por el cliente React.
5. **Fallbacks Defensivos de Alta Disponibilidad**: En caso de indisponibilidad temporal del servidor gubernamental o errores de red, la PWA activa un mecanismo transparente de degradación (*Graceful Degradation*), exponiendo un aviso visual (`DataSourceBanner`) y sirviendo un set de contingencia de alta fidelidad.

---

## 🧠 Decisiones de Arquitectura (El 'Por qué')

### 1. Custom Hooks Modulares & Separación de Incumbencias
La lógica de negocio se abstrayo completamente de la capa de renderizado UI:
- `useEvents`: Centraliza el estado de eventos, la ejecución del pipeline de filtrado combinado con `useMemo` y la orquestación del fetch contra `/api/events`.
- `useFavorites`: Gestiona el ciclo de vida del *Planner Personal* en `localStorage`.
- `useEventAnalytics`: Ejecuta agregaciones estadísticas O(N) en una sola pasada para alimentar las métricas del Radar Cultural.

### 2. Sincronización de Estado Reactivo mediante `window.dispatchEvent`
Para evitar el problema de **Prop-Drilling** o la sobrecarga de dependencias pesadas (como Redux o Zustand) para una funcionalidad focalizada como Favoritos, se implementó un **Bus de Eventos Nativo**:
```javascript
// Al modificar favoritos, se notifica globalmente a la ventana:
localStorage.setItem('evengo_favorites', JSON.stringify(updatedFavorites));
window.dispatchEvent(new Event('favoritesUpdated'));
```
Cualquier componente (Navbar, EventCard, Drawer) suscrito al evento personalizado `favoritesUpdated` o al evento `storage` (para sincronización entre pestañas abiertas) reactualiza su estado de forma atómica e instantánea.

### 3. Enfoque Mobile-First & UI Reactiva
El diseño UI se concibió prioritariamente para pantallas táctiles móviles, adaptando progresivamente los componentes hacia vistas de escritorio. Se empleó Tailwind CSS v4 para lograr transiciones suaves, contenedores adaptativos y jerarquías tipográficas de alta legibilidad.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Descripción |
| :--- | :--- | :--- |
| **Core Framework** | **React 19** | Biblioteca principal de UI utilizando Hooks avanzados (`useMemo`, `useCallback`, `useEffect`). |
| **Build System** | **Vite 8** | Bundler de ultra alta velocidad con reemplazo de módulos en caliente (HMR). |
| **Styling** | **Tailwind CSS v4** | Framework CSS utilitario para diseño responsivo y Dark Mode. |
| **PWA & Offline** | **Vite Plugin PWA / Workbox** | Generación autogestionada de Service Worker y Web App Manifest. |
| **Analytics & Data** | **Recharts** | Generación de gráficos SVG interactivos y adaptativos. |
| **Inteligencia Artificial**| **Google Gemini API** | Modelo LLM integrado para el chatbot asistente cultural. |
| **Routing** | **React Router DOM v7** | Enrutamiento declarativo del lado del cliente. |
| **Backend & ETL** | **Vercel Serverless Functions**| Endpoints Node.js para Reverse Engineering y normalización de la API GCBA. |

---

## ⚙️ Instalación y Uso

Sigue estos sencillos pasos para clonar y ejecutar **EvenGo** en tu entorno local:

### Prerrequisitos
- **Node.js** (v18.0.0 o superior)
- **npm** o **yarn**

### Comandos de Ejecución

```bash
# 1. Clonar el repositorio
git clone https://github.com/KLGomez/EvenGo.git

# 2. Navegar a la carpeta del proyecto
cd EvenGo

# 3. Instalar las dependencias
npm install

# 4. Iniciar el servidor de desarrollo (con Mocks locales)
npm run dev

# 5. (Opcional) Probar las Vercel Serverless Functions con datos reales del GCBA
npx vercel dev

# 6. Compilar para producción (Bundle optimizado y PWA Service Worker)
npm run build

# 7. Vista previa de la build de producción
npm run preview
```

---

## 📄 Licencia y Autoria

Diseñado y desarrollado por **Katherine Gomez**.
*Quilmes, Buenos Aires, Argentina.*
