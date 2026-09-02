import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createEvent } from 'ics';
import { getCached, setCached } from './_cache.js';
import { normalizeRecord } from './_normalize.js';


/**
 * Vercel Serverless Function: POST /api/chat
 * Asistente Virtual Conversacional de EvenGo alimentado por Gemini Flash.
 * Responde mediante Server-Sent Events (SSE) para TTFB mínimo.
 *
 * Protocolo SSE emitido:
 *   data: {"text":"<fragmento>"}\n\n   → chunk de texto
 *   data: {"done":true,"toolCalls":[...],"actions":{...}}\n\n  → cierre exitoso
 *   data: {"error":"<mensaje>"}\n\n    → cierre con error
 */


const LINDA_API = 'https://linda.buenosaires.gob.ar/api/frontend/events/filter';
const BA_LAT = -34.6037;
const BA_LON = -58.3816;

// ─── IMPLEMENTACIONES DE HERRAMIENTAS ──────────────────────────────────────────

// TTL del caché para búsquedas de eventos en el chat (5 minutos).
// En instancias calientes de Vercel esto elimina re-fetches entre tool calls
// consecutivos dentro de la misma conversación.
const SEARCH_EVENTS_CACHE_TTL = 5 * 60 * 1000;

async function searchEvents({ category, barrio, isFree, query } = {}) {
  try {
    // ── FinOps: Caché de eventos para el chat ────────────────────────────────
    // Usamos una clave basada en los filtros para que distintas combinaciones
    // tengan su propia entrada en caché. El fetch base (sin filtros) se cachea
    // con la clave 'chat-events-base' para reutilizarlo en todos los turnos.
    const cacheKey = `chat-events:${category || ''}:${barrio || ''}:${isFree ?? ''}:${query || ''}`;
    const cachedResult = getCached(cacheKey, SEARCH_EVENTS_CACHE_TTL);
    if (cachedResult) {
      console.log(`[api/chat] searchEvents: cache hit (${cacheKey})`);
      return cachedResult;
    }

    // ── FinOps: limit=20 (era 50) — solo usamos 8, margen de 20 es suficiente
    const url = `${LINDA_API}?limit=20`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error(`Linda API HTTP ${response.status}`);

    const data = await response.json();
    let events = data.events || [];

    if (category) {
      const cat = category.toLowerCase();
      events = events.filter(
        (e) =>
          (e.etiquetas || []).some((tag) => tag.toLowerCase().includes(cat)) ||
          (e.tipoEvento || '').toLowerCase().includes(cat)
      );
    }

    if (barrio) {
      const b = barrio.toLowerCase();
      events = events.filter(
        (e) =>
          (e.barrio || '').toLowerCase().includes(b) ||
          (e.direccion || '').toLowerCase().includes(b) ||
          (e.ubicacion?.titulo || '').toLowerCase().includes(b)
      );
    }

    if (isFree !== undefined) {
      events = events.filter((e) => {
        const free = e.acceso === 'sin_costo' || e.precio === 0 || e.precio === 'Gratuito';
        return isFree ? free : !free;
      });
    }

    if (query) {
      const q = query.toLowerCase();
      events = events.filter(
        (e) =>
          (e.title || '').toLowerCase().includes(q) ||
          (e.description || '').toLowerCase().includes(q)
      );
    }

    // Normalizar con el mismo schema que usa /api/events (módulo compartido)
    // Los filtros corren sobre el JSON crudo de Linda (más eficiente).
    // normalizeRecord() se aplica solo al slice final de 8 eventos.
    const results = events.slice(0, 8).map(normalizeRecord);

    // ── FinOps: Objeto SLIM → lo único que necesita el LLM para razonar ────────
    // Elimina: id, imagen, url externa, source, category. Trunca desc a 150 chars.
    // Ahorro estimado: ~40-60% de tokens por herramienta de eventos.
    const resultsForLLM = results.map((e) => ({
      titulo: e.title,
      fecha: e.date,
      barrio: e.location,        // location ya es el nombre legible (ej: "Palermo")
      lugar: e.address,
      precio: e.precio || 'Consultar',
      anchorLink: e.anchorLink,
      ...(e.description ? { descripcion: e.description.slice(0, 150) } : {}),
    }));

    const result = {
      count: results.length,
      eventos: resultsForLLM,  // ← payload al LLM (slim)
      _fullEvents: results,     // ← payload al frontend (campo _ → excluido por trimForLLM)
    };

    // Guardar en caché solo si hay resultados
    if (results.length > 0) setCached(cacheKey, result);

    return result;
  } catch (err) {
    return { count: 0, events: [], source: 'unavailable', error: err.message };
  }
}



