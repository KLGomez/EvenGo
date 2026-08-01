// src/services/evengoService.js — Cliente del backend propio de EvenGo
//
// Flujo con `vercel dev`:
//   Browser → fetch('/api/events') → Vercel Router → api/events.js (Node.js) → JSON
//
// Flujo con solo `npm run dev`:
//   Browser → fetch('/api/events') → Vite 404 → hook captura error → muestra mocks

/**
 * Obtiene los eventos normalizados desde el backend propio de EvenGo.
 *
 * Incluye validación defensiva de Content-Type para evitar que un error de
 * enrutamiento (que devuelve HTML o texto) rompa la app con un error de parseo.
 *
 * @returns {Promise<Array>} Array de eventos en formato EvenGo schema
 * @throws {Error} Con mensaje descriptivo si el backend no está disponible
 */
export async function fetchEvenGoEvents() {
  let response;

  try {
    response = await fetch("/api/events", {
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch (networkErr) {
    throw new Error(
      `Error de red al contactar /api/events: ${networkErr.message}. ` +
      "Verificá tu conexión o ejecutá: vercel dev"
    );
  }

  // ── Validación defensiva de Content-Type ──────────────────────────────────
  // Si el servidor devuelve HTML (página de error de Vite) o texto plano
  // (código fuente del .js), response.json() explotaría con un error críptico.
  // Detectamos esto ANTES de intentar parsear.
  const contentType = response.headers.get("Content-Type") || "";
  const isJson = contentType.includes("application/json");

  if (!isJson) {
    // Leemos el cuerpo como texto para dar un mensaje de error útil
    const rawBody = await response.text().catch(() => "(no se pudo leer el cuerpo)");
    const preview = rawBody.slice(0, 120).replace(/\s+/g, " ").trim();

    throw new Error(
      `El endpoint /api/events respondió con "${contentType}" en lugar de JSON. ` +
      `Vista previa: "${preview}". ` +
      "Asegurate de ejecutar: vercel dev (no npm run dev solo)."
    );
  }

  // ── HTTP error con JSON de error del servidor ─────────────────────────────
  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    throw new Error(
      errBody.error ||
      `Backend EvenGo respondió con HTTP ${response.status}.`
    );
  }

  // ── Parseo seguro ─────────────────────────────────────────────────────────
  const data = await response.json();
  const events = Array.isArray(data.events) ? data.events : [];

  console.info(
    `[EvenGo] ${events.length} eventos recibidos` +
    (data.source    ? ` · Fuente: ${data.source}`          : "") +
    (data.live      ? " · GCBA en vivo"                    : " · Mock data") +
    (data.timestamp ? ` · ${data.timestamp.slice(0, 19)}`  : "")
  );

  return events;
}
