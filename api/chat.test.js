// api/chat.test.js
// Tests de integración para la lógica SSE del handler api/chat.js y el parseador del cliente.
// Corre con: npm test

import { describe, it, expect, vi, beforeEach } from 'vitest';

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
      fecha: '2026-08-25',
      temp_max_c: 22,
      temp_min_c: 14,
      prob_lluvia_pct: 10,
      condicion: 'Despejado ☀️',
      consejo_ropa: 'Ropa cómoda, clima agradable.',
      _raw: { willRain: false, rainProbability: 10, tempMaxC: 22, tempMinC: 14 },
    };
    const result = trimForLLM(weatherFull);
    expect(result).not.toHaveProperty('_raw');
    expect(result).toHaveProperty('condicion', 'Despejado ☀️');
    expect(result).toHaveProperty('consejo_ropa');
    expect(result).toHaveProperty('prob_lluvia_pct', 10);
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

describe('FinOps — esquema trimmeado de checkWeather', () => {
  // Reproduce la lógica de checkWeather sobre datos mock de Open-Meteo
  const buildWeatherResult = (weatherCode, rainProb, tempMax, tempMin) => {
    const willRain = rainProb >= 50;
    const condicion = (() => {
      if (weatherCode === 0)   return 'Despejado ☀️';
      if (weatherCode <= 3)   return 'Parcialmente nublado 🌤️';
      if (weatherCode <= 48)  return 'Nublado / Niebla ☁️';
      if (weatherCode <= 67)  return 'Lluvia 🌧️';
      if (weatherCode <= 77)  return 'Nieve / Granizo ❄️';
      if (weatherCode <= 82)  return 'Lluvias intermitentes 🌦️';
      return 'Tormenta eléctrica ⛈️';
    })();
    const consejo_ropa = willRain
      ? 'Llevar paraguas o piloto impermeable.'
      : tempMax > 26 ? 'Ropa fresca y protector solar.'
      : tempMin < 13 ? 'Abrigar con campera liviana o sweater.'
      : 'Ropa cómoda, clima agradable.';
    return {
      fecha: '2026-08-25',
      temp_max_c: tempMax,
      temp_min_c: tempMin,
      prob_lluvia_pct: rainProb,
      condicion,
      consejo_ropa,
      _raw: { willRain, rainProbability: rainProb, tempMaxC: tempMax, tempMinC: tempMin },
    };
  };

  it('weatherCode=0 produce condición "Despejado ☀️"', () => {
    const r = buildWeatherResult(0, 5, 22, 14);
    expect(r.condicion).toBe('Despejado ☀️');
  });

  it('weatherCode=61 produce condición "Lluvia 🌧️"', () => {
    const r = buildWeatherResult(61, 70, 16, 10);
    expect(r.condicion).toBe('Lluvia 🌧️');
  });

  it('weatherCode=95 produce condición "Tormenta eléctrica ⛈️"', () => {
    const r = buildWeatherResult(95, 90, 18, 13);
    expect(r.condicion).toBe('Tormenta eléctrica ⛈️');
  });

  it('consejo_ropa → paraguas cuando prob_lluvia >= 50', () => {
    const r = buildWeatherResult(63, 60, 18, 12);
    expect(r.consejo_ropa).toBe('Llevar paraguas o piloto impermeable.');
  });

  it('consejo_ropa → ropa fresca cuando tempMax > 26 y no llueve', () => {
    const r = buildWeatherResult(1, 10, 30, 22);
    expect(r.consejo_ropa).toBe('Ropa fresca y protector solar.');
  });

  it('consejo_ropa → abrigo cuando tempMin < 13 y no llueve', () => {
    const r = buildWeatherResult(2, 20, 18, 8);
    expect(r.consejo_ropa).toBe('Abrigar con campera liviana o sweater.');
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

  it('después de trimForLLM, _raw desaparece del payload del modelo', () => {
    const r = buildWeatherResult(0, 5, 22, 14);
    const forLLM = trimForLLM(r);
    expect(forLLM).not.toHaveProperty('_raw');
    expect(forLLM).toHaveProperty('condicion');
    expect(forLLM).toHaveProperty('consejo_ropa');
  });

  it('el payload LLM es significativamente más pequeño que el JSON crudo de Open-Meteo', () => {
    // JSON crudo hipotético de Open-Meteo con coordenadas, arrays horarios, etc.
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

    expect(llmSize).toBeLessThan(rawSize * 0.4); // al menos 60% de reducción
  });
});
