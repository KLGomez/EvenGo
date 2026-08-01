// ─────────────────────────────────────────────────────────────────────────────
// api/sync-gcba.js  —  ETL: Datos Abiertos Buenos Aires → EvenGo Schema
// ─────────────────────────────────────────────────────────────────────────────
//
// Pipeline ETL (Extract → Transform → Load):
//
//   EXTRACT   → fetch a la API CKAN del GCBA
//               https://data.buenosaires.gob.ar/api/3/action/datastore_search
//               Dataset: "Actividades Culturales"
//               Resource ID: fe5ba957-f331-42b1-b3f4-a56b8f50268a
//
//   TRANSFORM → classifyCategory() + normalizeRecord()
//               Mapea campos GCBA → schema EvenGo
//
//   LOAD      → en el futuro: INSERT en base de datos
//               Por ahora: devuelve el array normalizado en memoria
//
// Endpoint de trigger (GET /api/sync-gcba):
//   Útil para correr la sincronización manualmente o via cron de Vercel.
//
// ─────────────────────────────────────────────────────────────────────────────

// ── Configuración CKAN ────────────────────────────────────────────────────────

const GCBA_CKAN_BASE = 'https://data.buenosaires.gob.ar/api/3/action';

/**
 * Resource IDs del portal de Datos Abiertos GCBA.
 * Fuente: https://data.buenosaires.gob.ar/dataset/actividades-culturales
 * Se intentan en orden hasta encontrar uno con registros en el datastore.
 */
const GCBA_RESOURCE_IDS = [
  'fe5ba957-f331-42b1-b3f4-a56b8f50268a', // Actividades Culturales 2022 (CSV)
  'c225fdbb-f828-42d9-965d-5f3ee6d83481', // Actividades Culturales 2021 (CSV)
  'e8e2051f-a1bc-4c45-8ece-8c107a1fcb82', // Actividades Culturales 2020 (CSV)
  '423e35ec-489b-4703-8852-faf262c014e7', // Actividades Culturales 2019 (CSV)
];

// ── Clasificador de categorías por palabras clave ─────────────────────────────

/**
 * Reglas de clasificación automática.
 * Se evalúan en orden; la primera que coincida gana.
 * El texto analizado es la concatenación de título + descripción + categoría GCBA.
 */
const CLASSIFICATION_RULES = [
  {
    category: 'Musical',
    keywords: [
      'música', 'musica', 'concierto', 'recital', 'jazz', 'rock', 'tango',
      'cumbia', 'folklore', 'folclore', 'orquesta', 'banda', 'cantante',
      'festival musical', 'show musical', 'música en vivo', 'musica en vivo',
      'presentación musical', 'presentacion musical',
    ],
  },
  {
    category: 'Deportivo',
    keywords: [
      'deporte', 'deportivo', 'fútbol', 'futbol', 'tenis', 'maratón', 'maraton',
      'carrera', 'atletismo', 'natación', 'natacion', 'básquet', 'basquet',
      'vóley', 'voley', 'torneo', 'campeonato', 'competencia deportiva',
      'polideportivo', 'fitness', 'running', 'ciclismo', 'yoga',
    ],
  },
  {
    category: 'Gastronomía',
    keywords: [
      'gastronomía', 'gastronomia', 'gastronómica', 'gastronomica',
      'feria de comida', 'food', 'culinaria', 'culinario', 'chef',
      'cocina', 'degustación', 'degustacion', 'vinos', 'cerveza artesanal',
      'mercado de alimentos', 'food truck',
    ],
  },
  // Sin coincidencia → 'Cultural' (default)
];

/**
 * Clasifica un evento en las categorías de EvenGo según palabras clave.
 *
 * @param {string} searchText - Texto libre a analizar (título + descripción + cat GCBA)
 * @returns {'Musical'|'Deportivo'|'Gastronomía'|'Cultural'}
 */
function classifyCategory(searchText) {
  const lower = (searchText || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const rule of CLASSIFICATION_RULES) {
    // Normalizar keywords también para comparación robusta
    const hasMatch = rule.keywords.some((kw) => {
      const kwNorm = kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return lower.includes(kwNorm);
    });
    if (hasMatch) return rule.category;
  }

  return 'Cultural';
}

