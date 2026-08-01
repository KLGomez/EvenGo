// Vercel Serverless Function: GET /api/events
// Devuelve eventos normalizados al frontend de EvenGo.
//
// NOTA DE ARQUITECTURA: Este archivo es AUTOCONTENIDO (sin imports de otros
// archivos /api) para garantizar compatibilidad con vercel dev. La lógica ETL
// completa vive en api/sync-gcba.js para uso independiente (cron/manual).

// ─── Configuración ────────────────────────────────────────────────────────────

const GCBA_CKAN_BASE = "https://data.buenosaires.gob.ar/api/3/action";

const GCBA_RESOURCE_IDS = [
  "fe5ba957-f331-42b1-b3f4-a56b8f50268a",
  "c225fdbb-f828-42d9-965d-5f3ee6d83481",
  "e8e2051f-a1bc-4c45-8ece-8c107a1fcb82",
  "423e35ec-489b-4703-8852-faf262c014e7",
];

// ─── Clasificador de categorías por palabras clave ────────────────────────────

const CLASSIFICATION_RULES = [
  {
    category: "Musical",
    keywords: [
      "música", "musica", "concierto", "recital", "jazz", "rock", "tango",
      "cumbia", "folklore", "folclore", "orquesta", "banda", "cantante",
      "festival musical", "show musical", "música en vivo", "musica en vivo",
    ],
  },
  {
    category: "Deportivo",
    keywords: [
      "deporte", "deportivo", "fútbol", "futbol", "tenis", "maratón", "maraton",
      "carrera", "atletismo", "natación", "natacion", "básquet", "basquet",
      "vóley", "voley", "torneo", "campeonato", "running", "ciclismo", "yoga",
    ],
  },
  {
    category: "Gastronomía",
    keywords: [
      "gastronomía", "gastronomia", "gastronómica", "gastronomica",
      "feria de comida", "food", "culinaria", "culinario", "chef",
      "cocina", "degustación", "degustacion", "vinos", "cerveza artesanal",
    ],
  },
];

