import React from 'react';

/**
 * Barra de navegación superior con branding de EvenGo.
 */
export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full">
      <div
        className="backdrop-blur-xl bg-slate-950/80 border-b border-white/10
          px-4 sm:px-6 py-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600
                flex items-center justify-center text-lg shadow-lg shadow-indigo-500/30"
            >
              🗺️
            </div>
            <div>
              <span className="text-white font-extrabold text-xl tracking-tight">
                Even<span className="text-indigo-400">Go</span>
              </span>
              <p className="text-slate-500 text-xs -mt-0.5 hidden sm:block">
                Buenos Aires
              </p>
            </div>
          </div>

          {/* Tagline */}
          <p className="hidden md:block text-slate-400 text-sm">
            Descubrí los mejores eventos de tu ciudad 🇦🇷
          </p>

          {/* CTA */}
          <a
            href="#eventos"
            className="text-xs font-semibold px-4 py-2 rounded-xl
              bg-indigo-500/20 border border-indigo-500/30 text-indigo-300
              hover:bg-indigo-500/30 transition-colors"
          >
            Ver eventos →
          </a>
        </div>
      </div>
    </header>
  );
}
