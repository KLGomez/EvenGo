// ─────────────────────────────────────────────────────────────────────────────
// ticketmasterService.js — Servicio de Ticketmaster Discovery API para EvenGo
// ─────────────────────────────────────────────────────────────────────────────
//
// ✅ SIN PROXY: Ticketmaster soporta CORS nativamente. El browser hace la
//    petición directa a app.ticketmaster.com con la apikey como query param.
//
// Flujo:
//   fetch('https://app.ticketmaster.com/discovery/v2/events.json?apikey=...&city=Buenos Aires&countryCode=AR')
//        │
//        ▼ Respuesta con shape:
//   {
//     _embedded: {
//       events: [
//         {
//           id, name, url, info,
//           dates: { start: { localDate, localTime } },
//           classifications: [{ segment: { name }, genre: { name } }],
//           _embedded: {
//             venues: [{ name, city: { name }, address: { line1 } }]
//           }
//         }
//       ]
//     },
//     page: { totalElements, totalPages, size, number }
//   }
//
// Documentación oficial: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
// ─────────────────────────────────────────────────────────────────────────────

/** Endpoint base de la Discovery API de Ticketmaster */
const TM_BASE_URL = 'https://app.ticketmaster.com/discovery/v2/events.json';

// ── Mapa de segmentos de Ticketmaster → categorías internas de EvenGo ─────────
//
// Ticketmaster usa "segmentos" como clasificación de primer nivel.
// Ref: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/#srch-events-v2
//
const SEGMENT_CATEGORY_MAP = {
  'Music':           'Musical',
  'Sports':          'Deportivo',
  'Arts & Theatre':  'Cultural',
  'Film':            'Cultural',
  'Miscellaneous':   'Cultural',
  'Undefined':       'Cultural',
};

// ── Mapper ────────────────────────────────────────────────────────────────────

/**
 * Adapta un evento crudo de Ticketmaster al modelo de datos de EvenGo,
 * compatible con EventCard, los filtros y el generador de URL de Google Calendar.
 *
 * Campos de entrada (Ticketmaster event object):
 *   raw.id                            → ID único
 *   raw.name                          → título del evento
 *   raw.info                          → descripción larga (puede ser undefined)
 *   raw.url                           → URL del evento en Ticketmaster
 *   raw.dates.start.localDate         → "YYYY-MM-DD"
 *   raw.dates.start.localTime         → "HH:MM:SS" (puede ser undefined = TBA)
 *   raw.classifications[0].segment.name → segmento (Music, Sports, Arts & Theatre…)
 *   raw.classifications[0].genre.name → género (Rock, Pop, Football…)
 *   raw._embedded.venues[0].name      → nombre del venue
 *   raw._embedded.venues[0].city.name → ciudad
 *   raw._embedded.venues[0].address.line1 → dirección línea 1
 *
 * @param {Object} raw - Evento crudo de Ticketmaster
 * @returns {{
 *   id: string,
 *   title: string,
 *   description: string,
 *   category: 'Musical'|'Deportivo'|'Cultural'|'Gastronomía',
 *   date: string,
 *   time: string,
 *   location: string,
 *   address: string,
 *   url: string
 * }}
 */
export function mapTicketmasterEvent(raw) {
  // Clasificación → categoría interna
  const segmentName = raw.classifications?.[0]?.segment?.name ?? 'Undefined';
  const category = SEGMENT_CATEGORY_MAP[segmentName] ?? 'Cultural';

  // Tiempo: localTime tiene formato "HH:MM:SS", tomamos solo "HH:MM"
  // Si no hay hora definida (TBA), mostramos 'TBD'
  const rawTime = raw.dates?.start?.localTime;
  const time = rawTime ? rawTime.slice(0, 5) : 'TBD';

  // Venue: primer venue del array (siempre presente en eventos con venue físico)
  const venue = raw._embedded?.venues?.[0];
  const location = venue?.name ?? venue?.city?.name ?? 'Buenos Aires';
  const address = [venue?.address?.line1, venue?.city?.name]
    .filter(Boolean)
    .join(', ');

  return {
    id:          raw.id,
    title:       raw.name ?? 'Evento sin título',
    // info puede no existir — se retorna string vacío como especificó el usuario
    description: raw.info ?? '',
    category,
    date:        raw.dates?.start?.localDate ?? '',
    time,
    location,
    address,
    url:         raw.url ?? '#',
  };
}

// ── Función de fetch ──────────────────────────────────────────────────────────

/**
 * Busca eventos en Buenos Aires usando la Discovery API de Ticketmaster.
 *
 * La API soporta CORS nativamente, no requiere proxy.
 * La clave se pasa como query parameter `apikey` (nunca como header).
 *
 * Parámetros obligatorios: city=Buenos Aires, countryCode=AR
 * La API key proviene de import.meta.env.VITE_TICKETMASTER_KEY (.env)
 *
 * @returns {Promise<Array>} Array de eventos en formato EvenGo
 * @throws {Error} Con mensaje descriptivo para el DataSourceBanner
 */
export async function fetchTicketmasterEvents() {
  const apiKey = import.meta.env.VITE_TICKETMASTER_KEY;

  if (!apiKey) {
    throw new Error(
      'VITE_TICKETMASTER_KEY no está configurado. ' +
      'Verificá que el archivo .env contenga tu clave de Ticketmaster Developer.'
    );
  }

  const params = new URLSearchParams({
    apikey:      apiKey,
    city:        'Buenos Aires',
    countryCode: 'AR',
    locale:      '*',        // incluye todos los idiomas/regiones
    size:        '50',       // máximo de resultados por página
    sort:        'date,asc', // ordenar por fecha ascendente
  });

  const url = `${TM_BASE_URL}?${params.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      // Ticketmaster no requiere headers adicionales — la auth va en el query param
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const reason =
      errorBody?.fault?.faultstring ||
      errorBody?.errors?.[0]?.detail ||
      response.statusText;

    if (response.status === 401) {
      throw new Error(
        `API key de Ticketmaster inválida (401). Verificá VITE_TICKETMASTER_KEY en .env.`
      );
    }

    if (response.status === 429) {
      throw new Error(
        'Límite de peticiones de Ticketmaster alcanzado (429). ' +
        'El plan gratuito permite 5.000 req/día y 5 req/segundo.'
      );
    }

    throw new Error(`Ticketmaster ${response.status}: ${reason}`);
  }

  const data = await response.json();

  // La respuesta puede no tener _embedded si no hay resultados
  const rawEvents = data._embedded?.events ?? [];

  return rawEvents.map(mapTicketmasterEvent);
}