// ── Mock de estructura GCBA ───────────────────────────────────────────────────

/**
 * Datos de ejemplo con la estructura real del GCBA CKAN.
 * Se usan como fallback cuando la API no está disponible.
 * Los campos replican exactamente los del dataset "Actividades Culturales".
 */
const GCBA_MOCK_RECORDS = [
  {
    _id: 1001,
    nombre_actividad: 'Concierto de Tango en el Obelisco',
    descripcion: 'Gran show de tango al aire libre en el corazón de Buenos Aires. Artistas consagrados del género rioplatense se presentan de forma gratuita.',
    categoria: 'Música en vivo',
    subcategoria: 'Tango',
    fecha_inicio: '2026-08-02',
    fecha_fin: '2026-08-02',
    hora_inicio: '19:00',
    domicilio: 'Av. 9 de Julio y Av. Corrientes',
    barrio: 'Obelisco / Centro',
    comuna: '1',
    lat: '-34.6037',
    lng: '-58.3816',
    url: 'https://www.buenosaires.gob.ar/actividades/concierto-tango-obelisco',
    organismo: 'Ministerio de Cultura GCBA',
    gratuito: 'Si',
  },
  {
    _id: 1002,
    nombre_actividad: 'Feria Gastronómica de Palermo',
    descripcion: 'Más de 50 puestos con lo mejor de la cocina porteña, fusión latinoamericana y street food artesanal. Entrada libre y gratuita.',
    categoria: 'Gastronomía',
    subcategoria: 'Feria de comida',
    fecha_inicio: '2026-08-08',
    fecha_fin: '2026-08-09',
    hora_inicio: '12:00',
    domicilio: 'Av. del Libertador 2373',
    barrio: 'Palermo',
    comuna: '14',
    lat: '-34.5808',
    lng: '-58.4175',
    url: 'https://www.buenosaires.gob.ar/actividades/feria-gastronomica-palermo',
    organismo: 'Secretaría de Desarrollo Económico GCBA',
    gratuito: 'Si',
  },
  {
    _id: 1003,
    nombre_actividad: 'Maratón Solidaria del Gobierno de la Ciudad',
    descripcion: 'Carrera de 5 y 10 km a beneficio de comedores comunitarios de Buenos Aires. Abierta a corredores de todos los niveles.',
    categoria: 'Deportivo',
    subcategoria: 'Carrera',
    fecha_inicio: '2026-08-15',
    fecha_fin: '2026-08-15',
    hora_inicio: '08:00',
    domicilio: 'Av. Figueroa Alcorta 2461',
    barrio: 'Palermo',
    comuna: '14',
    lat: '-34.5731',
    lng: '-58.4180',
    url: 'https://www.buenosaires.gob.ar/actividades/maraton-solidaria-gcba',
    organismo: 'Secretaría de Deportes GCBA',
    gratuito: 'Si',
  },
  {
    _id: 1004,
    nombre_actividad: 'Exposición Arte Contemporáneo BA',
    descripcion: 'Muestra de artistas plásticos emergentes de Buenos Aires. Pinturas, esculturas e instalaciones en diálogo con el espacio público urbano.',
    categoria: 'Artes visuales',
    subcategoria: 'Exposición',
    fecha_inicio: '2026-08-05',
    fecha_fin: '2026-08-20',
    hora_inicio: '14:00',
    domicilio: 'Defensa 1575',
    barrio: 'San Telmo',
    comuna: '1',
    lat: '-34.6270',
    lng: '-58.3695',
    url: 'https://www.buenosaires.gob.ar/actividades/exposicion-arte-contemporaneo',
    organismo: 'Ministerio de Cultura GCBA',
    gratuito: 'Si',
  },
  {
    _id: 1005,
    nombre_actividad: 'Festival de Jazz en La Boca',
    descripcion: 'Dos noches de jazz y blues al aire libre en el barrio de La Boca. Músicos locales e internacionales en escenas simultáneas.',
    categoria: 'Música en vivo',
    subcategoria: 'Jazz',
    fecha_inicio: '2026-08-22',
    fecha_fin: '2026-08-23',
    hora_inicio: '20:00',
    domicilio: 'Caminito 100',
    barrio: 'La Boca',
    comuna: '4',
    lat: '-34.6365',
    lng: '-58.3633',
    url: 'https://www.buenosaires.gob.ar/actividades/festival-jazz-la-boca',
    organismo: 'Ministerio de Cultura GCBA',
    gratuito: 'Si',
  },
  {
    _id: 1006,
    nombre_actividad: 'Ciclo de Cine Gratuito en Parques',
    descripcion: 'Proyecciones al aire libre de cine argentino clásico y contemporáneo en los principales parques de la Ciudad. Ideal para toda la familia.',
    categoria: 'Cine',
    subcategoria: 'Ciclo de cine',
    fecha_inicio: '2026-08-12',
    fecha_fin: '2026-08-12',
    hora_inicio: '21:00',
    domicilio: 'Av. Infanta Isabel 410',
    barrio: 'Palermo',
    comuna: '14',
    lat: '-34.5801',
    lng: '-58.4163',
    url: 'https://www.buenosaires.gob.ar/actividades/cine-parques-gcba',
    organismo: 'Ministerio de Cultura GCBA',
    gratuito: 'Si',
  },
  {
    _id: 1007,
    nombre_actividad: 'Taller de Cocina Saludable',
    descripcion: 'Taller gratuito de cocina plant-based y alimentación saludable. Dictado por nutricionistas y chefs especializados del GCBA.',
    categoria: 'Gastronomía',
    subcategoria: 'Taller culinario',
    fecha_inicio: '2026-08-19',
    fecha_fin: '2026-08-19',
    hora_inicio: '10:30',
    domicilio: 'Av. Corrientes 1530',
    barrio: 'Obelisco / Centro',
    comuna: '3',
    lat: '-34.6038',
    lng: '-58.3853',
    url: 'https://www.buenosaires.gob.ar/actividades/taller-cocina-saludable',
    organismo: 'Ministerio de Salud GCBA',
    gratuito: 'Si',
  },
  {
    _id: 1008,
    nombre_actividad: 'Torneo de Ajedrez Abierto de la Ciudad',
    descripcion: 'Torneo con sistema suizo de 7 rondas, abierto a todas las categorías. Premios para los tres primeros de cada rama (infantil, juvenil, adulto).',
    categoria: 'Deportivo',
    subcategoria: 'Ajedrez',
    fecha_inicio: '2026-08-29',
    fecha_fin: '2026-08-30',
    hora_inicio: '10:00',
    domicilio: 'Juramento 1400',
    barrio: 'Belgrano',
    comuna: '13',
    lat: '-34.5595',
    lng: '-58.4524',
    url: 'https://www.buenosaires.gob.ar/actividades/torneo-ajedrez-ciudad',
    organismo: 'Secretaría de Deportes GCBA',
    gratuito: 'Si',
  },
  {
    _id: 1009,
    nombre_actividad: 'Recital Rock Nacional en el Anfiteatro',
    descripcion: 'Noche de rock argentino con las bandas emergentes más destacadas del año. Grilla de 4 bandas con apertura de puertas a las 18 hs.',
    categoria: 'Música en vivo',
    subcategoria: 'Rock',
    fecha_inicio: '2026-08-28',
    fecha_fin: '2026-08-28',
    hora_inicio: '19:00',
    domicilio: 'Av. Sarmiento s/n, Parque Centenario',
    barrio: 'Palermo',
    comuna: '6',
    lat: '-34.6063',
    lng: '-58.4370',
    url: 'https://www.buenosaires.gob.ar/actividades/recital-rock-anfiteatro',
    organismo: 'Ministerio de Cultura GCBA',
    gratuito: 'Si',
  },
  {
    _id: 1010,
    nombre_actividad: 'Semana de la Danza Contemporánea',
    descripcion: 'Semana con funciones gratuitas de danza contemporánea, clásica y urbana. Compañías de danza de todo el país visitan Buenos Aires.',
    categoria: 'Danza',
    subcategoria: 'Danza contemporánea',
    fecha_inicio: '2026-08-10',
    fecha_fin: '2026-08-16',
    hora_inicio: '20:00',
    domicilio: 'Av. Corrientes 1530',
    barrio: 'Obelisco / Centro',
    comuna: '3',
    lat: '-34.6038',
    lng: '-58.3853',
    url: 'https://www.buenosaires.gob.ar/actividades/semana-danza-contemporanea',
    organismo: 'Ministerio de Cultura GCBA',
    gratuito: 'Si',
  },
];

