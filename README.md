# EvenGo 🗓️

> **Discover what's happening in Buenos Aires — tonight, this week, or whenever you're free.**

EvenGo is a full-stack web application that aggregates, normalizes, and filters the cultural events calendar of the City of Buenos Aires. It solves the friction of navigating multiple fragmented government portals by presenting a unified, searchable, and filterable event feed — with one-click Google Calendar integration.

---

## 🚀 Live Demo

**[evego.vercel.app](https://evego.vercel.app)** *(replace with your actual deployment URL)*

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **UI Framework** | React 18 + Vite 8 | SPA with fast HMR dev experience |
| **Styling** | Tailwind CSS v4 | Utility-first, responsive design |
| **State & Data** | Custom Hooks (`useEvents`) | Composable filter state + async data loading |
| **Backend** | Node.js Serverless Functions | Data extraction, normalization, and serving |
| **Deployment** | Vercel | Edge-cached API + CDN-distributed frontend |
| **Data Source** | Linda API (GCBA) | Internal API of Buenos Aires' cultural portal |

---

## 🏗️ Architecture

```
Browser (React SPA)
       │
       │  GET /api/events
       ▼
Vercel Serverless Function  ──► extractFromLinda()
  (api/events.js)                      │
       │                  ┌────────────┴───────────────┐
       │                  │  linda.buenosaires.gob.ar  │
       │                  │  /api/frontend/events/     │
       │                  │  filter?limit=200          │
       │                  └────────────────────────────┘
       │                               │
       │                          normalizeRecord()
       │                               │
       │◄──────────────────────────────┘
       │
  { events[], total, source, live, timestamp }
       │
       ▼
 EventCard components (no API knowledge — consumes normalized schema only)
```

The frontend is **completely decoupled from the data source**. React components consume a stable `EvenGoEvent` schema regardless of what upstream API backs it — enabling seamless data source migrations without touching a single UI file.

---

## 🔬 Architecture Deep-Dive: Data Resilience & Reverse Engineering

This section documents the most technically significant engineering work in the project.

### Phase 1 — Government CKAN API (Deprecated)

The initial data source was Buenos Aires City's open data portal (`data.buenosaires.gob.ar`), accessed via the CKAN REST API. The integration required:

- Iterating over **4 resource IDs** in sequence until a populated datastore was found
- A keyword-based **auto-classifier** to map free-form GCBA categories into EvenGo's 4-category schema (`Musical`, `Deportivo`, `Gastronomía`, `Cultural`)
- A `normalizeLocation()` function to map raw neighborhood names to the app's filter zones

**Problem encountered:** The CKAN datastore endpoints began returning HTTP 404 for all resource IDs, rendering the integration dead.

### Phase 2 — Reverse Engineering the "Linda" Portal

After the CKAN failure, the government migrated its cultural agenda to a new Next.js platform: **Linda** (`linda.buenosaires.gob.ar`). Rather than waiting for official API documentation (which does not exist publicly), the internal API was discovered through browser DevTools network inspection.

**Discovered endpoint:**
```
GET https://linda.buenosaires.gob.ar/api/frontend/events/filter?limit=200
```

**Response envelope:**
```json
{
  "filters":    { ... },
  "events":     [ { "id", "title", "description", "imageUrl", "fechaInicio",
                    "etiquetas", "ubicacion", "barrio", "pathAlias", "slug", ... } ],
  "pagination": { "page": 1, "limit": 200, "total": 291, "totalPages": 2 }
}
```

### Phase 3 — Data Normalization Challenges

Mapping the raw Linda response to the EvenGo schema required solving several non-trivial normalization problems:

#### 1. HTML Stripping
Event descriptions arrive as raw HTML from a Drupal CMS. A custom `stripHtml()` function handles tag removal, HTML entity decoding (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`), and whitespace normalization — producing clean plain text safe for React rendering.

```js
function stripHtml(html = "") {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
```

#### 2. Timezone Handling
`fechaInicio` arrives in UTC ISO 8601 format (`"2026-08-02T22:00:00.000Z"`), but Buenos Aires operates on **UTC-3**. When no explicit `horarios[]` array is present, the time is derived from the ISO timestamp with an offset correction:

```js
const utcHour   = parseInt(event.fechaInicio.slice(11, 13), 10);
const localHour = ((utcHour - 3) + 24) % 24; // safe modulo for midnight crossings
```

#### 3. Slug Extraction from `pathAlias`
The `pathAlias` field carries the internal CMS path (`"/descubrir/slug-del-evento"`), while the public-facing URL pattern is `/eventos/slug-del-evento`. A robust extraction handles any depth of nesting:

```js
const slug = (event.pathAlias || event.slug || id)
  .split("/")
  .filter(Boolean)   // removes empty segments from leading "/"
  .pop();            // takes the last segment regardless of prefix depth

const url = `https://linda.buenosaires.gob.ar/eventos/${slug}`;
```

This approach is resilient to future CMS restructuring — as long as the slug remains the final path segment, the extraction is guaranteed to work correctly.

#### 4. Category Classification
Linda's `etiquetas` array (e.g., `["Música y Shows", "Entretenimiento"]`) feeds a keyword-based classifier that normalizes into EvenGo's fixed category set. Comparison uses Unicode NFD normalization + diacritic stripping to ensure `"Música"` matches `"musica"`:

```js
const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
```

#### 5. Mock Fallback Architecture
When the Linda API is unreachable, the system falls back to a static dataset of 10 curated events. Crucially, **the mocks use the exact same field structure as the Linda API response** — meaning they flow through the identical `normalizeRecord()` pipeline. There are zero hardcoded URLs in the mock data; all links are dynamically generated at normalization time.

```js
try {
  ({ records, live } = await extractFromLinda());
} catch (apiErr) {
  records = MOCK_RECORDS; // same schema as Linda → same normalizer → same output shape
  live    = false;
}
const events = records.map(normalizeRecord); // single code path for all data sources
```

---

## ✨ Key Features

- **🔍 Combinable Filters** — Filter events simultaneously by category (Musical, Deportivo, Cultural, Gastronomía), neighborhood/zone, and date range (Today / This week / This month)
- **📅 Google Calendar Integration** — One-click "Add to Calendar" button on each event card generates a pre-filled Google Calendar URL with event title, date, and location
- **🔗 Dynamic Event Links** — Every "Go to event" link resolves to the correct canonical URL on the Linda portal, built from the normalized slug
- **🛡️ Resilient Data Layer** — Live API → mock fallback chain ensures the app never shows an empty state, with a `DataSourceBanner` component that transparently communicates the data status to the user
- **📱 Fully Responsive** — Mobile-first layout built with Tailwind CSS, tested across viewport sizes
- **⚡ Edge Cached** — Vercel's `s-maxage=300, stale-while-revalidate=600` cache headers minimize cold start latency on the serverless function

---

## 📦 Installation & Local Development

### Prerequisites

- **Node.js** ≥ 18
- **Vercel CLI** (required to run serverless functions locally)

```bash
npm install -g vercel
```

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-username/evego.git
cd evego

# 2. Install dependencies
npm install

# 3. Authenticate with Vercel (first time only)
vercel login
```

### Running Locally

> ⚠️ Use `vercel dev` instead of `npm run dev`. Vite alone cannot execute the `/api/*` serverless functions — Vercel Dev acts as the outer router, forwarding API requests to Node.js and all other traffic to the Vite dev server.

```bash
vercel dev
# → Frontend available at http://localhost:3000
# → GET /api/events  executes api/events.js in Node.js
```

If you only run `npm run dev`, the app will start correctly but will display mock data (the Linda API call will 404 since Vite doesn't handle the `/api` routes). This is the expected behavior and is communicated to the user via the `DataSourceBanner` component.

### Production Build

```bash
npm run build
# Output: dist/ (static assets for Vercel deployment)
```

### Deployment

```bash
vercel --prod
```

Vercel auto-detects:
- `/api/*.js` files as Node.js Serverless Functions
- `dist/` (after build) as the static frontend

---

## 📁 Project Structure

```
EvenGo/
├── api/
│   ├── events.js          # GET /api/events — main endpoint (Linda API + mock fallback)
│   └── sync-gcba.js       # GET /api/sync-gcba — standalone ETL trigger (cron/manual)
├── src/
│   ├── components/
│   │   ├── EventCard.jsx        # Event card with Calendar button
│   │   ├── FilterPanel.jsx      # Combinable filters UI
│   │   ├── DataSourceBanner.jsx # Live/mock/error status indicator
│   │   └── Navbar.jsx
│   ├── hooks/
│   │   └── useEvents.js         # Data fetching + filter logic
│   ├── services/
│   │   └── evengoService.js     # Fetch client with Content-Type guard
│   ├── data/
│   │   └── events.js            # Frontend mock fallback (used when /api/events 404s)
│   └── utils/
│       └── calendarUtils.js     # Google Calendar URL builder
├── vercel.json            # SPA rewrite rule (api/* auto-detected by Vercel)
├── vite.config.js         # No proxy config — Vercel Dev handles /api routing
└── .env                   # Environment variables (not committed)
```

---

## 🔒 Environment Variables

No API keys required — the Linda API is publicly accessible without authentication.

```env
# .env (example — currently empty, reserved for future integrations)
# VITE_SOME_FUTURE_KEY=...
```

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss the proposed modification.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ for Buenos Aires · Data sourced from <a href="https://linda.buenosaires.gob.ar">linda.buenosaires.gob.ar</a>
</p>
