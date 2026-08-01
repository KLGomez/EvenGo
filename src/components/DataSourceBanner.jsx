import React from 'react';

/**
 * Banner de estado de la fuente de datos.
 *
 * Estados posibles:
 *  - loading   → spinner mientras se conecta a Eventbrite
 *  - error     → advertencia con detalle del error + botón reintentar
 *  - live data → confirmación verde de datos en tiempo real
 *  - (silent)  → sin banner cuando los mocks se muestran antes del fetch
 */
export default function DataSourceBanner({ loading, error, usingMocks, onRetry }) {
  // ── Cargando ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 px-4 py-3 rounded-xl
          bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm mb-5"
      >
        <svg
          className="animate-spin h-4 w-4 flex-shrink-0 text-indigo-400"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        <span>
          <strong>Conectando con el backend GCBA…</strong>{' '}
          Mientras tanto se muestran eventos de demostración.
        </span>
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    // Detectar si el error es por token faltante para dar una guía más precisa
    const isBackendDown = error.toLowerCase().includes('404') ||
      error.toLowerCase().includes('no disponible') ||
      error.toLowerCase().includes('vercel dev');

    return (
      <div
        role="alert"
        className="flex items-start gap-3 px-4 py-3.5 rounded-xl
          bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm mb-5"
      >
        <span className="text-xl flex-shrink-0 mt-0.5" aria-hidden="true">⚠️</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold mb-1">
            {isBackendDown ? 'Backend no disponible en modo dev' : 'Error al conectar con el servidor'}
          </p>
          <p className="text-amber-400/70 text-xs break-words leading-relaxed">
            {error}
          </p>
          {isBackendDown && (
            <p className="text-amber-400/60 text-xs mt-1.5">
              Creá el archivo{' '}
              <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono">.env</code>{' '}
              en la raíz del proyecto con:{' '}
              <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono">vercel dev</code>{' '}
              en lugar de{' '}
              <code className="bg-amber-500/20 px-1.5 py-0.5 rounded font-mono">npm run dev</code>
              para ejecutar el backend local.
            </p>
          )}
          <p className="text-amber-400/50 text-xs mt-1">
            Mostrando <strong>eventos de demostración</strong> en su lugar.
          </p>
        </div>
        <button
          onClick={onRetry}
          id="retry-fetch-btn"
          className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg
            bg-amber-500/20 border border-amber-500/30 text-amber-300
            hover:bg-amber-500/30 active:scale-95 transition-all whitespace-nowrap"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // ── Datos en vivo ─────────────────────────────────────────────────────────
  if (!usingMocks) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl
          bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs mb-5"
      >
        <span aria-hidden="true">✅</span>
        <span>
          Datos en vivo desde{' '}
          <strong className="text-emerald-200">Datos Abiertos GCBA</strong>{' '}
          · Actividades Culturales de Buenos Aires
        </span>
      </div>
    );
  }

  // Antes del primer fetch (render inicial con mocks): sin banner
  return null;
}