// ── TRANSFORM: Normaliza un registro GCBA al schema de EvenGo ─────────────────

/**
 * Transforma un registro crudo del GCBA al schema normalizado de EvenGo.
 *
 * Schema de salida (EvenGo DB schema):
 * @typedef {Object} EvenGoEvent
 * @property {string}  id       - ID único (del GCBA o generado)
 * @property {string}  title    - Título del evento
 * @property {string}  category - 'Musical' | 'Deportivo' | 'Cultural' | 'Gastronomía'
 * @property {string}  date     - Fecha ISO: "YYYY-MM-DD"
 * @property {string}  time     - Hora: "HH:MM"
 * @property {string}  location - Barrio o zona de Buenos Aires
 * @property {string}  address  - Dirección completa
 * @property {string}  description - Descripción del evento
 * @property {string}  url      - URL del evento en el portal GCBA
 * @property {'GCBA'}  source   - Fuente de datos (siempre 'GCBA')
 *
 * @param {Object} record - Registro crudo del GCBA CKAN
 * @param {number} index  - Índice en el array (para generar ID si falta)
 * @returns {EvenGoEvent}
 */
function normalizeRecord(record, index) {
  // El texto de búsqueda para clasificación combina todos los campos textuales
  const searchText = [
    record.nombre_actividad,
    record.descripcion,
    record.categoria,
    record.subcategoria,
  ].filter(Boolean).join(' ');

  // ID: usar _id del GCBA o generar uno basado en el índice
  const id = record._id != null
    ? `gcba-${record._id}`
    : `gcba-gen-${Date.now()}-${index}`;

  // Fecha: preferir fecha_inicio, fallback a fecha_desde
  const date = record.fecha_inicio || record.fecha_desde || '';

  // Hora: preferir hora_inicio, extraer de fecha si incluye hora
  const time = record.hora_inicio
    ? record.hora_inicio.slice(0, 5)  // "HH:MM:SS" → "HH:MM"
    : '00:00';

  // Ubicación mapeada a zonas conocidas de EvenGo
  const location = normalizeLocation(record.barrio || record.domicilio || '');

  // Título extraído a variable para reutilizarlo en la URL dinámica
  const title = record.nombre_actividad || record.nombre || 'Actividad sin título';

  return {
    id,
    title,
    description: record.descripcion || '',
    category:    classifyCategory(searchText),
    date,
    time,
    location,
    address:     record.domicilio || location,
    // Usa la URL original solo si ya apunta al nuevo dominio 'Linda'.
    // En cualquier otro caso (rota, obsoleta o ausente), construye el enlace dinámico.
    url: (record.url && record.url.includes('linda.buenosaires.gob.ar'))
      ? record.url
      : `https://linda.buenosaires.gob.ar/eventos?q=${encodeURIComponent(title)}`,
    source:      'GCBA',   // campo estático requerido por el schema
  };
}

