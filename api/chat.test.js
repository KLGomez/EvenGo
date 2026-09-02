// api/chat.test.js
// Tests de integración para la lógica SSE del handler api/chat.js y el parseador del cliente.
// Corre con: npm test

import { describe, it, expect, beforeEach } from 'vitest';
import handler from './chat.js';

// ─── Utilidad: construye un ReadableStream que emite chunks SSE ───────────────

function makeSSEStream(payloads) {
  const encoder = new TextEncoder();
  const lines = payloads.map((p) => `data: ${JSON.stringify(p)}\n\n`).join('');
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(lines));
      controller.close();
    },
  });
}

// ─── Utilidad: reproduce la lógica de parseo SSE del cliente (ChatBot.jsx) ────
// Extrae todos los payloads que llegarían a setMessages desde el stream.

async function parseSSEStream(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let sseBuffer = '';
  const collected = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    sseBuffer += decoder.decode(value, { stream: true });
    const parts = sseBuffer.split('\n\n');
    sseBuffer = parts.pop();

    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      try {
        collected.push(JSON.parse(raw));
      } catch {
        // ignorar
      }
    }
  }

  return collected;
}

// ─── Tests del parseador SSE del cliente ─────────────────────────────────────

describe('Parseador SSE del cliente (lógica de ChatBot.jsx)', () => {
  it('extrae correctamente chunks de texto individuales', async () => {
    const stream = makeSSEStream([{ text: 'Hola' }, { text: ' mundo' }]);
    const payloads = await parseSSEStream(stream);

    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toEqual({ text: 'Hola' });
    expect(payloads[1]).toEqual({ text: ' mundo' });
  });

  it('reconstruye el texto completo concatenando todos los chunks', async () => {
    const chunks = ['¡Buen', 'os ', 'días ', 'desde ', 'EvenGo!'];
    const stream = makeSSEStream(chunks.map((t) => ({ text: t })));
    const payloads = await parseSSEStream(stream);

    const fullText = payloads.filter((p) => p.text).map((p) => p.text).join('');
    expect(fullText).toBe('¡Buenos días desde EvenGo!');
  });

  it('detecta el evento done y preserva toolCalls y actions', async () => {
    const actions = { favorites: [], invites: [{ title: 'Evento X', filename: 'x.ics' }], itineraries: [] };
    const stream = makeSSEStream([
      { text: 'Listo.' },
      { done: true, toolCalls: [{ tool: 'check_weather' }], actions },
    ]);

    const payloads = await parseSSEStream(stream);
    const donePayload = payloads.find((p) => p.done);

    expect(donePayload).toBeDefined();
    expect(donePayload.toolCalls).toHaveLength(1);
    expect(donePayload.toolCalls[0].tool).toBe('check_weather');
    expect(donePayload.actions.invites).toHaveLength(1);
    expect(donePayload.actions.invites[0].title).toBe('Evento X');
  });

  it('ignora líneas SSE malformadas sin lanzar error', async () => {
    const encoder = new TextEncoder();
    const raw =
      'data: {"text":"Primer chunk"}\n\n' +
      'data: ESTO NO ES JSON\n\n' +
      'data: {"text":" segundo chunk"}\n\n' +
      'data: {"done":true,"toolCalls":[],"actions":{"favorites":[],"invites":[],"itineraries":[]}}\n\n';

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(raw));
        controller.close();
      },
    });

    const payloads = await parseSSEStream(stream);
    const textPayloads = payloads.filter((p) => p.text);

    expect(textPayloads).toHaveLength(2);
    expect(textPayloads.map((p) => p.text).join('')).toBe('Primer chunk segundo chunk');
  });

  it('maneja chunks que llegan partidos a la mitad de una línea SSE', async () => {
    const encoder = new TextEncoder();
    // Simulamos dos chunks TCP: el primero corta a la mitad del segundo evento SSE
    const chunk1 = encoder.encode('data: {"text":"Hola"}\n\ndata: {"tex');
    const chunk2 = encoder.encode('t":" mundo"}\n\n');

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(chunk1);
        controller.enqueue(chunk2);
        controller.close();
      },
    });

    const payloads = await parseSSEStream(stream);
    const fullText = payloads.filter((p) => p.text).map((p) => p.text).join('');
    expect(fullText).toBe('Hola mundo');
  });

  it('maneja un stream vacío (solo done) sin acumular texto', async () => {
    const stream = makeSSEStream([
      { done: true, toolCalls: [], actions: { favorites: [], invites: [], itineraries: [] } },
    ]);
    const payloads = await parseSSEStream(stream);

    expect(payloads.filter((p) => p.text)).toHaveLength(0);
    expect(payloads.find((p) => p.done)).toBeTruthy();
  });
});

