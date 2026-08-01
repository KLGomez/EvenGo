import React from 'react';
import EventCard from './EventCard';

/**
 * Grid responsivo de tarjetas de eventos.
 * Muestra un estado vacío cuando no hay resultados.
 */
export default function EventGrid({ events, onReset }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <span className="text-6xl">🔍</span>
        <h3 className="text-white font-bold text-xl">Sin resultados</h3>
        <p className="text-slate-400 text-sm max-w-sm">
          No encontramos eventos que coincidan con tus filtros actuales.
          Probá combinaciones distintas.
        </p>
        <button
          onClick={onReset}
          className="mt-2 text-sm font-semibold px-5 py-2.5 rounded-xl
            bg-indigo-500/20 border border-indigo-500/30 text-indigo-300
            hover:bg-indigo-500/30 transition-colors"
        >
          Limpiar filtros
        </button>
      </div>
    );
  }

  return (
    <div
      id="eventos"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5"
    >
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
