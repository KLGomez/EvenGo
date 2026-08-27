// Vercel Serverless Function: GET /api/events
// Fuente: API interna de Linda — portal cultural del GCBA
// Endpoint: https://linda.buenosaires.gob.ar/api/frontend/events/filter
//
// Schema de respuesta de Linda:
// {
//   filters:    { ... },
//   events:     [ { id, title, description, imageUrl, fechaInicio, fechaFin,
//                   precio, direccion, horario, etiquetas, ubicacion,
//                   imagenes, pathAlias, barrio, slug, horarios, ... } ],
//   pagination: { page, limit, total, totalPages }
// }

import { getCached, setCached } from './_cache.js';
import { normalizeRecord } from './_normalize.js';

// ─── Configuración ────────────────────────────────────────────────────────────

const LINDA_API = 'https://linda.buenosaires.gob.ar/api/frontend/events/filter';
const FETCH_LIMIT = 200;

// TTL del caché en milisegundos (10 minutos).
const EVENTS_CACHE_TTL = 10 * 60 * 1000;
const EVENTS_CACHE_KEY = 'linda-events';



/**
 * Obtiene los eventos desde la nueva API de Linda (portal cultural GCBA).
 * Wrapper de respuesta: { events: [...], pagination: {...}, filters: {...} }
 *
 * @returns {Promise<{ records: Object[], live: boolean }>}
 */