// ─── Tests de los helpers SSE del servidor (sseWrite / initSSE) ──────────────

describe('Helpers SSE del servidor', () => {
  let fakeRes;

  beforeEach(() => {
    fakeRes = {
      headersSent: false,
      writtenHeaders: null,
      chunks: [],
      writeHead(status, headers) {
        this.headersSent = true;
        this.writtenHeaders = { status, headers };
      },
      write(chunk) {
        this.chunks.push(chunk);
      },
      end() {
        this.ended = true;
      },
    };
  });

  it('sseWrite emite el formato correcto: data: {...}\\n\\n', () => {
    // Reproduce sseWrite inline (función pura, fácil de aislar)
    function sseWrite(res, payload) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }

    sseWrite(fakeRes, { text: 'Hola' });
    expect(fakeRes.chunks[0]).toBe('data: {"text":"Hola"}\n\n');
  });

  it('initSSE llama a writeHead con los headers correctos', () => {
    function initSSE(res) {
      if (!res.headersSent) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });
      }
    }

    initSSE(fakeRes);
    expect(fakeRes.writtenHeaders.status).toBe(200);
    expect(fakeRes.writtenHeaders.headers['Content-Type']).toBe('text/event-stream');
    expect(fakeRes.writtenHeaders.headers['Cache-Control']).toBe('no-cache');
  });

  it('initSSE es idempotente: no llama writeHead si los headers ya se enviaron', () => {
    function initSSE(res) {
      if (!res.headersSent) {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      }
    }

    fakeRes.headersSent = true; // simula que ya se enviaron
    initSSE(fakeRes);
    expect(fakeRes.writtenHeaders).toBeNull(); // writeHead no debe haberse llamado
  });

  it('el flujo completo servidor→cliente produce el texto correcto', async () => {
    // Simula qué escribiría sseWrite × N en res.chunks y lo re-parsea como cliente
    function sseWrite(res, payload) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }

    sseWrite(fakeRes, { text: 'Buenos Aires' });
    sseWrite(fakeRes, { text: ' te espera' });
    sseWrite(fakeRes, { done: true, toolCalls: [], actions: { favorites: [], invites: [], itineraries: [] } });

    // Convertimos lo escrito en el fakeRes a un stream legible por el cliente
    const encoder = new TextEncoder();
    const raw = fakeRes.chunks.join('');
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(raw));
        controller.close();
      },
    });

    const payloads = await parseSSEStream(stream);
    const text = payloads.filter((p) => p.text).map((p) => p.text).join('');
    const done = payloads.find((p) => p.done);

    expect(text).toBe('Buenos Aires te espera');
    expect(done).toBeTruthy();
  });
});

// ─── Tests FinOps: Data Trimming ──────────────────────────────────────────────

// ── trimForLLM (función copiada del handler para tests unitarios puros) ────────
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

