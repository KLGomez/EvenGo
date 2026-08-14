// api/_cache.js — Caché en memoria con TTL para funciones serverless
//
// ⚠️  Limitación conocida del modelo serverless (documentada intencionalmente):
//     En Vercel Serverless Functions, cada "instancia caliente" (warm instance)
//     reutiliza este módulo en memoria, por lo que el caché es efectivo para
//     requests consecutivos en la misma instancia.
//     Sin embargo, entre instancias frías (cold starts) o réplicas concurrentes,
//     el caché NO se comparte — cada instancia tiene su propia copia del Map.
//
//     Para un volumen de tráfico de portfolio/producción liviana, esto es
//     suficiente para reducir latencia y llamadas a APIs externas en el 80%+
//     de los casos. La siguiente iteración natural sería Vercel KV o Upstash Redis
//     si el tráfico escala.
//
// Uso:
//   import { getCached, setCached } from './_cache.js';
//
//   const cached = getCached('my-key', 10 * 60 * 1000); // TTL: 10 minutos
//   if (cached) return res.json({ data: cached, cached: true });
//
//   const fresh = await fetchSomeData();
//   setCached('my-key', fresh);

const cache = new Map();

/**
 * Recupera un valor del caché si existe y no expiró.
 *
 * @param {string} key    - Clave del valor a buscar
 * @param {number} ttlMs  - Tiempo de vida en milisegundos
 * @returns {any|null}    - El valor cacheado, o null si no existe o expiró
 */
export function getCached(key, ttlMs) {
  const entry = cache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age >= ttlMs) {
    cache.delete(key); // limpiar entradas expiradas
    return null;
  }

  return entry.data;
}

/**
 * Guarda un valor en el caché con timestamp de creación.
 *
 * @param {string} key  - Clave bajo la cual guardar el valor
 * @param {any}    data - Valor a cachear
 */
export function setCached(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
}

/**
 * Invalida una entrada del caché manualmente.
 * Útil para forzar refresco desde los endpoints de sincronización.
 *
 * @param {string} key - Clave a invalidar
 */
export function invalidateCache(key) {
  cache.delete(key);
}
