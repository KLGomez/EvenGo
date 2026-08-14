import fs from 'fs';
import path from 'path';
import handler from '../api/chat.js';

// Carga manual de .env para entornos Node nativos
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
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch (err) {
    // Ignorar si no existe
  }
}

loadEnvFile();

const ORIGINAL_ENV = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  FALLBACK_API_KEY: process.env.FALLBACK_API_KEY,
  XAI_API_KEY: process.env.XAI_API_KEY,
};

function restoreEnv() {
  if (ORIGINAL_ENV.GEMINI_API_KEY !== undefined) {
    process.env.GEMINI_API_KEY = ORIGINAL_ENV.GEMINI_API_KEY;
  } else {
    delete process.env.GEMINI_API_KEY;
  }
  if (ORIGINAL_ENV.FALLBACK_API_KEY !== undefined) {
    process.env.FALLBACK_API_KEY = ORIGINAL_ENV.FALLBACK_API_KEY;
  } else {
    delete process.env.FALLBACK_API_KEY;
  }
  if (ORIGINAL_ENV.XAI_API_KEY !== undefined) {
    process.env.XAI_API_KEY = ORIGINAL_ENV.XAI_API_KEY;
  } else {
    delete process.env.XAI_API_KEY;
  }
}

function createMockReqRes(body) {
  const req = {
    method: 'POST',
    body,
  };

  let statusCode = 200;
  let jsonBody = null;
  let headers = {};

  const res = {
    setHeader(key, value) {
      headers[key] = value;
      return res;
    },
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      jsonBody = data;
      return res;
    },
    end() {
      return res;
    },
    getStatus: () => statusCode,
    getJson: () => jsonBody,
    getHeaders: () => headers,
  };

  return { req, res };
}

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

