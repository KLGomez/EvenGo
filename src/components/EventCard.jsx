import React from 'react';
import { buildGoogleCalendarUrl, formatDate } from '../utils/calendarUtils';
import useFavorites from '../hooks/useFavorites';

// Paleta de colores por categoría
const CATEGORY_STYLES = {
  Musical: {
    pill: 'bg-violet-500/20 text-violet-300 border border-violet-500/30',
    accent: 'from-violet-600 to-purple-700',
    icon: '🎵',
    glow: 'group-hover:shadow-violet-500/20',
  },
  Deportivo: {
    pill: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    accent: 'from-emerald-600 to-teal-700',
    icon: '⚡',
    glow: 'group-hover:shadow-emerald-500/20',
  },
  Cultural: {
    pill: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    accent: 'from-amber-600 to-orange-700',
    icon: '🎭',
    glow: 'group-hover:shadow-amber-500/20',
  },
  Gastronomía: {
    pill: 'bg-rose-500/20 text-rose-300 border border-rose-500/30',
    accent: 'from-rose-600 to-pink-700',
    icon: '🍽️',
    glow: 'group-hover:shadow-rose-500/20',
  },
};

/**
 * Tarjeta individual de evento con diseño glassmorphism.
 * Incluye botón de guardar en favoritos, visitar la URL del evento y agregar a Google Calendar.
 */
export default function EventCard({ event }) {
  const { toggleFavorite, isFavorite } = useFavorites();
  const favorite = isFavorite(event.id);

  const style = CATEGORY_STYLES[event.category] || CATEGORY_STYLES['Cultural'];
  const calendarUrl = buildGoogleCalendarUrl(event);
  const formattedDate = formatDate(event.date);

  const isFree = (price) => {
    if (price == null) return false;
    const p = String(price).toLowerCase().trim();
    return p === '0' || p === 'gratis' || p === 'gratuito' || p === 'sin cargo';
  };
  const eventIsFree = isFree(event.precio ?? event.price);

  return (
    <article
      id={`event-${event.id}`}
      className={`group relative flex flex-col rounded-2xl overflow-hidden
        bg-white/5 backdrop-blur-md border border-white/10
        shadow-lg hover:shadow-2xl ${style.glow}
        transition-all duration-300 hover:-translate-y-1`}
    >
      {/* Accent bar superior */}
      <div className={`h-1 w-full bg-gradient-to-r ${style.accent}`} />

      {/* Contenido de la tarjeta */}
      <div className="flex flex-col flex-1 p-5 gap-4">
        {/* Header: categoría + ícono + badge de precio + favorito */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-semibold px-3 py-1 rounded-full ${style.pill}`}
            >
              {style.icon} {event.category}
            </span>
            <span
              className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md ${
                eventIsFree
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              }`}
            >
              {eventIsFree ? 'Gratis' : 'De pago'}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              toggleFavorite(event);
            }}
            aria-label={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            title={favorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            className="p-2 rounded-full bg-slate-900/60 backdrop-blur-md border border-white/20 shadow-lg hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all duration-300"
          >
            {favorite ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5 text-rose-500"
              >
                <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-white/80"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
                />
              </svg>
            )}
          </button>
        </div>

        {/* Título */}
        <h3 className="text-white font-bold text-lg leading-tight line-clamp-2">
          {event.title}
        </h3>

        {/* Descripción */}
        <p className="text-slate-400 text-sm leading-relaxed line-clamp-3 flex-1">
          {event.description}
        </p>

        {/* Meta: fecha, hora y ubicación */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-white/10">
          <div className="flex items-center gap-2 text-slate-300 text-xs">
            <span className="text-slate-500">📅</span>
            <span className="font-medium capitalize">{formattedDate} • {event.time} hs</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300 text-xs">
            <span className="text-slate-500">📍</span>
            <span>{event.address || event.location}</span>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="flex gap-2 pt-2">
          <a
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            id={`go-to-event-${event.id}`}
            className={`flex-1 text-center text-xs font-semibold py-2.5 px-3 rounded-xl
              bg-gradient-to-r ${style.accent} text-white
              hover:opacity-90 active:scale-95 transition-all duration-150`}
          >
            Ir al evento →
          </a>
          <a
            href={calendarUrl}
            target="_blank"
            rel="noopener noreferrer"
            id={`add-calendar-${event.id}`}
            title="Agregar a Google Calendar"
            className="flex-1 text-center text-xs font-semibold py-2.5 px-3 rounded-xl
              bg-white/10 text-slate-200 border border-white/10
              hover:bg-white/20 active:scale-95 transition-all duration-150"
          >
            📆 Agregar
          </a>
        </div>
      </div>
    </article>
  );
}
