import fs from 'fs';
import path from 'path';
import handler from '../api/chat.js';

// ─── Carga manual de .env ─────────────────────────────────────────────────────
function loadEnvFile() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.slice(0, idx).trim();
          const val = trimmed.slice(idx + 1).trim();
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  } catch { /* ignorar si no existe */ }
}

loadEnvFile();

// ─── Snapshot de env para restaurar entre tests ───────────────────────────────
const ORIGINAL_ENV = {
  GEMINI_API_KEY:   process.env.GEMINI_API_KEY,
  GROQ_API_KEY:     process.env.GROQ_API_KEY,
  FALLBACK_API_KEY: process.env.FALLBACK_API_KEY,
};

function restoreEnv() {
  for (const [key, val] of Object.entries(ORIGINAL_ENV)) {
    if (val !== undefined) process.env[key] = val;
    else delete process.env[key];
  }
}

// ─── Mock req/res compatible con el handler SSE ───────────────────────────────
// El handler usa res.write() (chunks SSE) y res.end(), nunca res.json() en el
// flujo normal. Este mock captura ambos formatos para cubrir todos los paths.
function createMockReqRes(body) {
  const req = { method: 'POST', body };

  let statusCode = 200;
  let jsonBody    = null;
  const sseChunks = [];
  const headers   = {};

  const res = {
    headersSent: false,
    setHeader(key, value)  { headers[key] = value; return res; },
    writeHead(code, hdrs)  {
      statusCode = code;
      Object.assign(headers, hdrs);
      res.headersSent = true;
      return res;
    },
    status(code)  { statusCode = code; return res; },
    json(data)    { jsonBody = data;   return res; },
    write(chunk)  { sseChunks.push(chunk); return res; },
    end()         { return res; },

    // ── Helpers de inspección ─────────────────────────────────────────────
    getStatus:  () => statusCode,
    getJson:    () => jsonBody,
    getHeaders: () => headers,

    /** Parsea todos los chunks SSE y devuelve un array de payloads JSON. */
    getParsedSSE() {
      const raw = sseChunks.join('');
      const payloads = [];
      for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.slice(5).trim();
        try { payloads.push(JSON.parse(data)); } catch { /* ignorar */ }
      }
      return payloads;
    },

    /** Concatena todos los fragmentos de texto del stream SSE. */
    getSSEText() {
      return this.getParsedSSE()
        .filter(p => p.text)
        .map(p => p.text)
        .join('');
    },

    /** Devuelve el payload de cierre {done:true,...} si existe. */
    getSSEDone() {
      return this.getParsedSSE().find(p => p.done === true) ?? null;
    },
  };

  return { req, res };
}

// ─── Colores de consola ───────────────────────────────────────────────────────
const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';