describe('FinOps — trimForLLM()', () => {
  it('elimina campos prefijados con _ en el nivel raíz', () => {
    const input = { count: 3, eventos: [], _fullEvents: [1, 2, 3] };
    const result = trimForLLM(input);
    expect(result).not.toHaveProperty('_fullEvents');
    expect(result).toHaveProperty('count', 3);
    expect(result).toHaveProperty('eventos');
  });

  it('elimina el campo "action" del resultado de tool', () => {
    const input = { saved: true, action: 'SAVE_TO_LOCAL_STORAGE', message: 'ok' };
    const result = trimForLLM(input);
    expect(result).not.toHaveProperty('action');
    expect(result).toHaveProperty('saved', true);
    expect(result).toHaveProperty('message', 'ok');
  });

  it('elimina _raw de checkWeather antes de mandarlo al LLM', () => {
    const weatherFull = {
      clima: 'Despejado ☀️, 22°C',
      recomendacion_ropa: 'Ropa cómoda, ideal para salir.',
      _raw: { willRain: false, rainProbability: 10, tempMaxC: 22, tempMinC: 14 },
    };
    const result = trimForLLM(weatherFull);
    expect(result).not.toHaveProperty('_raw');
    expect(result).toHaveProperty('clima', 'Despejado ☀️, 22°C');
    expect(result).toHaveProperty('recomendacion_ropa', 'Ropa cómoda, ideal para salir.');
  });

  it('elimina _fullEvents y _raw de forma recursiva en objetos anidados', () => {
    const input = {
      itinerary: {
        weather: { tempMaxC: 22, _raw: { willRain: false } },
        _fullEvents: [{ title: 'x' }],
      },
    };
    const result = trimForLLM(input);
    expect(result.itinerary).not.toHaveProperty('_fullEvents');
    expect(result.itinerary.weather).not.toHaveProperty('_raw');
    expect(result.itinerary.weather).toHaveProperty('tempMaxC', 22);
  });

  it('preserva arrays sin modificarlos (no itera dentro de arrays)', () => {
    const eventos = [{ titulo: 'Evento A', _interna: 'ignorada' }];
    const input = { count: 1, eventos };
    const result = trimForLLM(input);
    // Los arrays se pasan tal cual; el trimmer no itera dentro de ellos
    expect(result.eventos).toEqual(eventos);
  });

  it('maneja null y undefined sin lanzar error', () => {
    expect(trimForLLM(null)).toBeNull();
    expect(trimForLLM(undefined)).toBeUndefined();
  });

  it('pasa primitivos sin modificarlos', () => {
    expect(trimForLLM('texto')).toBe('texto');
    expect(trimForLLM(42)).toBe(42);
  });
});

describe('FinOps — esquema slim de searchEvents (resultsForLLM)', () => {
  // Simula el map que hace searchEvents sobre un evento crudo de la API Linda
  const mockRawEvent = {
    id: 'abc-123',
    title: 'Festival de Jazz en Palermo',
    fechaInicio: '2026-09-10T20:00:00',
    barrio: 'Palermo',
    direccion: 'Av. Santa Fe 3400, Buenos Aires',
    acceso: 'sin_costo',
    pathAlias: '/eventos/jazz-palermo',
    description: 'Un festival increíble con más de 20 bandas en vivo. '.repeat(10), // descripción larga
  };

  // Reproduce el map de searchEvents
  const toFullResult = (e) => ({
    id: e.id || `linda-${Date.now()}`,
    title: e.title,
    date: e.fechaInicio ? e.fechaInicio.slice(0, 10) : null,
    barrio: e.barrio || null,
    address: e.direccion || null,
    price: e.acceso === 'sin_costo' ? 'Gratuito' : e.precio || 'Consultar',
    url: e.pathAlias ? `https://linda.buenosaires.gob.ar${e.pathAlias}` : null,
    anchorLink: `#event-${e.id}`,
    description: e.description,
  });

  const toSlimResult = (e) => ({
    titulo: e.title,
    fecha: e.fechaInicio ? e.fechaInicio.slice(0, 10) : null,
    barrio: e.barrio || null,
    lugar: e.direccion || null,
    precio: e.acceso === 'sin_costo' ? 'Gratuito' : e.precio || 'Consultar',
    anchorLink: `#event-${e.id}`,
    ...(e.description ? { descripcion: String(e.description).slice(0, 150) } : {}),
  });

  it('el objeto slim NO contiene id, url ni source', () => {
    const slim = toSlimResult(mockRawEvent);
    expect(slim).not.toHaveProperty('id');
    expect(slim).not.toHaveProperty('url');
    expect(slim).not.toHaveProperty('source');
  });

  it('el objeto slim contiene titulo, fecha, barrio, lugar, precio y anchorLink', () => {
    const slim = toSlimResult(mockRawEvent);
    expect(slim).toHaveProperty('titulo', 'Festival de Jazz en Palermo');
    expect(slim).toHaveProperty('fecha', '2026-09-10');
    expect(slim).toHaveProperty('barrio', 'Palermo');
    expect(slim).toHaveProperty('lugar', 'Av. Santa Fe 3400, Buenos Aires');
    expect(slim).toHaveProperty('precio', 'Gratuito');
    expect(slim).toHaveProperty('anchorLink', '#event-abc-123');
  });

  it('la descripción queda truncada a máximo 150 caracteres', () => {
    const slim = toSlimResult(mockRawEvent);
    expect(slim.descripcion).toBeDefined();
    expect(slim.descripcion.length).toBeLessThanOrEqual(150);
  });

  it('el objeto COMPLETO (para el frontend) mantiene id y url', () => {
    const full = toFullResult(mockRawEvent);
    expect(full).toHaveProperty('id', 'abc-123');
    expect(full).toHaveProperty('url', 'https://linda.buenosaires.gob.ar/eventos/jazz-palermo');
    expect(full).toHaveProperty('anchorLink', '#event-abc-123');
  });

  it('el slim es siempre más pequeño que el full en bytes', () => {
    const slim = toSlimResult(mockRawEvent);
    const full = toFullResult(mockRawEvent);
    const slimSize = JSON.stringify(slim).length;
    const fullSize = JSON.stringify(full).length;
    expect(slimSize).toBeLessThan(fullSize);
  });
});

