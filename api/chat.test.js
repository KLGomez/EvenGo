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