function classifyCategory(text) {
  const lower = (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  for (const rule of CLASSIFICATION_RULES) {
    const match = rule.keywords.some((kw) => {
      const kwNorm = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return lower.includes(kwNorm);
    });
    if (match) return rule.category;
  }
  return "Cultural";
}

// ─── Normalización de ubicación ───────────────────────────────────────────────

function normalizeLocation(barrio) {
  const b = (barrio || "").toLowerCase();
  if (b.includes("palermo"))                                         return "Palermo";
  if (b.includes("san telmo"))                                       return "San Telmo";
  if (b.includes("quilmes"))                                         return "Quilmes";
  if (b.includes("obelisco") || b.includes("centro") ||
      b.includes("montserrat") || b.includes("retiro") ||
      b.includes("corrientes") || b.includes("9 de julio"))         return "Obelisco / Centro";
  if (b.includes("la boca") || b.includes("boca"))                  return "La Boca";
  if (b.includes("belgrano"))                                        return "Belgrano";
  return barrio || "Buenos Aires";
}

// ─── Mapper: registro GCBA → schema EvenGo ───────────────────────────────────

function normalizeRecord(record, index) {
  const searchText = [
    record.nombre_actividad,
    record.descripcion,
    record.categoria,
    record.subcategoria,
  ]
    .filter(Boolean)
    .join(" ");

  const id =
    record._id != null
      ? String(record._id)
      : `gcba-${Date.now()}-${index}`;

  const time = record.hora_inicio
    ? String(record.hora_inicio).slice(0, 5)
    : "00:00";

  // Título en variable para usarlo también en la URL dinámica
  const title = record.nombre_actividad || record.nombre || "Actividad sin título";

  // URL construida 100% desde el título — no se lee record.url bajo ninguna circunstancia.
  // Esto garantiza que ningún link obsoleto del dataset llegue al frontend.
  const url = `https://linda.buenosaires.gob.ar/agenda?q=${encodeURIComponent(title)}`;
  console.log(`[events] URL final: ${url}`);

  return {
    id,
    title,
    description: record.descripcion || "",
    category:    classifyCategory(searchText),
    date:        record.fecha_inicio || record.fecha_desde || "",
    time,
    location:    normalizeLocation(record.barrio || record.domicilio || ""),
    address:     record.domicilio || "",
    url,
    source:      "GCBA",
  };
}

// ─── Mock con estructura real del GCBA (fallback) ─────────────────────────────

const MOCK_RECORDS = [
  { _id: 1001, nombre_actividad: "Concierto de Tango en el Obelisco",       descripcion: "Gran show de tango al aire libre en el corazón de Buenos Aires. Artistas consagrados del género rioplatense.",   categoria: "Música en vivo",  subcategoria: "Tango",              fecha_inicio: "2026-08-02", hora_inicio: "19:00", domicilio: "Av. 9 de Julio y Av. Corrientes",      barrio: "Obelisco / Centro" },
  { _id: 1002, nombre_actividad: "Feria Gastronómica de Palermo",           descripcion: "Más de 50 puestos con lo mejor de la cocina porteña, fusión latinoamericana y street food artesanal.",           categoria: "Gastronomía",    subcategoria: "Feria de comida",   fecha_inicio: "2026-08-08", hora_inicio: "12:00", domicilio: "Av. del Libertador 2373",            barrio: "Palermo"           },
  { _id: 1003, nombre_actividad: "Maratón Solidaria de la Ciudad",          descripcion: "Carrera de 5 y 10 km a beneficio de comedores comunitarios de Buenos Aires.",                                     categoria: "Deportivo",      subcategoria: "Carrera",           fecha_inicio: "2026-08-15", hora_inicio: "08:00", domicilio: "Av. Figueroa Alcorta 2461",           barrio: "Palermo"           },
  { _id: 1004, nombre_actividad: "Exposición Arte Contemporáneo BA",        descripcion: "Muestra de artistas plásticos emergentes. Pinturas, esculturas e instalaciones en diálogo con el espacio público.", categoria: "Artes visuales", subcategoria: "Exposición",        fecha_inicio: "2026-08-05", hora_inicio: "14:00", domicilio: "Defensa 1575",                        barrio: "San Telmo"         },
  { _id: 1005, nombre_actividad: "Festival de Jazz en La Boca",             descripcion: "Dos noches de jazz y blues al aire libre en el barrio de La Boca. Músicos locales e internacionales.",             categoria: "Música en vivo",  subcategoria: "Jazz",              fecha_inicio: "2026-08-22", hora_inicio: "20:00", domicilio: "Caminito 100",                         barrio: "La Boca"           },
  { _id: 1006, nombre_actividad: "Ciclo de Cine Gratuito en Parques",       descripcion: "Proyecciones al aire libre de cine argentino clásico y contemporáneo. Ideal para toda la familia.",               categoria: "Cine",           subcategoria: "Ciclo de cine",    fecha_inicio: "2026-08-12", hora_inicio: "21:00", domicilio: "Av. Infanta Isabel 410",              barrio: "Palermo"           },
  { _id: 1007, nombre_actividad: "Taller de Cocina Saludable",              descripcion: "Taller gratuito de cocina plant-based. Dictado por nutricionistas y chefs especializados del GCBA.",              categoria: "Gastronomía",    subcategoria: "Taller culinario", fecha_inicio: "2026-08-19", hora_inicio: "10:30", domicilio: "Av. Corrientes 1530",                 barrio: "Obelisco / Centro" },
  { _id: 1008, nombre_actividad: "Torneo de Ajedrez Abierto de la Ciudad",  descripcion: "Torneo con sistema suizo de 7 rondas, abierto a todas las categorías y edades.",                               categoria: "Deportivo",      subcategoria: "Ajedrez",           fecha_inicio: "2026-08-29", hora_inicio: "10:00", domicilio: "Juramento 1400",                      barrio: "Belgrano"          },
  { _id: 1009, nombre_actividad: "Recital Rock Nacional en el Anfiteatro",  descripcion: "Noche de rock argentino con las bandas emergentes más destacadas del año. Grilla de 4 bandas.",                  categoria: "Música en vivo",  subcategoria: "Rock",              fecha_inicio: "2026-08-28", hora_inicio: "19:00", domicilio: "Av. Sarmiento s/n, Parque Centenario", barrio: "Palermo"           },
  { _id: 1010, nombre_actividad: "Semana de la Danza Contemporánea",        descripcion: "Funciones gratuitas de danza contemporánea, clásica y urbana. Compañías de todo el país.",                       categoria: "Danza",          subcategoria: "Danza contemporánea", fecha_inicio: "2026-08-10", hora_inicio: "20:00", domicilio: "Av. Corrientes 1530",                 barrio: "Obelisco / Centro" },
];

// ─── EXTRACT: Fetch al CKAN del GCBA ─────────────────────────────────────────

async function extractFromGCBA() {
  const errors = [];
  for (const resourceId of GCBA_RESOURCE_IDS) {
    try {
      const url = `${GCBA_CKAN_BASE}/datastore_search?resource_id=${resourceId}&limit=50`;
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!data.success) throw new Error(`CKAN: ${JSON.stringify(data.error)}`);
      const records = data.result?.records ?? [];
      if (records.length === 0) throw new Error("Dataset sin registros");
      console.log(`[events] GCBA live: ${records.length} registros (resource: ${resourceId})`);
      return { records, live: true };
    } catch (err) {
      errors.push(`${resourceId.slice(0, 8)}: ${err.message}`);
    }
  }
  console.warn(`[events] GCBA no disponible (${errors.join(" | ")}). Usando mock.`);
  return { records: MOCK_RECORDS, live: false };
}

// ─── Handler principal ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { records, live } = await extractFromGCBA();
    const events = records.map(normalizeRecord);

    return res.status(200).json({
      events,
      total:     events.length,
      source:    "GCBA",
      live,
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