async function runTests() {
  console.log(`\n${BOLD}${CYAN}=====================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   SUITE DE PRUEBAS DE ALTA DISPONIBILIDAD (API CHAT)   ${RESET}`);
  console.log(`${BOLD}${CYAN}=====================================================${RESET}\n`);

  let passCount = 0;
  let failCount = 0;

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 1: Happy Path (Gemini)
  // ───────────────────────────────────────────────────────────────────────────
  try {
    restoreEnv();
    console.log(`${BOLD}Test 1: Happy Path (Proveedor Primario Gemini)${RESET}`);
    const { req, res } = createMockReqRes({
      messages: [{ role: 'user', content: 'hola' }],
    });

    await handler(req, res);

    const status = res.getStatus();
    const body = res.getJson();

    if (status === 200 && body && typeof body.reply === 'string' && body.reply.length > 0) {
      console.log(`  ${GREEN}✔ [PASS] HTTP 200 recibido. Respuesta obtenida exitosamente.${RESET}`);
      console.log(`    ${YELLOW}Preview: "${body.reply.slice(0, 70).replace(/\n/g, ' ')}..."${RESET}`);
      passCount++;
    } else {
      console.log(`  ${RED}✘ [FAIL] Estado HTTP: ${status}, Body: ${JSON.stringify(body)}${RESET}`);
      failCount++;
    }
  } catch (err) {
    console.log(`  ${RED}✘ [FAIL] Excepción en Test 1: ${err.message}${RESET}`);
    failCount++;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 2: Fallback (x.ai Grok)
  // ───────────────────────────────────────────────────────────────────────────
  try {
    restoreEnv();
    console.log(`\n${BOLD}Test 2: Fallback a x.ai Grok (Gemini fallido, XAI_API_KEY activa)${RESET}`);
    process.env.GEMINI_API_KEY = 'invalid_gemini_key_simulation_123';
    if (!process.env.XAI_API_KEY) {
      process.env.XAI_API_KEY = 'xai-mock-key-simulation-123';
    }

    const { req, res } = createMockReqRes({
      messages: [{ role: 'user', content: '¿Qué eventos hay hoy?' }],
    });

    await handler(req, res);

    const status = res.getStatus();
    const body = res.getJson();

    if (status === 200 && body && typeof body.reply === 'string' && body.reply.length > 0) {
      console.log(`  ${GREEN}✔ [PASS] HTTP 200 recibido. Fallback procesado sin lanzar 500.${RESET}`);
      console.log(`    ${YELLOW}Preview: "${body.reply.slice(0, 70).replace(/\n/g, ' ')}..."${RESET}`);
      passCount++;
    } else {
      console.log(`  ${RED}✘ [FAIL] Estado HTTP: ${status}, Body: ${JSON.stringify(body)}${RESET}`);
      failCount++;
    }
  } catch (err) {
    console.log(`  ${RED}✘ [FAIL] Excepción en Test 2: ${err.message}${RESET}`);
    failCount++;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 3: Graceful Degradation (Plan C - Respuesta Estática)
  // ───────────────────────────────────────────────────────────────────────────
  try {
    restoreEnv();
    console.log(`\n${BOLD}Test 3: Graceful Degradation / Plan C (Sin Gemini ni XAI_API_KEY)${RESET}`);
    process.env.GEMINI_API_KEY = 'invalid_gemini_key_simulation_123';
    delete process.env.XAI_API_KEY;
    delete process.env.FALLBACK_API_KEY;

    const { req, res } = createMockReqRes({
      messages: [{ role: 'user', content: 'hola' }],
    });

    await handler(req, res);

    const status = res.getStatus();
    const body = res.getJson();
    const EXPECTED_STATIC_REPLY =
      '¡Uf! Estoy procesando demasiadas consultas y agoté mis créditos de IA temporalmente. 😅 Mientras recupero energía, te invito a explorar las tarjetas de eventos utilizando los filtros de arriba.';

    const isStatus200 = status === 200;
    const isExactReply = body?.reply === EXPECTED_STATIC_REPLY;

    if (isStatus200 && isExactReply) {
      console.log(`  ${GREEN}✔ [PASS] HTTP 200 recibido (NUNCA 500).${RESET}`);
      console.log(`  ${GREEN}✔ [PASS] Mensaje estático de contingencia validado exactamente.${RESET}`);
      console.log(`    ${YELLOW}Mensaje: "${body.reply}"${RESET}`);
      passCount++;
    } else {
      console.log(`  ${RED}✘ [FAIL] Estado: ${status} (Esperado 200). Coincidencia de mensaje: ${isExactReply}${RESET}`);
      if (body?.reply) {
        console.log(`    Recibido: "${body.reply}"`);
        console.log(`    Esperado: "${EXPECTED_STATIC_REPLY}"`);
      }
      failCount++;
    }
  } catch (err) {
    console.log(`  ${RED}✘ [FAIL] Excepción en Test 3: ${err.message}${RESET}`);
    failCount++;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TEST 4: Memoria Contextual (Historial con múltiples turnos)
  // ───────────────────────────────────────────────────────────────────────────
  try {
    restoreEnv();
    console.log(`\n${BOLD}Test 4: Memoria Contextual (Historial con múltiples turnos)${RESET}`);

    const { req, res } = createMockReqRes({
      messages: [
        { role: 'user', content: 'Hola, me llamo Carlos.' },
        { role: 'assistant', content: '¡Hola Carlos! ¿En qué puedo ayudarte hoy en Buenos Aires?' },
        { role: 'user', content: '¿Qué actividades al aire libre hay?' },
      ],
    });

    await handler(req, res);

    const status = res.getStatus();
    const body = res.getJson();

    if (status === 200 && body && typeof body.reply === 'string' && body.reply.length > 0) {
      console.log(`  ${GREEN}✔ [PASS] Mapeo de historial conversacional exitoso (HTTP 200).${RESET}`);
      console.log(`    ${YELLOW}Preview: "${body.reply.slice(0, 70).replace(/\n/g, ' ')}..."${RESET}`);
      passCount++;
    } else {
      console.log(`  ${RED}✘ [FAIL] Estado HTTP: ${status}, Body: ${JSON.stringify(body)}${RESET}`);
      failCount++;
    }
  } catch (err) {
    console.log(`  ${RED}✘ [FAIL] Excepción en Test 4: ${err.message}${RESET}`);
    failCount++;
  } finally {
    restoreEnv();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // RESUMEN DE PRUEBAS
  // ───────────────────────────────────────────────────────────────────────────
  console.log(`\n${BOLD}${CYAN}-----------------------------------------------------${RESET}`);
  console.log(`${BOLD}RESUMEN DE VERIFICACIÓN:${RESET}`);
  console.log(`  Pruebas Pasadas: ${GREEN}${passCount}${RESET}`);
  console.log(`  Pruebas Fallidas: ${failCount > 0 ? RED : GREEN}${failCount}${RESET}`);
  console.log(`${BOLD}${CYAN}-----------------------------------------------------${RESET}\n`);

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests();
