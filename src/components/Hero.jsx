import React from 'react';

/**
 * Sección hero de bienvenida con gradiente y estadísticas.
 */
export default function Hero({ totalEvents }) {
  return (
    <section className="relative overflow-hidden py-16 px-4 sm:py-20">
      {/* Fondo decorativo */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px]
          bg-indigo-600/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[200px]
          bg-purple-600/15 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto text-center flex flex-col gap-5">
        <div className="flex justify-center">
          <span
            className="text-xs font-bold px-4 py-1.5 rounded-full
              bg-indigo-500/15 border border-indigo-500/25 text-indigo-300"
          >
            🎉 La guía de eventos gratuita de Buenos Aires
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white leading-tight">
          Descubrí lo que{' '}
          <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            pasa hoy
          </span>{' '}
          en BA
        </h1>

        <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
          Eventos musicales, culturales, deportivos y gastronómicos en cada rincón
          de la Ciudad de Buenos Aires y el Gran Buenos Aires.
        </p>

        {/* Stats */}
        <div className="flex items-center justify-center gap-8 pt-2">
          <div className="text-center">
            <p className="text-3xl font-extrabold text-white">{totalEvents}+</p>
            <p className="text-slate-500 text-xs">Eventos</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-3xl font-extrabold text-white">4</p>
            <p className="text-slate-500 text-xs">Categorías</p>
          </div>
          <div className="w-px h-10 bg-white/10" />
          <div className="text-center">
            <p className="text-3xl font-extrabold text-white">6</p>
            <p className="text-slate-500 text-xs">Zonas</p>
          </div>
        </div>
      </div>
    </section>
  );
}