// ─── Motor de Reglas Determinista de Clima (CABA / AMBA / Quilmes) ───────────
const AMBA_WEATHER_CONFIG = {
  RAIN: {
    PROBABILITY_THRESHOLD_PCT: 30, // Clima cambiante: >= 30% activa recomendación de paraguas
    KEYWORDS: [
      'rain', 'drizzle', 'shower', 'thunderstorm', 'storm',
      'lluvia', 'llovizna', 'tormenta', 'chubasco', 'chaparrón', 'precipitación'
    ]
  },
  TEMP: {
    EXTREME_COLD_MAX: 9.9, // < 10°C: Frío extremo húmedo -> Abrigo pesado
    COLD_MIN: 10,          // 10°C a 15.9°C: Frío -> Abrigo / campera
    COLD_MAX: 15.9,
    TEMPERATE_MIN: 16,     // 16°C a 24.9°C: Templado -> Ropa cómoda, ideal para salir
    TEMPERATE_MAX: 24.9,
    HOT_MIN: 25            // >= 25°C: Calor pesado porteño -> Ropa muy fresca + agua
  }
};

function mapWeatherCodeToText(code) {
  if (code === 0) return 'Despejado ☀️';
  if (code <= 3) return 'Parcialmente nublado 🌤️';
  if (code <= 48) return 'Nublado / Niebla ☁️';
  if (code <= 67) return 'Lluvia 🌧️';
  if (code <= 77) return 'Nieve / Granizo ❄️';
  if (code <= 82) return 'Lluvias intermitentes 🌦️';
  return 'Tormenta eléctrica ⛈️';
}

function evaluateBuenosAiresRules({ temp, rainProb = 0, condition = '' }) {
  const normCondition = condition.toLowerCase();
  
  // 1. Detección de Lluvia (>= 30% o palabras clave de precipitación)
  const isRain =
    rainProb >= AMBA_WEATHER_CONFIG.RAIN.PROBABILITY_THRESHOLD_PCT ||
    AMBA_WEATHER_CONFIG.RAIN.KEYWORDS.some((kw) => normCondition.includes(kw));

  // 2. Evaluación de Sensación Térmica / Humedad
  let baseAdvice = '';
  if (temp < AMBA_WEATHER_CONFIG.TEMP.EXTREME_COLD_MAX) {
    baseAdvice = 'Llevar abrigo pesado (campera abrigada)';
  } else if (temp <= AMBA_WEATHER_CONFIG.TEMP.COLD_MAX) {
    baseAdvice = 'Llevar abrigo o campera';
  } else if (temp <= AMBA_WEATHER_CONFIG.TEMP.TEMPERATE_MAX) {
    baseAdvice = 'Ropa cómoda, clima ideal para salir';
  } else {
    baseAdvice = 'Día caluroso. Llevar ropa muy fresca y botellita de agua por la humedad';
  }

  // 3. Composición sintética
  if (isRain) {
    return baseAdvice.startsWith('Día caluroso')
      ? `${baseAdvice}, y llevar paraguas por posible lluvia.`
      : `${baseAdvice} y llevar paraguas por posible lluvia.`;
  }
  return `${baseAdvice}.`;
}

