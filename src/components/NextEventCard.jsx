import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Calendar, MapPin, Sparkles } from 'lucide-react';

/**
 * NextEventCard - Tarjeta interactiva del KPI 'Próximo Evento' para Radar Cultural.
 * 
 * Micro-interacciones con Tailwind CSS y grupo (`group`):
 * - Contenedor: <Link> con elevación sutil (-translate-y-1), borde iluminado y sombra glow rosa.
 * - Título: Gradiente de rosa a violeta al hacer hover (`group-hover`).
 * - Ícono: ArrowUpRight de lucide-react en la esquina inferior derecha,
 *          oculto por defecto con transición suave de opacidad y traslación al hacer hover.
 *
 * @param {Object} props
 * @param {Object|string} props.event - Objeto del evento o fallback
 * @param {string} [props.className] - Clases adicionales
 */
export function NextEventCard({ event, className = '' }) {
  // Manejo seguro en caso de que event sea null, undefined o string plano
  const eventObj = typeof event === 'object' && event !== null
    ? event
    : typeof event === 'string'
      ? { title: event, id: 1 }
      : null;

  if (!eventObj || !eventObj.title) {
    return (
      <div className="bg-slate-900/80 backdrop-blur-md border border-white/10 p-5 rounded-2xl shadow-lg flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-sm font-medium">Próximo Evento</span>
          <span className="text-xl">⏰</span>
        </div>
        <span className="text-xl font-bold text-slate-500 tracking-tight">
          No hay eventos próximos
        </span>
      </div>
    );
  }

  const destination = eventObj.id ? `/eventos/${eventObj.id}` : '#';

  return (
    <Link
      to={destination}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-[#131b2f] p-6 shadow-lg transition-all duration-300 ease-out h-full
        hover:-translate-y-1 hover:border-pink-500/80 hover:shadow-xl hover:shadow-pink-500/20
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500
        ${className}`}
      aria-label={`Ver detalles del próximo evento: ${eventObj.title}`}
    >
      {/* Glow ambiental sutil de fondo en hover */}
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-pink-500/10 blur-xl transition-opacity duration-300 opacity-0 group-hover:opacity-100"
        aria-hidden="true"
      />

      {/* Header del KPI: Badge + Emoji de estado */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-pink-500/10 text-pink-400 border border-pink-500/20">
          <Sparkles className="w-3.5 h-3.5 animate-pulse text-pink-400" />
          Próximo Evento
        </span>
        <span className="text-xl group-hover:scale-110 transition-transform duration-300">⏰</span>
      </div>

      {/* Título dinámico con gradiente de rosa a violeta al hacer hover */}
      <div className="my-auto py-1 min-w-0">
        <h3
          className="text-lg lg:text-xl font-bold text-white tracking-tight line-clamp-2 transition-all duration-300 ease-out group-hover:bg-gradient-to-r group-hover:from-pink-500 group-hover:to-violet-500 group-hover:bg-clip-text group-hover:text-transparent"
          title={eventObj.title}
        >
          {eventObj.title}
        </h3>

        {/* Metadatos (Fecha / Ubicación si están disponibles) */}
        {(eventObj.date || eventObj.location) && (
          <div className="mt-2 flex flex-col gap-1 text-xs text-slate-400">
            {eventObj.date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3 h-3 text-slate-500 transition-colors group-hover:text-pink-400" />
                <span>{eventObj.date} {eventObj.time ? `• ${eventObj.time} hs` : ''}</span>
              </div>
            )}
            {eventObj.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="w-3 h-3 text-slate-500 transition-colors group-hover:text-pink-400" />
                <span className="truncate">{eventObj.location}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer interactivo con micro-interacción del ícono ArrowUpRight */}
      <div className="flex items-center justify-between pt-3 mt-4 border-t border-slate-800/60">
        <span className="text-xs font-medium text-slate-400 transition-colors duration-200 group-hover:text-pink-300">
          Ver detalles
        </span>

        {/* Ícono ArrowUpRight: oculto por defecto con traslación y opacidad cero */}
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full bg-pink-500/20 text-pink-400 opacity-0 translate-x-1 translate-y-1 transition-all duration-300 ease-out group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0"
          aria-hidden="true"
        >
          <ArrowUpRight className="w-4 h-4 stroke-[2.2]" />
        </div>
      </div>
    </Link>
  );
}

export default NextEventCard;