/**
 * Mapea el barrio GCBA a las zonas conocidas del sistema de filtros de EvenGo.
 * Si no coincide con ninguna zona registrada, retorna el barrio original.
 *
 * @param {string} barrio
 * @returns {string}
 */
function normalizeLocation(barrio) {
  const b = (barrio || '').toLowerCase();
  if (b.includes('palermo'))                                        return 'Palermo';
  if (b.includes('san telmo') || b.includes('san pedro gonzalez')) return 'San Telmo';
  if (b.includes('quilmes'))                                        return 'Quilmes';
  if (b.includes('obelisco') || b.includes('centro') ||
      b.includes('montserrat') || b.includes('retiro') ||
      b.includes('av. corrientes') || b.includes('9 de julio'))    return 'Obelisco / Centro';
  if (b.includes('la boca') || b.includes('boca'))                 return 'La Boca';
  if (b.includes('belgrano'))                                       return 'Belgrano';
  return barrio || 'Buenos Aires';
}

// ── EXTRACT: Fetch al CKAN del GCBA ──────────────────────────────────────────

/**
 * Intenta obtener datos del GCBA CKAN.
 * Prueba cada Resource ID en orden hasta encontrar uno con registros.
 *
 * @returns {Promise<Object[]>} Array de registros crudos del GCBA
 * @throws {Error} Si todos los resource IDs fallan
 */
