import React from 'react';
import { buildGoogleCalendarUrl, formatDate } from '../utils/calendarUtils';

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
 * Incluye botones para visitar la URL del evento y agregar a Google Calendar.
 */
export default function EventCard({ event }) {
  const style = CATEGORY_STYLES[event.category] || CATEGORY_STYLES['Cultural'];
  const calendarUrl = buildGoogleCalendarUrl(event);
  const formattedDate = formatDate(event.date);

  return (
    <article
      className={`group relative flex flex-col rounded-2xl overflow-hidden
        bg-white/5 backdrop-blur-md border border-white/10
        shadow-lg hover:shadow-2xl ${style.glow}
        transition-all duration-300 hover:-translate-y-1`}
    >
      {/* Accent bar superior */}
      <div className={`h-1 w-full bg-gradient-to-r ${style.accent}`} />

      {/* Contenido de la tarjeta */}
      <div className="flex flex-col flex-1 p-5 gap-4">
        {/* Header: categoría + ícono */}
        <div className="flex items-center justify-between">
          <span
            className={`text-xs font-semibold px-3 py-1 rounded-full ${style.pill}`}
          >
            {style.icon} {event.category}
          </span>
          <span className="text-xs text-slate-400 font-medium">{event.time} hs</span>
        </div>

        {/* Título */}
        <h3 className="text-white font-bold text-lg leading-tight line-clamp-2">
          {event.title}
        </h3>

        {/* Descripción */}
        <p className="text-slate-400 text-sm leading-relaxed line-clamp-3 flex-1">
          {event.description}
        </p>

        {/* Meta: fecha y ubicación */}
        <div className="flex flex-col gap-1.5 pt-1 border-t border-white/10">
          <div className="flex items-center gap-2 text-slate-300 text-xs">
            <span className="text-slate-500">📅</span>
            <span className="font-medium capitalize">{formattedDate}</span>
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