async function checkWeather({ date } = {}) {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${BA_LAT}&longitude=${BA_LON}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode` +
    `&timezone=America%2FArgentina%2FBuenos_Aires` +
    `&start_date=${targetDate}&end_date=${targetDate}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);

    const data = await response.json();
    const i = 0;

    if (!data.daily || !data.daily.time?.[i]) {
      throw new Error('Sin datos de pronóstico para esa fecha');
    }

    const rainProb = data.daily.precipitation_probability_max[i] ?? 0;
    const weatherCode = data.daily.weathercode?.[i] ?? 0;
    const tempMax = data.daily.temperature_2m_max[i];
    const tempMin = data.daily.temperature_2m_min[i];
    const condicion = mapWeatherCodeToText(weatherCode);

    // Motor de reglas determinista
    const recomendacion_ropa = evaluateBuenosAiresRules({
      temp: tempMax,
      rainProb,
      condition: condicion,
    });

    const willRain = rainProb >= AMBA_WEATHER_CONFIG.RAIN.PROBABILITY_THRESHOLD_PCT;
    const clima = `${condicion}, ${Math.round(tempMax)}°C`;

    // ── FinOps: Payload ultra-minimalista y pre-digerido para el LLM ─────────
    // El LLM solo recibe `clima` y `recomendacion_ropa` (trimForLLM excluye `_raw`).
    // Ahorro estimado: ~95% de tokens y 0 razonamiento de vestimenta en el LLM.
    return {
      clima,
      recomendacion_ropa,
      // _raw: usado internamente por planItinerary para armar la tarjeta visual
      _raw: { willRain, rainProbability: rainProb, tempMaxC: tempMax, tempMinC: tempMin, condicion, recomendacion_ropa },
    };
  } catch (err) {
    return {
      clima: 'Clima en Buenos Aires: templado, 20°C',
      recomendacion_ropa: 'Ropa cómoda, clima ideal para salir.',
      _raw: { willRain: false, rainProbability: 0, tempMaxC: 20, tempMinC: 15, error: err.message }
    };
  }
}

async function saveFavorite({ id, title, date, url, location } = {}) {
  if (!title) {
    return { saved: false, error: 'Falta el título del evento a guardar.' };
  }

  const favoriteId = id || `fav-${Date.now()}`;
  const favorite = {
    id: favoriteId,
    title,
    date: date || null,
    url: url || null,
    location: location || null,
    savedAt: new Date().toISOString(),
  };

  return {
    saved: true,
    action: 'SAVE_TO_LOCAL_STORAGE',
    message: `Evento "${title}" listo para ser guardado en los favoritos del usuario.`,
    favorite,
  };
}