async function extractFromGCBA() {
  const errors = [];

  for (const resourceId of GCBA_RESOURCE_IDS) {
    try {
      const url = `${GCBA_CKAN_BASE}/datastore_search?resource_id=${resourceId}&limit=50&sort=fecha_inicio+desc`;
      console.log(`[EvenGo/sync-gcba] Intentando resource ID: ${resourceId}`);

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000), // timeout de 8s por intento
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(`CKAN error: ${JSON.stringify(data.error)}`);
      }

      const records = data.result?.records ?? [];
      if (records.length === 0) {
        throw new Error('Dataset sin registros en el datastore');
      }

      console.log(`[EvenGo/sync-gcba] ✅ ${records.length} registros obtenidos (resource: ${resourceId})`);
      return records;
    } catch (err) {
      console.warn(`[EvenGo/sync-gcba] ⚠️  Resource ${resourceId} falló: ${err.message}`);
      errors.push(err.message);
    }
  }

  throw new Error(`Todos los resource IDs fallaron: ${errors.join(' | ')}`);
}

// ── Función principal ETL (export para api/events.js) ────────────────────────

/**
 * Pipeline ETL completo: extrae datos del GCBA, los transforma y devuelve
 * el array normalizado listo para servir al frontend o persistir en DB.
 *
 * Estrategia de resilencia:
 *  1. Intenta fetch real a la API CKAN del GCBA
 *  2. Si falla (API caída, resource sin datastore, timeout) → usa mock data
 *     con la misma estructura de campos GCBA para garantizar continuidad
 *
 * @returns {Promise<EvenGoEvent[]>}
 */
export async function fetchAndTransformGCBA() {
  let rawRecords;
  let fromMock = false;

  try {
    rawRecords = await extractFromGCBA();
  } catch (err) {
    console.warn(
      `[EvenGo/sync-gcba] API GCBA no disponible (${err.message}). ` +
      'Usando datos de ejemplo con estructura real GCBA.'
    );
    rawRecords = GCBA_MOCK_RECORDS;
    fromMock = true;
  }

  const events = rawRecords.map(normalizeRecord);

  console.log(
    `[EvenGo/sync-gcba] Pipeline completado: ${events.length} eventos normalizados` +
    (fromMock ? ' [mock]' : ' [GCBA live]')
  );

  return events;
}

// ── Handler del endpoint GET /api/sync-gcba ───────────────────────────────────

/**
 * Vercel Serverless Function — GET /api/sync-gcba
 *
 * Trigger manual o automático (cron) del pipeline ETL.
 * En el futuro, aquí se persistirán los resultados en la base de datos
 * antes de devolverlos al cliente.
 *
 * @param {import('@vercel/node').VercelRequest}  req
 * @param {import('@vercel/node').VercelResponse} res
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed. Use GET.' });
  }

  try {
    const events = await fetchAndTransformGCBA();

    return res.status(200).json({
      success: true,
      message: `Sync completado: ${events.length} eventos normalizados`,
      total: events.length,
      // TODO: cuando se integre la DB, este campo indicará cuántos se insertaron
      inserted: 0,
      events, // preview de los datos sincronizados
    });
  } catch (err) {
    console.error('[EvenGo/sync-gcba] Error crítico en pipeline ETL:', err);
    return res.status(500).json({
      success: false,
      error: 'Error en el pipeline ETL del GCBA',
      detail: err.message,
    });
  }
}