// ─── Suite de tests ───────────────────────────────────────────────────────────
async function runTests() {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}   SUITE DE ALTA DISPONIBILIDAD — EvenGo API Chat        ${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════════${RESET}\n`);

  let passCount = 0;
  let failCount = 0;

  // ── Test 1: Happy Path — Gemini (Plan A) ──────────────────────────────────
  try {
    restoreEnv();
    console.log(`${BOLD}Test 1: Happy Path — Proveedor Primario Gemini (Plan A)${RESET}`);

    const { req, res } = createMockReqRes({
      messages: [{ role: 'user', content: 'hola' }],
    });

    await handler(req, res);

    const text = res.getSSEText();
    const done = res.getSSEDone();

    if (text.length > 0 && done) {
      console.log(`  ${GREEN}✔ [PASS] Stream SSE recibido con texto y señal done.${RESET}`);
      console.log(`    ${YELLOW}Preview: "${text.slice(0, 80).replace(/\n/g, ' ')}..."${RESET}`);
      passCount++;
    } else {
      console.log(`  ${RED}✘ [FAIL] Sin texto SSE o sin done. text.length=${text.length}, done=${!!done}${RESET}`);
      failCount++;
    }
  } catch (err) {
    console.log(`  ${RED}✘ [FAIL] Excepción en Test 1: ${err.message}${RESET}`);
    failCount++;
  }

  // ── Test 2: Fallback — Groq llama-3.3-70b-versatile (Plan B) ─────────────
  try {
    restoreEnv();
    console.log(`\n${BOLD}Test 2: Fallback Groq — llama-3.3-70b-versatile (Plan B)${RESET}`);

    // Forzamos fallo en Gemini con key inválida
    process.env.GEMINI_API_KEY = 'invalid_gemini_key_simulation_test2';

    const groqKey = process.env.GROQ_API_KEY;
    if (!groqKey) {
      console.log(`  ${YELLOW}⚠ [SKIP] GROQ_API_KEY no configurada en el entorno local.${RESET}`);
      console.log(`    Para probar el Plan B: GROQ_API_KEY=gsk_... node scripts/verify-ha-chat.js`);
    } else {
      const { req, res } = createMockReqRes({
        messages: [{ role: 'user', content: '¿Qué eventos hay hoy en Buenos Aires?' }],
      });

      await handler(req, res);

      const text = res.getSSEText();
      const done = res.getSSEDone();

      if (text.length > 0 && done) {
        console.log(`  ${GREEN}✔ [PASS] Fallback Groq operativo. Stream SSE con texto y done recibidos.${RESET}`);
        console.log(`    ${YELLOW}Preview: "${text.slice(0, 80).replace(/\n/g, ' ')}..."${RESET}`);
        passCount++;
      } else {
        console.log(`  ${RED}✘ [FAIL] Sin texto SSE o sin done en fallback Groq. text.length=${text.length}, done=${!!done}${RESET}`);
        failCount++;
      }
    }
  } catch (err) {
    console.log(`  ${RED}✘ [FAIL] Excepción en Test 2: ${err.message}${RESET}`);
    failCount++;
  }

  // ── Test 3: Graceful Degradation — Respuesta estática (Plan C) ────────────
  try {
    restoreEnv();
    console.log(`\n${BOLD}Test 3: Graceful Degradation — Respuesta estática (Plan C)${RESET}`);

    process.env.GEMINI_API_KEY = 'invalid_gemini_key_simulation_test3';
    delete process.env.GROQ_API_KEY;
    delete process.env.FALLBACK_API_KEY;

    const { req, res } = createMockReqRes({
      messages: [{ role: 'user', content: 'hola' }],
    });

    await handler(req, res);

    const text = res.getSSEText();
    const done = res.getSSEDone();
    const EXPECTED =
      '¡Uf! Estoy procesando demasiadas consultas y agoté mis créditos de IA temporalmente. 😅 Mientras recupero energía, te invito a explorar las tarjetas de eventos utilizando los filtros de arriba.';

    if (text === EXPECTED && done) {
      console.log(`  ${GREEN}✔ [PASS] Mensaje estático de contingencia validado exactamente.${RESET}`);
      console.log(`  ${GREEN}✔ [PASS] Señal done recibida (nunca 500).${RESET}`);
      passCount++;
    } else {
      console.log(`  ${RED}✘ [FAIL] Texto recibido no coincide con el esperado.${RESET}`);
      console.log(`    Recibido : "${text}"`);
      console.log(`    Esperado : "${EXPECTED}"`);
      failCount++;
    }
  } catch (err) {
    console.log(`  ${RED}✘ [FAIL] Excepción en Test 3: ${err.message}${RESET}`);
    failCount++;
  }

  // ── Test 4: Memoria Contextual — historial multi-turno ────────────────────
  try {
    restoreEnv();
    console.log(`\n${BOLD}Test 4: Memoria Contextual — Historial multi-turno${RESET}`);

    const { req, res } = createMockReqRes({
      messages: [
        { role: 'user',      content: 'Hola, me llamo Carlos.' },
        { role: 'assistant', content: '¡Hola Carlos! ¿En qué puedo ayudarte hoy en Buenos Aires?' },
        { role: 'user',      content: '¿Qué actividades al aire libre hay?' },
      ],
    });

    await handler(req, res);

    const text = res.getSSEText();
    const done = res.getSSEDone();

    if (text.length > 0 && done) {
      console.log(`  ${GREEN}✔ [PASS] Historial multi-turno procesado correctamente.${RESET}`);
      console.log(`    ${YELLOW}Preview: "${text.slice(0, 80).replace(/\n/g, ' ')}..."${RESET}`);
      passCount++;
    } else {
      console.log(`  ${RED}✘ [FAIL] Sin texto o sin done. text.length=${text.length}, done=${!!done}${RESET}`);
      failCount++;
    }
  } catch (err) {
    console.log(`  ${RED}✘ [FAIL] Excepción en Test 4: ${err.message}${RESET}`);
    failCount++;
  }

  // ── Test 5: Payload inválido — sin "messages" retorna 400 ─────────────────
  try {
    restoreEnv();
    console.log(`\n${BOLD}Test 5: Validación de payload — Sin "messages" retorna 400${RESET}`);

    const { req, res } = createMockReqRes({});

    await handler(req, res);

    const status = res.getStatus();
    const json   = res.getJson();

    if (status === 400 && json?.error) {
      console.log(`  ${GREEN}✔ [PASS] HTTP 400 recibido. Error: "${json.error}"${RESET}`);
      passCount++;
    } else {
      console.log(`  ${RED}✘ [FAIL] Estado: ${status}, body: ${JSON.stringify(json)}${RESET}`);
      failCount++;
    }
  } catch (err) {
    console.log(`  ${RED}✘ [FAIL] Excepción en Test 5: ${err.message}${RESET}`);
    failCount++;
  } finally {
    restoreEnv();
  }

  // ── Resumen ──────────────────────────────────────────────────────────────
  console.log(`\n${BOLD}${CYAN}───────────────────────────────────────────────────────${RESET}`);
  console.log(`${BOLD}RESUMEN DE VERIFICACIÓN:${RESET}`);
  console.log(`  Pruebas Pasadas : ${GREEN}${passCount}${RESET}`);
  console.log(`  Pruebas Fallidas: ${failCount > 0 ? RED : GREEN}${failCount}${RESET}`);
  console.log(`${BOLD}${CYAN}───────────────────────────────────────────────────────${RESET}\n`);

  if (failCount > 0) process.exit(1);
}

runTests();
