import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { createEvent } from 'ics';

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

    // Objeto COMPLETO → se guarda en toolCallLog y se entrega al frontend
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

    // ── FinOps: Objeto SLIM → lo único que necesita el LLM para razonar ────────
    // Elimina: id interno, url externa, source. Trunca descripción a 150 chars.
    // Ahorro estimado: ~40-60% de tokens por herramienta de eventos.
    const resultsForLLM = results.map((e) => ({
      titulo: e.title,
      fecha: e.date,
      barrio: e.barrio,
      lugar: e.address,
      precio: e.price,
      anchorLink: e.anchorLink,
      ...(e.description
        ? { descripcion: String(e.description).slice(0, 150) }
        : {}),
    }));

    return {
      count: results.length,
      eventos: resultsForLLM,   // ← payload al LLM (slim)
      _fullEvents: results,      // ← payload al frontend (marcado con _ para excluirlo en el trim de abajo)
    };
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
    const weatherCode = data.daily.weathercode?.[i] ?? 0;
    const tempMax = data.daily.temperature_2m_max[i];
    const tempMin = data.daily.temperature_2m_min[i];
    const willRain = rainProb >= 50;

    // ── FinOps: condición WMO → string semántico legible por el LLM ─────────
    // Elimina: lat/lon, elevación, arrays horarios, 'source', booleano willRain.
    // El LLM necesita UNA frase de condición, no un código numérico crudo.
    // Ahorro estimado: ~70% de tokens respecto al JSON completo de Open-Meteo.
    const condicion = (() => {
      if (weatherCode === 0)              return 'Despejado ☀️';
      if (weatherCode <= 3)              return 'Parcialmente nublado 🌤️';
      if (weatherCode <= 48)             return 'Nublado / Niebla ☁️';
      if (weatherCode <= 67)             return 'Lluvia 🌧️';
      if (weatherCode <= 77)             return 'Nieve / Granizo ❄️';
      if (weatherCode <= 82)             return 'Lluvias intermitentes 🌦️';
      return 'Tormenta eléctrica ⛈️';
    })();

    // Consejo de vestimenta pre-calculado aquí para no gastar tokens en razonamiento del LLM
    const consejo_ropa = willRain
      ? 'Llevar paraguas o piloto impermeable.'
      : tempMax > 26
      ? 'Ropa fresca y protector solar.'
      : tempMin < 13
      ? 'Abrigar con campera liviana o sweater.'
      : 'Ropa cómoda, clima agradable.';

    return {
      fecha: targetDate,
      temp_max_c: tempMax,
      temp_min_c: tempMin,
      prob_lluvia_pct: rainProb,
      condicion,
      consejo_ropa,
      // _raw: usado internamente por planItinerary para la tarjeta del frontend
      _raw: { willRain, rainProbability: rainProb, tempMaxC: tempMax, tempMinC: tempMin },
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

  // clothingTip: reutiliza el consejo_ropa pre-calculado en checkWeather
  const clothingTip = weatherResult.consejo_ropa
    ?? (willRain
      ? '⚠️ Alta probabilidad de lluvia: Se sugiere llevar paraguas o piloto.'
      : tempMax > 26
      ? '☀️ Día caluroso: Se recomienda ropa fresca e hidratación.'
      : tempMin < 13
      ? '🌙 Noche fresca: Se aconseja llevar un abrigo liviano.'
      : '🌤️ Clima favorable para paseos al aire libre.');

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
      alternativeEvents: events.slice(1, 4),
      timeline: [
        { time: '18:00', activity: `Encuentro y café en ${barrio || 'la zona del evento'}` },
        { time: primaryEvent.time || '19:30', activity: `Evento Destacado: ${primaryEvent.title}` },
        { time: '21:30', activity: 'Sugerencia gastronómica / Tapeo en la zona' },
      ],
      logistics: {
        clothingTip,
        transportTip: `Dirección principal: ${primaryEvent.address || primaryEvent.lugar || 'Buenos Aires'}`,
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
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
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

    // ── PLAN A: Proveedor Primario (Gemini) con generateContentStream ─────────
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Configuración incompleta: Falta GEMINI_API_KEY.');

    const modelName = 'gemini-flash-latest';
    console.log(`[api/chat] Inicializando modelo Gemini streaming: "${modelName}"`);

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
    });

    const pastHistory = rawHistory
      .slice(0, -1)
      .map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : String(msg.content || '') }],
      }))
      .filter((m) => m.parts[0].text.trim().length > 0);

    const lastUserMsg = String(rawHistory[rawHistory.length - 1].content || '');
    const contents = [...pastHistory, { role: 'user', parts: [{ text: lastUserMsg }] }];

    const toolCallLog = [];
    const actions = { favorites: [], invites: [], itineraries: [] };
    const MAX_TOOL_HOPS = 5;
    let hops = 0;

    // Resolvemos tool-calls de forma NO-streaming en los saltos intermedios.
    while (hops < MAX_TOOL_HOPS) {
      const midResult = await generateContentWithRetry(model, { contents });
      const functionCalls = midResult.response.functionCalls();

      if (!functionCalls || functionCalls.length === 0) {
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
        if (toolResult.itinerary.calendarInvite?.downloadUrl) {
          actions.invites.push(toolResult.itinerary.calendarInvite);
        }
      }

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

      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: call.name, response: trimForLLM(toolResult) } }],
      });

      hops += 1;
    }

    // ── Turno final: generamos el texto en modo STREAM ────────────────────────
    initSSE(res);

    const streamResult = await model.generateContentStream({ contents });

    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        sseWrite(res, { text: chunkText });
      }
    }

    sseWrite(res, { done: true, toolCalls: toolCallLog, actions });
    res.end();
    return;

  } catch (geminiError) {
    console.error('[api/chat] Error en proveedor primario (Gemini):', geminiError.message || geminiError);

    // ── PLAN B: Fallback a Groq con stream: true ──────────────────────────────
    const groqApiKey = process.env.GROQ_API_KEY || process.env.FALLBACK_API_KEY;
    if (groqApiKey) {
      try {
        console.log('[api/chat] Groq: Intentando respuesta vía Fallback streaming (llama-3.1-8b-instant)...');

        const groqMessages = [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          ...rawHistory.map((m) => ({
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
            model: 'llama-3.1-8b-instant',
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
            } catch {}
          }
        }

        if (buffer.trim().startsWith('data:')) {
          const raw = buffer.trim().slice(5).trim();
          if (raw && raw !== '[DONE]') {
            try {
              const parsed = JSON.parse(raw);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) sseWrite(res, { text: content });
            } catch {}
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
      console.warn('[api/chat] Groq: Variable GROQ_API_KEY no configurada. Omitiendo Plan B.');
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