describe('FinOps — esquema trimmeado de checkWeather (Reglas CABA/AMBA)', () => {
  const AMBA_WEATHER_CONFIG = {
    RAIN: {
      PROBABILITY_THRESHOLD_PCT: 30,
      KEYWORDS: ['rain', 'drizzle', 'shower', 'thunderstorm', 'storm', 'lluvia', 'llovizna', 'tormenta', 'chaparrón']
    },
    TEMP: {
      EXTREME_COLD_MAX: 9.9,
      COLD_MAX: 15.9,
      TEMPERATE_MAX: 24.9,
      HOT_MIN: 25
    }
  };

  const evaluateBuenosAiresRules = ({ temp, rainProb = 0, condition = '' }) => {
    const norm = condition.toLowerCase();
    const isRain = rainProb >= AMBA_WEATHER_CONFIG.RAIN.PROBABILITY_THRESHOLD_PCT ||
      AMBA_WEATHER_CONFIG.RAIN.KEYWORDS.some((kw) => norm.includes(kw));

    let baseAdvice = '';
    if (temp < AMBA_WEATHER_CONFIG.TEMP.EXTREME_COLD_MAX) {
      baseAdvice = 'Llevar abrigo pesado (campera abrigada)';
    } else if (temp <= AMBA_WEATHER_CONFIG.TEMP.COLD_MAX) {
      baseAdvice = 'Llevar abrigo o campera';
    } else if (temp <= AMBA_WEATHER_CONFIG.TEMP.TEMPERATE_MAX) {
      baseAdvice = 'Ropa cómoda, ideal para salir';
    } else {
      baseAdvice = 'Día caluroso. Llevar ropa muy fresca y botellita de agua por la humedad';
    }

    if (isRain) {
      return baseAdvice.startsWith('Día caluroso')
        ? `${baseAdvice}, y llevar paraguas por posible lluvia.`
        : `${baseAdvice} y llevar paraguas por posible lluvia.`;
    }
    return `${baseAdvice}.`;
  };

  const buildWeatherResult = (weatherCode, rainProb, tempMax, tempMin) => {
    const condicion = (() => {
      if (weatherCode === 0)   return 'Despejado ☀️';
      if (weatherCode <= 3)   return 'Parcialmente nublado 🌤️';
      if (weatherCode <= 48)  return 'Nublado / Niebla ☁️';
      if (weatherCode <= 67)  return 'Lluvia 🌧️';
      if (weatherCode <= 77)  return 'Nieve / Granizo ❄️';
      if (weatherCode <= 82)  return 'Lluvias intermitentes 🌦️';
      return 'Tormenta eléctrica ⛈️';
    })();
    const willRain = rainProb >= AMBA_WEATHER_CONFIG.RAIN.PROBABILITY_THRESHOLD_PCT;
    const recomendacion_ropa = evaluateBuenosAiresRules({ temp: tempMax, rainProb, condition: condicion });
    const clima = `${condicion}, ${Math.round(tempMax)}°C`;

    return {
      clima,
      recomendacion_ropa,
      _raw: { willRain, rainProbability: rainProb, tempMaxC: tempMax, tempMinC: tempMin, condicion, recomendacion_ropa },
    };
  };

  it('weatherCode=0 produce condición "Despejado ☀️, 22°C"', () => {
    const r = buildWeatherResult(0, 5, 22, 14);
    expect(r.clima).toBe('Despejado ☀️, 22°C');
  });

  it('weatherCode=61 produce condición "Lluvia 🌧️, 16°C"', () => {
    const r = buildWeatherResult(61, 70, 16, 10);
    expect(r.clima).toBe('Lluvia 🌧️, 16°C');
  });

  it('weatherCode=95 produce condición "Tormenta eléctrica ⛈️, 18°C"', () => {
    const r = buildWeatherResult(95, 90, 18, 13);
    expect(r.clima).toBe('Tormenta eléctrica ⛈️, 18°C');
  });

  it('recomendacion_ropa → paraguas cuando prob_lluvia >= 30% (umbral porteño)', () => {
    const r = buildWeatherResult(0, 35, 22, 14);
    expect(r.recomendacion_ropa).toContain('llevar paraguas');
  });

  it('recomendacion_ropa → calor y agua cuando temp > 25°C', () => {
    const r = buildWeatherResult(0, 10, 28, 20);
    expect(r.recomendacion_ropa).toContain('Día caluroso');
    expect(r.recomendacion_ropa).toContain('botellita de agua');
  });

  it('recomendacion_ropa → ropa cómoda cuando temp entre 16°C y 24°C', () => {
    const r = buildWeatherResult(0, 10, 21, 15);
    expect(r.recomendacion_ropa).toBe('Ropa cómoda, ideal para salir.');
  });

  it('recomendacion_ropa → abrigo o campera cuando temp entre 10°C y 15°C', () => {
    const r = buildWeatherResult(0, 10, 14, 8);
    expect(r.recomendacion_ropa).toBe('Llevar abrigo o campera.');
  });

  it('recomendacion_ropa → abrigo pesado cuando temp < 10°C (frío extremo húmedo)', () => {
    const r = buildWeatherResult(0, 10, 8, 3);
    expect(r.recomendacion_ropa).toBe('Llevar abrigo pesado (campera abrigada).');
  });

  it('el resultado NO contiene source ni willRain en el nivel raíz', () => {
    const r = buildWeatherResult(0, 5, 22, 14);
    expect(r).not.toHaveProperty('source');
    expect(r).not.toHaveProperty('willRain');
  });

  it('_raw contiene los campos que necesita planItinerary internamente', () => {
    const r = buildWeatherResult(0, 5, 22, 14);
    expect(r._raw).toHaveProperty('willRain', false);
    expect(r._raw).toHaveProperty('tempMaxC', 22);
    expect(r._raw).toHaveProperty('tempMinC', 14);
    expect(r._raw).toHaveProperty('rainProbability', 5);
  });

  it('después de trimForLLM, _raw desaparece y solo quedan clima y recomendacion_ropa', () => {
    const r = buildWeatherResult(0, 5, 22, 14);
    const forLLM = trimForLLM(r);
    expect(forLLM).not.toHaveProperty('_raw');
    expect(forLLM).toHaveProperty('clima');
    expect(forLLM).toHaveProperty('recomendacion_ropa');
  });

  it('el payload LLM es significativamente más pequeño que el JSON crudo de Open-Meteo', () => {
    const rawOpenMeteo = {
      latitude: -34.6037,
      longitude: -58.3816,
      elevation: 25.0,
      generationtime_ms: 0.21,
      utc_offset_seconds: -10800,
      timezone: 'America/Argentina/Buenos_Aires',
      timezone_abbreviation: '-03',
      daily_units: { time: 'iso8601', temperature_2m_max: '°C', temperature_2m_min: '°C', precipitation_probability_max: '%', weathercode: 'wmo code' },
      daily: {
        time: ['2026-08-25'],
        temperature_2m_max: [22],
        temperature_2m_min: [14],
        precipitation_probability_max: [5],
        weathercode: [0],
      },
    };
    const r = buildWeatherResult(0, 5, 22, 14);
    const forLLM = trimForLLM(r);

    const rawSize = JSON.stringify(rawOpenMeteo).length;
    const llmSize = JSON.stringify(forLLM).length;

    expect(llmSize).toBeLessThan(rawSize * 0.3); // más de 70% de reducción
  });
});