async function extractFromLinda() {
  const url = `${LINDA_API}?limit=${FETCH_LIMIT}`;

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`Linda API HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();

  // El wrapper real de Linda es { events: [...], pagination, filters }
  const records =
    data.events   ??  // estructura real confirmada
    data.items    ??  // por si cambia en el futuro
    data.data     ??  // fallback genérico
    [];

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("Linda API respondió sin eventos en el array");
  }

  console.log(`[events] Linda live: ${records.length} eventos (total API: ${data.pagination?.total ?? "?"})`);
  return { records, live: true };
}

// ─── Mock con estructura real de Linda (fallback cuando la API falla) ─────────
// Los mocks replican exactamente los campos de la API de Linda para que
// normalizeRecord() los procese de forma idéntica a los datos en vivo.

const MOCK_RECORDS = [
  { id: "mock-1001", title: "Concierto de Tango en el Obelisco",       description: "<p>Gran show de tango al aire libre en el corazón de Buenos Aires. Artistas consagrados del género rioplatense.</p>",   imageUrl: "", fechaInicio: "2026-08-02T22:00:00.000Z", direccion: "Av. 9 de Julio y Av. Corrientes", barrio: "san_nicolas", etiquetas: ["Música y Shows"],              tipoEvento: "musica",       slug: "concierto-tango-obelisco",       pathAlias: "/descubrir/concierto-tango-obelisco",       horarios: [{ dia: "sábado",   hora: "19:00" }], acceso: "sin_costo",        ubicacion: { titulo: "Obelisco",          direccion: "Av. 9 de Julio" } },
  { id: "mock-1002", title: "Feria Gastronómica de Palermo",           description: "<p>Más de 50 puestos con lo mejor de la cocina porteña, fusión latinoamericana y street food artesanal.</p>",           imageUrl: "", fechaInicio: "2026-08-08T15:00:00.000Z", direccion: "Av. del Libertador 2373",        barrio: "palermo",    etiquetas: ["Gastronomía", "Ferias y exposiciones"], tipoEvento: "gastronomia",  slug: "feria-gastronomica-palermo",     pathAlias: "/descubrir/feria-gastronomica-palermo",     horarios: [{ dia: "viernes",  hora: "12:00" }], acceso: "sin_costo",        ubicacion: { titulo: "Palermo",           direccion: "Av. del Libertador 2373" } },
  { id: "mock-1003", title: "Maratón Solidaria de la Ciudad",          description: "<p>Carrera de 5 y 10 km a beneficio de comedores comunitarios de Buenos Aires. Abierta a todos los niveles.</p>",       imageUrl: "", fechaInicio: "2026-08-15T11:00:00.000Z", direccion: "Av. Figueroa Alcorta 2461",      barrio: "palermo",    etiquetas: ["Deportes"],                             tipoEvento: "deportes",     slug: "maraton-solidaria-ciudad",       pathAlias: "/descubrir/maraton-solidaria-ciudad",       horarios: [{ dia: "sábado",   hora: "08:00" }], acceso: "sin_costo",        ubicacion: { titulo: "Campo Argentino de Polo", direccion: "Av. Figueroa Alcorta 2461" } },
  { id: "mock-1004", title: "Exposición Arte Contemporáneo BA",        description: "<p>Muestra de artistas plásticos emergentes de Buenos Aires. Pinturas, esculturas e instalaciones.</p>",               imageUrl: "", fechaInicio: "2026-08-05T17:00:00.000Z", direccion: "Defensa 1575",                   barrio: "san_telmo",  etiquetas: ["Arte"],                                 tipoEvento: "arte",         slug: "exposicion-arte-contemporaneo-ba",pathAlias: "/descubrir/exposicion-arte-contemporaneo-ba",horarios: [{ dia: "martes",   hora: "14:00" }], acceso: "sin_costo",        ubicacion: { titulo: "Centro Cultural San Telmo", direccion: "Defensa 1575" } },
  { id: "mock-1005", title: "Festival de Jazz en La Boca",             description: "<p>Dos noches de jazz y blues al aire libre en La Boca. Músicos locales e internacionales en escenas simultáneas.</p>", imageUrl: "", fechaInicio: "2026-08-22T23:00:00.000Z", direccion: "Caminito 100",                   barrio: "la_boca",    etiquetas: ["Música y Shows"],              tipoEvento: "musica",       slug: "festival-jazz-la-boca",          pathAlias: "/descubrir/festival-jazz-la-boca",          horarios: [{ dia: "viernes",  hora: "20:00" }], acceso: "sin_costo",        ubicacion: { titulo: "Caminito",          direccion: "Caminito 100" } },
  { id: "mock-1006", title: "Ciclo de Cine Gratuito en Parques",       description: "<p>Proyecciones al aire libre de cine argentino clásico y contemporáneo. Ideal para toda la familia.</p>",              imageUrl: "", fechaInicio: "2026-08-12T00:00:00.000Z", direccion: "Av. Infanta Isabel 410",         barrio: "palermo",    etiquetas: ["Cine"],                                 tipoEvento: "cine",         slug: "cine-gratuito-parques",          pathAlias: "/descubrir/cine-gratuito-parques",          horarios: [{ dia: "martes",   hora: "21:00" }], acceso: "sin_costo",        ubicacion: { titulo: "Parque Tres de Febrero",    direccion: "Av. Infanta Isabel 410" } },
  { id: "mock-1007", title: "Taller de Cocina Saludable",              description: "<p>Taller gratuito de cocina plant-based. Dictado por nutricionistas y chefs especializados del GCBA.</p>",            imageUrl: "", fechaInicio: "2026-08-19T13:30:00.000Z", direccion: "Av. Corrientes 1530",            barrio: "san_nicolas",etiquetas: ["Gastronomía", "Talleres"],              tipoEvento: "gastronomia",  slug: "taller-cocina-saludable",        pathAlias: "/descubrir/taller-cocina-saludable",        horarios: [{ dia: "miércoles",hora: "10:30" }], acceso: "sin_costo",        ubicacion: { titulo: "Centro Cultural San Martín", direccion: "Av. Corrientes 1530" } },
  { id: "mock-1008", title: "Torneo de Ajedrez Abierto de la Ciudad",  description: "<p>Torneo con sistema suizo de 7 rondas, abierto a todas las categorías y edades.</p>",                                 imageUrl: "", fechaInicio: "2026-08-29T13:00:00.000Z", direccion: "Juramento 1400",                 barrio: "belgrano",   etiquetas: ["Deportes"],                             tipoEvento: "deportes",     slug: "torneo-ajedrez-ciudad",          pathAlias: "/descubrir/torneo-ajedrez-ciudad",          horarios: [{ dia: "sábado",   hora: "10:00" }], acceso: "sin_costo",        ubicacion: { titulo: "Club Belgrano",     direccion: "Juramento 1400" } },
  { id: "mock-1009", title: "Recital Rock Nacional en el Anfiteatro",  description: "<p>Noche de rock argentino con las bandas emergentes más destacadas del año. Grilla de 4 bandas.</p>",                  imageUrl: "", fechaInicio: "2026-08-28T22:00:00.000Z", direccion: "Av. Sarmiento s/n",              barrio: "palermo",    etiquetas: ["Música y Shows"],              tipoEvento: "musica",       slug: "recital-rock-anfiteatro",        pathAlias: "/descubrir/recital-rock-anfiteatro",        horarios: [{ dia: "viernes",  hora: "19:00" }], acceso: "sin_costo",        ubicacion: { titulo: "Anfiteatro Parque Centenario", direccion: "Av. Sarmiento s/n" } },
  { id: "mock-1010", title: "Semana de la Danza Contemporánea",        description: "<p>Funciones gratuitas de danza contemporánea, clásica y urbana. Compañías de todo el país en Buenos Aires.</p>",      imageUrl: "", fechaInicio: "2026-08-10T23:00:00.000Z", direccion: "Av. Corrientes 1530",            barrio: "san_nicolas",etiquetas: ["Danza"],                                tipoEvento: "danza",        slug: "semana-danza-contemporanea",     pathAlias: "/descubrir/semana-danza-contemporanea",     horarios: [{ dia: "lunes",    hora: "20:00" }], acceso: "sin_costo",        ubicacion: { titulo: "Teatro San Martín", direccion: "Av. Corrientes 1530" } },
];

// ─── Handler principal ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET")    return res.status(405).json({ error: "Method Not Allowed" });

  try {
    // ── Caché en memoria (warm-instance) ────────────────────────────────────
    const cachedEvents = getCached(EVENTS_CACHE_KEY, EVENTS_CACHE_TTL);
    if (cachedEvents) {
      console.log(`[events] Sirviendo ${cachedEvents.length} eventos desde caché (TTL: ${EVENTS_CACHE_TTL / 60000} min)`);
      return res.status(200).json({
        events:    cachedEvents,
        total:     cachedEvents.length,
        source:    "LINDA",
        live:      true,
        cached:    true,
        timestamp: new Date().toISOString(),
      });
    }

    let records, live;

    try {
      ({ records, live } = await extractFromLinda());
    } catch (apiErr) {
      console.warn(`[events] Linda API no disponible (${apiErr.message}). Usando mock.`);
      records = MOCK_RECORDS;
      live    = false;
    }

    const events = records.map(normalizeRecord);

    // Guardar en caché solo si los datos son live (no mockear el caché)
    if (live) setCached(EVENTS_CACHE_KEY, events);

    return res.status(200).json({
      events,
      total:     events.length,
      source:    "LINDA",
      live,
      cached:    false,
      timestamp: new Date().toISOString(),
    });

  } catch (err) {
    console.error("[events] Error crítico:", err.message);
    return res.status(503).json({
      error:  "No se pudieron obtener los eventos.",
      detail: err.message,
      events: [],
      total:  0,
    });
  }
}
