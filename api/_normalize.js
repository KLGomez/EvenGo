// api/_normalize.js — Módulo compartido de normalización de eventos Linda
//
// Exporta las funciones de transformación del schema crudo de Linda al schema
// EvenGo. Importado por api/events.js (endpoint público) y api/chat.js
// (searchEvents del agente) para garantizar que ambos hablen el mismo idioma
// y no diverjan cuando Linda cambia su schema.
//
// Exports:
//   normalizeRecord(event)              → EvenGoEvent
//   classifyCategory(etiquetas, tipo)   → 'Musical'|'Deportivo'|'Gastronomía'|'Cultural'
//   normalizeLocation(barrio, ubicacion)→ string legible
//   stripHtml(html)                     → string plano

export const LINDA_BASE = 'https://linda.buenosaires.gob.ar';

// ─── Clasificador de categorías (desde etiquetas de Linda) ────────────────────

const CLASSIFICATION_RULES = [
  {
    category: 'Musical',
    keywords: [
      'música', 'musica', 'concierto', 'recital', 'jazz', 'rock', 'tango',
      'cumbia', 'folklore', 'folclore', 'orquesta', 'banda', 'cantante',
      'música y shows', 'musica y shows', 'show',
    ],
  },
  {
    category: 'Deportivo',
    keywords: [
      'deporte', 'deportivo', 'fútbol', 'futbol', 'tenis', 'maratón', 'maraton',
      'carrera', 'atletismo', 'natación', 'natacion', 'básquet', 'basquet',
      'vóley', 'voley', 'torneo', 'campeonato', 'running', 'ciclismo', 'yoga',
      'deportes', 'fitness',
    ],
  },
  {
    category: 'Gastronomía',
    keywords: [
      'gastronomía', 'gastronomia', 'gastronómica', 'gastronomica',
      'feria de comida', 'food', 'culinaria', 'culinario', 'chef',
      'cocina', 'degustación', 'degustacion', 'vinos', 'cerveza artesanal',
      'ferias y exposiciones',
    ],
  },
];

// ─── Mapa de barrios (snake_case de Linda → nombre legible) ──────────────────

const BARRIO_MAP = {
  palermo:       'Palermo',
  san_telmo:     'San Telmo',
  quilmes:       'Quilmes',
  montserrat:    'Obelisco / Centro',
  san_nicolas:   'Obelisco / Centro',
  retiro:        'Obelisco / Centro',
  la_boca:       'La Boca',
  belgrano:      'Belgrano',
  caballito:     'Caballito',
  almagro:       'Almagro',
  villa_crespo:  'Villa Crespo',
  recoleta:      'Recoleta',
  puerto_madero: 'Puerto Madero',
  san_cristobal: 'San Cristóbal',
  floresta:      'Floresta',
  flores:        'Flores',
};

// ─── Funciones exportadas ─────────────────────────────────────────────────────

/**
 * Clasifica el evento usando las etiquetas propias de Linda.
 * @param {string[]} etiquetas  - Array de tags del evento
 * @param {string}   tipoEvento - Campo tipoEvento del evento
 * @returns {'Musical'|'Deportivo'|'Gastronomía'|'Cultural'}
 */
export function classifyCategory(etiquetas = [], tipoEvento = '') {
  const searchText = [...etiquetas, tipoEvento]
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  for (const rule of CLASSIFICATION_RULES) {
    const match = rule.keywords.some((kw) => {
      const kwNorm = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return searchText.includes(kwNorm);
    });
    if (match) return rule.category;
  }
  return 'Cultural';
}

/**
 * Mapea el campo `barrio` (snake_case) de Linda a nombre legible de zona.
 * @param {string} barrio    - Ej: "villa_crespo", "palermo"
 * @param {Object} ubicacion - Objeto ubicacion del evento
 * @returns {string}
 */
export function normalizeLocation(barrio = '', ubicacion = {}) {
  if (BARRIO_MAP[barrio]) return BARRIO_MAP[barrio];
  return ubicacion?.titulo || ubicacion?.direccion || 'Buenos Aires';
}

/**
 * Elimina tags HTML de la descripción para devolver texto plano.
 * @param {string} html
 * @returns {string}
 */
export function stripHtml(html = '') {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Transforma un evento crudo de la API de Linda al schema EvenGo.
 *
 * Linda field      → EvenGo field
 * ─────────────────────────────────────────────────────
 * id               → id  (UUID nativo)
 * title            → title
 * description      → description  (HTML stripeado, máx 280 chars)
 * imageUrl         → image  (fallback a imagenes[0])
 * fechaInicio      → date  ("YYYY-MM-DD")
 * horarios[0].hora → time  ("HH:MM")
 * ubicacion+barrio → location  (nombre legible vía BARRIO_MAP)
 * direccion        → address
 * etiquetas        → category  (clasificador propio)
 * pathAlias/slug   → url  (linda.buenosaires.gob.ar/eventos/:slug)
 * id               → anchorLink  (#event-{id})
 *
 * @param {Object} event - Objeto crudo de la API de Linda
 * @returns {EvenGoEvent}
 */
export function normalizeRecord(event) {
  // ── ID ──────────────────────────────────────────────────────────────────────
  const id = event.id || String(event.drupalNid) || `linda-${Date.now()}`;

  // ── Título ──────────────────────────────────────────────────────────────────
  const title = (event.title || 'Actividad sin título').trim();

  // ── Descripción: usa description principal, con fallback al primer componente
  const rawDesc = event.description || event.componentes?.[0] || '';
  const description = stripHtml(rawDesc).slice(0, 280);

  // ── Imagen ──────────────────────────────────────────────────────────────────
  const image = event.imageUrl || event.imagenes?.[0] || '';

  // ── Fecha ───────────────────────────────────────────────────────────────────
  const date = event.fechaInicio ? event.fechaInicio.slice(0, 10) : '';

  // ── Hora: primer horario disponible, con fallback UTC→local (-3h Argentina) ─
  let time = '00:00';
  if (event.horarios?.length > 0 && event.horarios[0].hora) {
    time = event.horarios[0].hora.slice(0, 5);
  } else if (event.horario) {
    time = String(event.horario).slice(0, 5);
  } else if (event.fechaInicio) {
    const utcHour = parseInt(event.fechaInicio.slice(11, 13), 10);
    const localHour = ((utcHour - 3) + 24) % 24;
    time = `${String(localHour).padStart(2, '0')}:${event.fechaInicio.slice(14, 16)}`;
  }

  // ── Ubicación y dirección ───────────────────────────────────────────────────
  const location = normalizeLocation(event.barrio, event.ubicacion);
  const address  = event.direccion || event.ubicacion?.direccion || location;

  // ── URL y anchorLink ────────────────────────────────────────────────────────
  const slug       = (event.pathAlias || event.slug || id).split('/').filter(Boolean).pop();
  const url        = `${LINDA_BASE}/eventos/${slug}`;
  const anchorLink = `#event-${id}`;

  // ── Categoría ───────────────────────────────────────────────────────────────
  const category = classifyCategory(event.etiquetas, event.tipoEvento);

  // ── Precio ──────────────────────────────────────────────────────────────────
  const precio = event.acceso === 'sin_costo' ? 'Gratuito' : (event.precio || null);

  return {
    id,
    title,
    description,
    image,
    date,
    time,
    location,
    address,
    url,
    anchorLink,
    category,
    source: 'LINDA',
    precio,
    barrio: event.barrio || null,
  };
}
