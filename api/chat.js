import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createEvent } from 'ics';

/**
 * Vercel Serverless Function: POST /api/chat
 * Asistente Virtual Conversacional de EvenGo alimentado por Gemini Flash.
 * Modelo configurable vía variable de entorno GEMINI_MODEL (default: gemini-2.5-flash).
 * Manejo directo de contents array conservando candidatos de razonamiento y respuestas de herramientas con rol 'user'.
 */

const LINDA_API = 'https://linda.buenosaires.gob.ar/api/frontend/events/filter';
const BA_LAT = -34.6037;
const BA_LON = -58.3816;

// ─── IMPLEMENTACIONES DE HERRAMIENTAS ──────────────────────────────────────────

async function searchEvents({ category, barrio, isFree, query } = {}) {
  try {
    const url = `${LINDA_API}?limit=50`;
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

    const results = events.slice(0, 8).map((e) => ({
      id: e.id || `linda-${Date.now()}`,
      title: e.title,
      date: e.fechaInicio ? e.fechaInicio.slice(0, 10) : null,
      barrio: e.barrio || null,
      address: e.direccion || e.ubicacion?.direccion || null,
      price: e.acceso === 'sin_costo' ? 'Gratuito' : e.precio || 'Consultar',
      url: e.pathAlias ? `https://linda.buenosaires.gob.ar${e.pathAlias}` : null,
      anchorLink: `#event-${e.id}`,
    }));

    return { count: results.length, events: results, source: 'live' };
  } catch (err) {
    return { count: 0, events: [], source: 'unavailable', error: err.message };
  }
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

    const rainProb = data.daily.precipitation_probability_max[i];

    return {
      date: targetDate,
      tempMaxC: data.daily.temperature_2m_max[i],
      tempMinC: data.daily.temperature_2m_min[i],
      rainProbability: rainProb,
      willRain: rainProb >= 50,
      source: 'live',
    };
  } catch (err) {
    return { date: targetDate, source: 'unavailable', error: err.message };
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

  let events = eventsResult.events || [];

  if (barrio && events.length > 0) {
    const b = barrio.toLowerCase();
    const matched = events.filter(
      (e) =>
        (e.barrio || '').toLowerCase().includes(b) ||
        (e.address || '').toLowerCase().includes(b)
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
    location: primaryEvent.address || primaryEvent.barrio || 'Buenos Aires',
  });

  const willRain = weatherResult.willRain || false;
  const tempMax = weatherResult.tempMaxC ?? 22;
  const tempMin = weatherResult.tempMinC ?? 14;

  const clothingTip = willRain
    ? '⚠️ Alta probabilidad de lluvia: Se sugiere llevar paraguas o piloto.'
    : tempMax > 26
    ? '☀️ Día caluroso: Se recomienda ropa fresca e hidratación.'
    : tempMin < 13
    ? '🌙 Noche fresca: Se aconseja llevar un abrigo liviano.'
    : '🌤️ Clima favorable para paseos al aire libre.';

  return {
    success: true,
    action: 'SHOW_ITINERARY',
    itinerary: {
      title: `Plan Ejecutivo EvenGo ${barrio ? '· ' + barrio : ''}`,
      date: targetDate,
      weather: {
        tempMaxC: tempMax,
        tempMinC: tempMin,
        rainProbability: weatherResult.rainProbability ?? 0,
        willRain,
      },
      primaryEvent,
      alternativeEvents: events.slice(1, 4),
      timeline: [
        { time: '18:00', activity: `Encuentro y café en ${barrio || 'la zona del evento'}` },
        { time: primaryEvent.time || '19:30', activity: `Evento Destacado: ${primaryEvent.title}` },
        { time: '21:30', activity: 'Sugerencia gastronómica / Tapeo en la zona' },
      ],
      logistics: {
        clothingTip,
        transportTip: `Dirección principal: ${primaryEvent.address || 'Buenos Aires'}`,
      },
      calendarInvite: calendarInvite.generated ? calendarInvite : null,
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
      'Consulta el pronóstico del tiempo en Buenos Aires para una fecha dada (YYYY-MM-DD).',
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
2. Si el usuario pide planes al aire libre, consulta check_weather antes de search_events.
3. CRÍTICO: SIEMPRE que menciones un evento en tu respuesta, usa el campo "anchorLink" del evento (tiene el formato #event-{id}) para construir el enlace Markdown: [Nombre del Evento](anchorLink). NUNCA uses la propiedad "url" externa (la de linda.buenosaires.gob.ar) en el texto de tu respuesta, ya que eso saca al usuario de EvenGo. El anchorLink lleva al usuario directamente a la tarjeta del evento dentro de la aplicación.
4. Sé amable, conciso y responde en español con formato Markdown pulido.`;

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
        await new Promise((res) => setTimeout(res, attempt * 600));
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
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Configuración incompleta: Falta GEMINI_API_KEY.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { messages = [], message } = body;

    let rawHistory = Array.isArray(messages) && messages.length > 0
      ? messages
      : message ? [{ role: 'user', content: message }] : [];

    if (rawHistory.length === 0) {
      return res.status(400).json({ error: 'El campo "messages" es requerido.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    });

    // Sanitización de historial previo
    const pastHistory = rawHistory
      .slice(0, -1)
      .map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : String(msg.content || '') }],
      }))
      .filter((m) => m.parts[0].text.trim().length > 0);

    const lastUserMsg = String(rawHistory[rawHistory.length - 1].content || '');

    const contents = [
      ...pastHistory,
      { role: 'user', parts: [{ text: lastUserMsg }] },
    ];

    const toolCallLog = [];
    const actions = { favorites: [], invites: [], itineraries: [] };
    const MAX_TOOL_HOPS = 5;
    let hops = 0;

    while (hops < MAX_TOOL_HOPS) {
      const result = await generateContentWithRetry(model, { contents });
      const functionCalls = result.response.functionCalls();

      if (!functionCalls || functionCalls.length === 0) {
        return res.status(200).json({
          reply: result.response.text(),
          toolCalls: toolCallLog,
          actions,
        });
      }

      // Preservar el candidato generado por el modelo (contiene thought_signature y functionCall)
      if (result.response.candidates?.[0]?.content) {
        contents.push(result.response.candidates[0].content);
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
        if (toolResult.itinerary.calendarInvite?.downloadUrl) {
          actions.invites.push(toolResult.itinerary.calendarInvite);
        }
      }

      // Enviar la respuesta de la función con role 'user'
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: call.name, response: toolResult } }],
      });

      hops += 1;
    }

    const finalResult = await generateContentWithRetry(model, { contents });

    return res.status(200).json({
      reply: finalResult.response.text(),
      toolCalls: toolCallLog,
      actions,
    });
  } catch (error) {
    console.error('[api/chat] Error en Agente Gemini:', error.message || error);
    return res.status(500).json({
      error: 'Error en API Gemini',
      detail: error.message || String(error),
    });
  }
}