async function generateCalendarInvite({ title, date, time = '19:00', location } = {}) {
  if (!title || !date) {
    return { generated: false, error: 'Faltan título y/o fecha del evento.' };
  }

  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = (time || '19:00').split(':').map(Number);

  const { error, value } = createEvent({
    title,
    start: [year, month, day, isNaN(hour) ? 19 : hour, isNaN(minute) ? 0 : minute],
    duration: { hours: 2 },
    location: location || 'Buenos Aires, Argentina',
    description: `Evento agendado por EvenGo Concierge AI: ${title}`,
  });

  if (error) {
    return { generated: false, error: error.message || String(error) };
  }

  const base64Content = Buffer.from(value).toString('base64');
  const downloadUrl = `data:text/calendar;charset=utf8;base64,${base64Content}`;
  const filename = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.ics`;

  return {
    generated: true,
    action: 'DOWNLOAD_CALENDAR_INVITE',
    downloadUrl,
    filename,
    title,
    date,
    message: `Invitación de calendario para "${title}" lista para descargar.`,
  };
}

async function planItinerary({ date, barrio, category, isFree, query } = {}) {
  const targetDate = date || new Date().toISOString().slice(0, 10);

  const [eventsResult, weatherResult] = await Promise.all([
    searchEvents({ category, query, limit: 10 }),
    checkWeather({ date: targetDate }),
  ]);

  // planItinerary usa los datos COMPLETOS de las tools (campos _) porque
  // es una función interna — no los recibe vía LLM sino directamente.
  let events = eventsResult._fullEvents || eventsResult.eventos || [];

  if (barrio && events.length > 0) {
    const b = barrio.toLowerCase();
    const matched = events.filter(
      (e) =>
        (e.barrio || '').toLowerCase().includes(b) ||
        (e.address || e.lugar || '').toLowerCase().includes(b)
    );
    if (matched.length > 0) events = matched;
  }

  const primaryEvent = events[0] || {
    title: 'Salida Cultural en Buenos Aires',
    date: targetDate,
    address: barrio ? `Barrio ${barrio}, Buenos Aires` : 'Buenos Aires',
    price: 'Gratuito',
  };

  const calendarInvite = await generateCalendarInvite({
    title: primaryEvent.title,
    date: targetDate,
    time: primaryEvent.time || '19:00',
    location: primaryEvent.address || primaryEvent.lugar || primaryEvent.barrio || 'Buenos Aires',
  });

  // Lee los datos crudos del clima desde _raw (campo interno, no expuesto al LLM)
  const raw = weatherResult._raw || {};
  const willRain = raw.willRain ?? false;
  const tempMax = raw.tempMaxC ?? weatherResult.temp_max_c ?? 22;
  const tempMin = raw.tempMinC ?? weatherResult.temp_min_c ?? 14;

  // clothingTip: reutiliza el recomendacion_ropa pre-calculado en checkWeather
  const clothingTip = weatherResult.recomendacion_ropa || weatherResult.consejo_ropa
    || (willRain
      ? '⚠️ Alta probabilidad de lluvia: Se sugiere llevar paraguas.'
      : tempMax > 25
        ? '☀️ Día caluroso: Se recomienda ropa muy fresca y llevar agua por la humedad.'
        : tempMin < 10
          ? '❄️ Frío extremo: Se aconseja llevar un abrigo pesado.'
          : tempMin < 16
            ? '🌙 Noche fresca: Se aconseja llevar un abrigo o campera.'
            : '🌤️ Ropa cómoda, clima ideal para salir.');

  return {
    success: true,
    action: 'SHOW_ITINERARY',
    itinerary: {
      title: `Plan Ejecutivo EvenGo ${barrio ? '· ' + barrio : ''}`,
      date: targetDate,
      weather: {
        tempMaxC: tempMax,
        tempMinC: tempMin,
        rainProbability: raw.rainProbability ?? weatherResult.prob_lluvia_pct ?? 0,
        willRain,
      },
      primaryEvent,
      // ── FinOps: Mejora 3 — slim alternativeEvents ────────────────────────
      // El LLM solo necesita título, fecha y enlace de los alternativos.
      // Reducción: 3 eventos completos → 2 eventos con 3 campos cada uno.
      // Ahorro estimado: ~300-500 tokens por invocación de plan_itinerary.
      alternativeEvents: events.slice(1, 3).map((e) => ({
        titulo: e.title,
        fecha: e.date,
        anchorLink: e.anchorLink,
      })),
      timeline: [
        { time: '18:00', activity: `Encuentro y café en ${barrio || 'la zona del evento'}` },
        { time: primaryEvent.time || '19:30', activity: `Evento Destacado: ${primaryEvent.title}` },
        { time: '21:30', activity: 'Sugerencia gastronómica / Tapeo en la zona' },
      ],
      logistics: {
        clothingTip,
        transportTip: `Dirección principal: ${primaryEvent.address || primaryEvent.lugar || 'Buenos Aires'}`,
      },
      // ── FinOps: Mejora 2 — calendarInvite excluido del payload al LLM ───
      // El campo _calendarInvite tiene prefijo "_" → trimForLLM() lo elimina
      // automáticamente antes de inyectarlo como functionResponse al modelo.
      // La acción de descarga llega al frontend vía actions.invites (línea ~600).
      // Ahorro estimado: ~2.000-4.000 tokens por invocación (base64 del .ics).
      _calendarInvite: calendarInvite.generated ? calendarInvite : null,
      // Flag mínimo para que el LLM sepa que la invitación fue generada
      calendarInviteReady: calendarInvite.generated ?? false,
    },
  };
}


const TOOL_IMPLEMENTATIONS = {
  search_events: searchEvents,
  check_weather: checkWeather,
  save_favorite: saveFavorite,
  generate_calendar_invite: generateCalendarInvite,
  plan_itinerary: planItinerary,
};

// ─── ESQUEMA DE DECLARACIÓN DE HERRAMIENTAS PARA GEMINI ──────────────────────

const TOOL_DECLARATIONS = [
  {
    name: 'search_events',
    description:
      'Busca eventos culturales en Buenos Aires por categoría, barrio, precio (gratis/pago) y palabra clave.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        category: { type: SchemaType.STRING, description: 'Categoría del evento' },
        barrio: { type: SchemaType.STRING, description: 'Barrio de Buenos Aires' },
        isFree: { type: SchemaType.BOOLEAN, description: 'true para eventos gratuitos' },
        query: { type: SchemaType.STRING, description: 'Búsqueda por texto libre' },
      },
    },
  },
  {
    name: 'check_weather',
    description:
      'Consulta el pronóstico del tiempo y recomendación de vestimenta pre-calculada en Buenos Aires para una fecha dada (YYYY-MM-DD).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        date: { type: SchemaType.STRING, description: 'Fecha en formato YYYY-MM-DD' },
      },
    },
  },
  {
    name: 'save_favorite',
    description:
      'Guarda un evento en los favoritos del usuario cuando lo solicite.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING },
        title: { type: SchemaType.STRING },
        date: { type: SchemaType.STRING },
        url: { type: SchemaType.STRING },
        location: { type: SchemaType.STRING },
      },
      required: ['title'],
    },
  },
  {
    name: 'generate_calendar_invite',
    description:
      'Genera una invitación de calendario (.ics) descargable para un evento.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        title: { type: SchemaType.STRING },
        date: { type: SchemaType.STRING },
        time: { type: SchemaType.STRING },
        location: { type: SchemaType.STRING },
      },
      required: ['title', 'date'],
    },
  },
  {
    name: 'plan_itinerary',
    description:
      'Planifica una salida o itinerario completo en Buenos Aires combinando eventos, clima, logística y agenda .ics descargable. Usar cuando el usuario pida armar un plan o itinerario.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        date: { type: SchemaType.STRING, description: 'YYYY-MM-DD' },
        barrio: { type: SchemaType.STRING, description: 'Barrio preferido' },
        category: { type: SchemaType.STRING, description: 'Categoría preferida' },
        isFree: { type: SchemaType.BOOLEAN, description: 'true para eventos gratuitos' },
        query: { type: SchemaType.STRING, description: 'Búsqueda libre' },
      },
    },
  },
];

const SYSTEM_INSTRUCTION = `Eres el asistente virtual experto y Concierge Ejecutivo de EvenGo en Buenos Aires.
Tienes acceso a herramientas reales para buscar eventos, consultar el clima, guardar favoritos, generar invitaciones de calendario y PLANIFICAR ITINERARIOS COMPLETOS con plan_itinerary.

REGLAS DE ACTUACIÓN:
1. Si el usuario pide "armar un plan", "itinerario", "salida para el fin de semana" o "qué hacer un día", invoca SIEMPRE plan_itinerary.
2. Si el usuario pide planes al aire libre o consulta el clima, usa check_weather e inyecta directamente el texto de "clima" y "recomendacion_ropa" provisto por la herramienta en tu respuesta sin recalcular ni alterar las sugerencias de vestimenta.
3. CRÍTICO: SIEMPRE que menciones un evento en tu respuesta, usa el campo "anchorLink" del evento (tiene el formato #event-{id}) para construir el enlace Markdown: [Nombre del Evento](anchorLink). NUNCA uses la propiedad "url" externa (la de linda.buenosaires.gob.ar) en el texto de tu respuesta, ya que eso saca al usuario de EvenGo. El anchorLink lleva al usuario directamente a la tarjeta del evento dentro de la aplicación.
4. Sé amable, conciso y responde en español con formato Markdown pulido.`;

// ─── HELPERS SSE ──────────────────────────────────────────────────────────────

/**
 * Escribe un evento SSE en el response.
 * @param {import('http').ServerResponse} res
 * @param {object} payload
 */
function sseWrite(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/**
 * Configura los headers de SSE (solo si no se enviaron ya).
 * @param {import('http').ServerResponse} res
 */
function initSSE(res) {
  if (!res.headersSent) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }
  }
}

// ─── REINTENTOS AUTOMÁTICOS PARA ERRORES TEMPORALES DE CAPACIDAD ──────────────

async function generateContentWithRetry(model, payload, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await model.generateContent(payload);
    } catch (err) {
      attempt++;
      const isTransient =
        err.message?.includes('503') ||
        err.message?.includes('429') ||
        err.message?.includes('high demand') ||
        err.message?.includes('Service Unavailable');

      if (isTransient && attempt < maxRetries) {
        console.warn(`[api/chat] Error de capacidad en Gemini (${attempt}/${maxRetries}): ${err.message}. Reintentando en ${attempt * 600}ms...`);
        await new Promise((r) => setTimeout(r, attempt * 600));
      } else {
        throw err;
      }
    }
  }
}

// ─── HANDLER PRINCIPAL ────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  let rawHistory = [];
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { messages = [], message } = body;

    rawHistory = Array.isArray(messages) && messages.length > 0
      ? messages
      : message ? [{ role: 'user', content: message }] : [];

    if (rawHistory.length === 0) {
      return res.status(400).json({ error: 'El campo "messages" es requerido.' });
    }

    // ── FinOps: Short-circuit de saludos (0 tokens / Latencia mínima) ──────────
    // 1. Sanitización del input: extrae el último mensaje del usuario y elimina signos de apertura
    const lastMsg = String(rawHistory[rawHistory.length - 1]?.content || '').trim();
    const sanitizedMsg = lastMsg.replace(/^[¡¿"'`\s]+/, '');

    // 2. Detección rápida: RegEx para capturar saludos comunes al inicio del mensaje
    const GREETING_REGEX = /^(hola|buenas|buen\s+d[ií]a|buenos\s+d[ií]as|buenas\s+tardes|buenas\s+noches|hey|hi|hello|saludos|qu[eé]\s+tal|c[oó]mo\s+est[aá]s?)/i;

    // Detectamos el primer turno del usuario:
    // Filtramos solo los mensajes con rol 'user'. Si el usuario solo ha enviado 1 mensaje en la conversación
    // (independientemente de si el cliente precargó un mensaje de bienvenida del asistente en el estado inicial de la UI),
    // y dicho mensaje es un saludo, activamos el short-circuit inmediato.
    const userMessages = rawHistory.filter((m) => m.role === 'user');
    const isGreeting = userMessages.length === 1 && GREETING_REGEX.test(sanitizedMsg);

    if (isGreeting) {
      console.log('[api/chat] Short-circuit: Saludo detectado. Emisión vía SSE (0 tokens).');

      // 3. Inicializar stream SSE
      initSSE(res);

      // 4. Emitir chunk de texto con el formato del protocolo
      sseWrite(res, {
        text: '¡Hola! 👋 Soy tu Concierge de EvenGo. Puedo ayudarte a **buscar eventos en Buenos Aires**, consultar el **clima**, armar un **itinerario** o guardar tus favoritos.\n\n¿Qué plan tenés en mente?',
      });

      // 5. Emitir evento de cierre para que el frontend libere el estado de streaming
      sseWrite(res, {
        done: true,
        toolCalls: [],
        actions: { favorites: [], invites: [], itineraries: [] },
      });

      // 6. Finalizar conexión inmediatamente y abortar el resto del handler
      res.end();
      return;
    }

    // ── PLAN A: Proveedor Primario (Gemini) con generateContentStream ─────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Configuración incompleta: Falta GEMINI_API_KEY.');


    // ── FinOps: modelo más económico disponible ───────────────────────────────
    // gemini-flash-lite-latest → alias que siempre apunta al Flash-Lite más reciente.
    // Es el modelo de menor costo por token en la familia Gemini.
    // Configurable vía GEMINI_MODEL sin tocar código (ver .env.example).
    const modelName = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
    console.log(`[api/chat] Inicializando modelo Gemini streaming: "${modelName}"`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    });

    // ── Ventana Deslizante del Historial (Sliding Window) ─────────────────────
    // Acota el historial enviado al modelo a los últimos N pares de turnos.
    // Esto mantiene el costo de contexto proporcional a la longitud real de la
    // conversación activa y evita que diálogos extensos saturen el contexto
    // con información irrelevante para la consulta actual.
    //
    // HISTORY_WINDOW_TURNS: configurable vía variable de entorno.
    //   Valor por defecto: 6 pares (12 mensajes = ~2.400-3.600 tokens de contexto)
    //   Incrementar si el agente necesita recordar más contexto conversacional.
    //   Reducir para menor costo en APIs de pago por token.
    //
    // Invariantes que siempre preservamos:
    //   1. El último mensaje (la pregunta actual del usuario) nunca se descarta.
    //   2. El historial siempre empieza con role: 'user' (requerido por Gemini).
    //   3. No duplicamos mensajes consecutivos con el mismo rol.
    //   4. Nunca cortamos en medio de un par user/assistant.

    const HISTORY_WINDOW_TURNS = parseInt(process.env.HISTORY_WINDOW_TURNS || '6', 10);
    const MAX_HISTORY_MSGS = HISTORY_WINDOW_TURNS * 2; // cada "turno" = 1 user + 1 assistant

    // rawHistory sin el último mensaje (la pregunta actual va en lastUserMsg)
    const historyWithoutLast = rawHistory.slice(0, -1);

    // Aplicar la ventana: tomamos solo los últimos MAX_HISTORY_MSGS mensajes
    const windowedHistory = historyWithoutLast.length > MAX_HISTORY_MSGS
      ? historyWithoutLast.slice(-MAX_HISTORY_MSGS)
      : historyWithoutLast;

    if (historyWithoutLast.length > MAX_HISTORY_MSGS) {
      console.log(
        `[api/chat] Sliding Window activa: historial recortado de ${historyWithoutLast.length} → ${windowedHistory.length} mensajes (ventana: ${HISTORY_WINDOW_TURNS} turnos)`
      );
    }

    // Normalizar al formato de Gemini y filtrar mensajes vacíos
    const normalizedHistory = windowedHistory
      .map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : String(msg.content || '') }],
      }))
      .filter((m) => m.parts[0].text.trim().length > 0);

    // Invariante 1: Gemini requiere que el primer mensaje sea role:'user'.
    while (normalizedHistory.length > 0 && normalizedHistory[0].role !== 'user') {
      normalizedHistory.shift();
      console.log('[api/chat] Sliding Window: eliminado mensaje inicial de rol "model" para cumplir invariante Gemini.');
    }

    // Invariante 2: No puede terminar con 'user' antes de inyectar el lastUserMsg
    while (normalizedHistory.length > 0 && normalizedHistory[normalizedHistory.length - 1].role === 'user') {
      normalizedHistory.pop();
      console.log('[api/chat] Sliding Window: eliminado mensaje final repetido de rol "user" para preservar alternancia.');
    }

    const lastUserMsg = String(rawHistory[rawHistory.length - 1].content || '');
    const contents = [...normalizedHistory, { role: 'user', parts: [{ text: lastUserMsg }] }];

    const toolCallLog = [];
    const actions = { favorites: [], invites: [], itineraries: [] };
    const MAX_TOOL_HOPS = 5;
    let hops = 0;
    let finalTextResponse = null;

    // ── FinOps: separación de capas ─────────────────────────────────────────
    // trimForLLM() elimina cualquier campo prefijado con "_" (datos para el
    // frontend solamente: _fullEvents, _raw, etc.) y el campo "action" (señal
    // para el cliente, no aporta razonamiento al modelo).
    // El toolResult COMPLETO se conserva en toolCallLog para el frontend.
    const trimForLLM = (obj) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
      return Object.fromEntries(
        Object.entries(obj)
          .filter(([k]) => !k.startsWith('_') && k !== 'action')
          .map(([k, v]) => [k, typeof v === 'object' && v !== null && !Array.isArray(v)
            ? trimForLLM(v)
            : v
          ])
      );
    };

    // Resolvemos tool-calls de forma NO-streaming en los saltos intermedios.
    while (hops < MAX_TOOL_HOPS) {
      const midResult = await generateContentWithRetry(model, { contents });
      const functionCalls = midResult.response.functionCalls();

      if (!functionCalls || functionCalls.length === 0) {
        // midResult ya contiene el texto de respuesta final en lenguaje natural
        finalTextResponse = midResult.response.text();
        break;
      }

      if (midResult.response.candidates?.[0]?.content) {
        contents.push(midResult.response.candidates[0].content);
      }

      const call = functionCalls[0];
      const impl = TOOL_IMPLEMENTATIONS[call.name];
      const toolResult = impl
        ? await impl(call.args || {})
        : { error: `Tool desconocida: ${call.name}` };

      toolCallLog.push({ tool: call.name, args: call.args, result: toolResult });

      if (toolResult?.action === 'SAVE_TO_LOCAL_STORAGE' && toolResult.favorite) {
        actions.favorites.push(toolResult.favorite);
      }
      if (toolResult?.action === 'DOWNLOAD_CALENDAR_INVITE' && toolResult.downloadUrl) {
        actions.invites.push({
          title: toolResult.title,
          downloadUrl: toolResult.downloadUrl,
          filename: toolResult.filename,
        });
      }
      if (toolResult?.action === 'SHOW_ITINERARY' && toolResult.itinerary) {
        actions.itineraries.push(toolResult.itinerary);
        // ── FinOps: leer desde _calendarInvite (campo interno, no expuesto al LLM)
        if (toolResult.itinerary._calendarInvite?.downloadUrl) {
          actions.invites.push(toolResult.itinerary._calendarInvite);
        }
      }

      // En Gemini v1beta / 2.0+ las respuestas de función deben llevar role 'user'
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: call.name, response: trimForLLM(toolResult) } }],
      });

      hops += 1;
    }

    // ── Turno final: emisión de respuesta vía SSE ────────────────────────────
    initSSE(res);

    if (finalTextResponse) {
      // FinOps: Evita duplicar llamadas y quemar tokens o provocar 503 por exceso de peticiones.
      // Emitimos el texto ya generado en fragmentos fluidos para la experiencia en tiempo real del cliente.
      const words = finalTextResponse.split(/(\s+)/);
      for (const word of words) {
        if (word) sseWrite(res, { text: word });
      }
    } else {
      // Fallback si no hubo texto en midResult: streaming directo
      const streamResult = await model.generateContentStream({ contents });
      for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          sseWrite(res, { text: chunkText });
        }
      }
    }

    sseWrite(res, { done: true, toolCalls: toolCallLog, actions });
    res.end();
    return;

  } catch (geminiError) {
    console.error('[api/chat] Error en proveedor primario (Gemini):', geminiError.message || geminiError);

    // ── PLAN B: Fallback a Groq con stream: true ──────────────────────────────
    // Saneamiento de Key: ignorar claves con prefijo 'xai-' que pertenecen a otro proveedor
    const rawGroqKey = process.env.GROQ_API_KEY || process.env.FALLBACK_API_KEY;
    const groqApiKey = (rawGroqKey && !rawGroqKey.startsWith('xai-')) ? rawGroqKey : null;

    if (groqApiKey) {
      try {
        console.log('[api/chat] Groq: Intentando respuesta vía Fallback streaming...');

        // ── FinOps: Sliding Window también en Groq ────────────────────────────
        const groqMaxMsgs = (parseInt(process.env.HISTORY_WINDOW_TURNS || '6', 10)) * 2;
        let groqHistory = rawHistory.length > groqMaxMsgs
          ? rawHistory.slice(-groqMaxMsgs)
          : [...rawHistory];

        // Invariante Groq: El primer turno conversacional tras 'system' debe ser 'user'
        while (groqHistory.length > 0 && groqHistory[0].role !== 'user') {
          groqHistory.shift();
        }

        if (rawHistory.length > groqMaxMsgs) {
          console.log(`[api/chat] Groq Sliding Window: historial recortado ${rawHistory.length} → ${groqHistory.length} mensajes`);
        }

        const groqMessages = [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          ...groqHistory.map((m) => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: typeof m.content === 'string' ? m.content : String(m.content || ''),
          })),
        ];

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${groqApiKey}`,
          },
          body: JSON.stringify({
            model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
            messages: groqMessages,
            stream: true,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (!groqResponse.ok) {
          const errText = await groqResponse.text();
          throw new Error(`Groq API respondió con status ${groqResponse.status}: ${errText}`);
        }

        initSSE(res);

        const decoder = new TextDecoder('utf-8');
        const reader = groqResponse.body.getReader();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const raw = trimmed.slice(5).trim();
            if (raw === '[DONE]') continue;
            try {
              const parsed = JSON.parse(raw);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) sseWrite(res, { text: content });
            } catch { }
          }
        }

        if (buffer.trim().startsWith('data:')) {
          const raw = buffer.trim().slice(5).trim();
          if (raw && raw !== '[DONE]') {
            try {
              const parsed = JSON.parse(raw);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) sseWrite(res, { text: content });
            } catch { }
          }
        }

        console.log('[api/chat] Groq: Stream completado con éxito.');
        sseWrite(res, { done: true, toolCalls: [], actions: { favorites: [], invites: [], itineraries: [] } });
        res.end();
        return;

      } catch (groqError) {
        console.error('[api/chat] Groq: Error en proveedor de Fallback:', groqError.message || groqError);
      }
    } else {
      console.warn('[api/chat] Groq: Variable GROQ_API_KEY no configurada o inválida (Plan B omitido).');
    }

    // ── PLAN C: Graceful Degradation (un único chunk SSE de contingencia) ─────
    console.error('[api/chat] Activando respuesta estática de contingencia (Plan C).');

    initSSE(res);

    sseWrite(res, {
      text: '¡Uf! Estoy procesando demasiadas consultas y agoté mis créditos de IA temporalmente. 😅 Mientras recupero energía, te invito a explorar las tarjetas de eventos utilizando los filtros de arriba.',
    });
    sseWrite(res, { done: true, toolCalls: [], actions: { favorites: [], invites: [], itineraries: [] } });
    res.end();
  }
}