// ─── Tests Ventana Deslizante del Historial (Sliding Window) ──────────────────

// Reproduce la lógica de applyWindow() del handler para tests unitarios puros.
// Recibe el array rawHistory completo (incluyendo el último mensaje del usuario)
// y devuelve { normalizedHistory, lastUserMsg } listos para construir contents[].

function applyWindow(rawHistory, windowTurns = 10) {
  const MAX_HISTORY_MSGS = windowTurns * 2;
  const historyWithoutLast = rawHistory.slice(0, -1);

  const windowedHistory = historyWithoutLast.length > MAX_HISTORY_MSGS
    ? historyWithoutLast.slice(-MAX_HISTORY_MSGS)
    : historyWithoutLast;

  const normalizedHistory = windowedHistory
    .map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: typeof msg.content === 'string' ? msg.content : String(msg.content || '') }],
    }))
    .filter((m) => m.parts[0].text.trim().length > 0);

  // Garantizar invariante: el primer mensaje siempre debe ser role:'user'
  while (normalizedHistory.length > 0 && normalizedHistory[0].role !== 'user') {
    normalizedHistory.shift();
  }

  const lastUserMsg = String(rawHistory[rawHistory.length - 1].content || '');
  return { normalizedHistory, lastUserMsg };
}

// Helper: genera N pares user/assistant de forma determinista
function buildHistory(turns) {
  const history = [];
  for (let i = 1; i <= turns; i++) {
    history.push({ role: 'user', content: `Pregunta ${i}` });
    history.push({ role: 'assistant', content: `Respuesta ${i}` });
  }
  return history;
}

describe('FinOps — Ventana Deslizante del Historial (Sliding Window)', () => {
  it('no recorta el historial cuando está dentro de la ventana', () => {
    // 3 pares históricos + 1 mensaje actual (ventana = 10)
    const history = [...buildHistory(3), { role: 'user', content: 'Pregunta actual' }];
    const { normalizedHistory } = applyWindow(history, 10);
    // Los 3 pares (6 mensajes) deben estar íntegros
    expect(normalizedHistory).toHaveLength(6);
  });

  it('recorta el historial cuando supera el tamaño de la ventana', () => {
    // 15 pares históricos + 1 mensaje actual (ventana = 10)
    const history = [...buildHistory(15), { role: 'user', content: 'Pregunta actual' }];
    const { normalizedHistory } = applyWindow(history, 10);
    // Solo los últimos 10 pares (20 mensajes) deben quedar
    expect(normalizedHistory).toHaveLength(20);
  });

  it('preserva siempre el último mensaje del usuario (la pregunta actual)', () => {
    const history = [...buildHistory(15), { role: 'user', content: 'Consulta específica' }];
    const { lastUserMsg } = applyWindow(history, 10);
    expect(lastUserMsg).toBe('Consulta específica');
  });

  it('el último mensaje NO forma parte de normalizedHistory (va en lastUserMsg)', () => {
    const history = [...buildHistory(3), { role: 'user', content: 'Pregunta final' }];
    const { normalizedHistory } = applyWindow(history, 10);
    // normalizedHistory tiene los 3 pares (6 msgs), sin la pregunta final
    const textos = normalizedHistory.map((m) => m.parts[0].text);
    expect(textos).not.toContain('Pregunta final');
  });

  it('garantiza invariante: normalizedHistory siempre empieza con role "user"', () => {
    // Construimos un historial donde el recorte dejaría "model" primero
    // Esto ocurre cuando el turn más antiguo en la ventana es una respuesta del asistente
    const history = [
      { role: 'user',      content: 'Mensaje viejo 1' },
      { role: 'assistant', content: 'Respuesta vieja 1' },
      { role: 'user',      content: 'Mensaje viejo 2' },
      { role: 'assistant', content: 'Respuesta vieja 2' },
      { role: 'user',      content: 'Pregunta actual' },
    ];
    // Ventana de 1 turno → solo queda "Respuesta vieja 2" (model) antes del recorte
    // El invariante debe eliminarla y dejar el array vacío (no romper Gemini)
    const { normalizedHistory } = applyWindow(history, 1);
    if (normalizedHistory.length > 0) {
      expect(normalizedHistory[0].role).toBe('user');
    }
  });

  it('con historial vacío (primera consulta) devuelve normalizedHistory vacío', () => {
    const history = [{ role: 'user', content: 'Primera pregunta' }];
    const { normalizedHistory, lastUserMsg } = applyWindow(history, 10);
    expect(normalizedHistory).toHaveLength(0);
    expect(lastUserMsg).toBe('Primera pregunta');
  });

  it('el tamaño de la ventana es configurable (windowTurns=3 → max 6 msgs de historia)', () => {
    const history = [...buildHistory(10), { role: 'user', content: 'Pregunta actual' }];
    const { normalizedHistory } = applyWindow(history, 3);
    expect(normalizedHistory).toHaveLength(6); // 3 pares × 2 mensajes
  });

  it('la ventana toma los turnos MÁS RECIENTES, no los primeros', () => {
    const history = [...buildHistory(5), { role: 'user', content: 'Pregunta actual' }];
    // Ventana de 2 → deben quedar los pares 4 y 5 (los más recientes)
    const { normalizedHistory } = applyWindow(history, 2);
    expect(normalizedHistory).toHaveLength(4);
    const textos = normalizedHistory.map((m) => m.parts[0].text);
    expect(textos).toContain('Pregunta 4');
    expect(textos).toContain('Respuesta 4');
    expect(textos).toContain('Pregunta 5');
    expect(textos).toContain('Respuesta 5');
    expect(textos).not.toContain('Pregunta 1');
  });

  it('normaliza role "assistant" a "model" para compatibilidad con Gemini API', () => {
    const history = [
      { role: 'user',      content: 'Hola' },
      { role: 'assistant', content: 'Buenos días' },
      { role: 'user',      content: 'Pregunta actual' },
    ];
    const { normalizedHistory } = applyWindow(history, 10);
    const roles = normalizedHistory.map((m) => m.role);
    expect(roles).toContain('user');
    expect(roles).toContain('model');
    expect(roles).not.toContain('assistant');
  });

  it('filtra mensajes con content vacío o de espacios', () => {
    const history = [
      { role: 'user',      content: 'Mensaje válido' },
      { role: 'assistant', content: '   ' },       // solo espacios → debe filtrarse
      { role: 'user',      content: '' },           // vacío → debe filtrarse
      { role: 'assistant', content: 'OK' },
      { role: 'user',      content: 'Pregunta actual' },
    ];
    const { normalizedHistory } = applyWindow(history, 10);
    const textos = normalizedHistory.map((m) => m.parts[0].text);
    expect(textos).not.toContain('   ');
    expect(textos).not.toContain('');
    expect(textos).toContain('Mensaje válido');
    expect(textos).toContain('OK');
  });
});

// ─── Tests del Short-circuit de Saludos (api/chat.js) ─────────────────────────

describe('Short-circuit de Saludos en api/chat.js', () => {
  function createMockRes() {
    return {
      headers: {},
      statusCode: 200,
      headersSent: false,
      chunks: [],
      ended: false,
      setHeader(key, val) {
        this.headers[key] = val;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        this.ended = true;
        return this;
      },
      writeHead(status, headers) {
        this.statusCode = status;
        this.headersSent = true;
        Object.assign(this.headers, headers);
      },
      write(chunk) {
        this.chunks.push(chunk);
      },
      end() {
        this.ended = true;
      },
    };
  }

  it.each([
    '¡Hola!',
    '¿Hola?',
    'hola',
    '¡Buenas!',
    '¿Buenas tardes?',
    'buenos dias',
    '¡Buen día!',
    'hey',
    'hi',
    'hello',
    'saludos',
    '¿Cómo estás?',
    '¡Qué tal!',
  ])('intercepta saludo "%s" y responde con stream SSE sin invocar IA', async (greeting) => {
    const req = {
      method: 'POST',
      body: { messages: [{ role: 'user', content: greeting }] },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.ended).toBe(true);
    expect(res.headers['Content-Type']).toBe('text/event-stream');
    expect(res.chunks.length).toBeGreaterThanOrEqual(2);

    // Primer chunk: texto de saludo
    const textChunk = JSON.parse(res.chunks[0].replace(/^data: /, '').trim());
    expect(textChunk.text).toContain('¡Hola! 👋 Soy tu Concierge de EvenGo');

    // Segundo chunk: cierre de stream
    const doneChunk = JSON.parse(res.chunks[1].replace(/^data: /, '').trim());
    expect(doneChunk.done).toBe(true);
  });

  it('funciona también cuando se envía el campo "message" como string único', async () => {
    const req = {
      method: 'POST',
      body: { message: '¡Hola!' },
    };
    const res = createMockRes();

    await handler(req, res);

    expect(res.ended).toBe(true);
    expect(res.headers['Content-Type']).toBe('text/event-stream');
    const textChunk = JSON.parse(res.chunks[0].replace(/^data: /, '').trim());
    expect(textChunk.text).toContain('EvenGo');
  });
});
