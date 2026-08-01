import React from 'react';
import { NavLink, Link } from 'react-router-dom';

/**
 * Barra de navegación superior con branding de EvenGo y enrutamiento activo.
 */
export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full">
      <div
        className="backdrop-blur-xl bg-slate-950/80 border-b border-white/10
          px-4 sm:px-6 py-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Logo y Nombre */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div
              className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600
                flex items-center justify-center text-lg shadow-lg shadow-indigo-500/30
                group-hover:scale-105 transition-transform"
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
          </Link>

          {/* Menú de Navegación Principal */}
          <nav className="flex items-center gap-3 sm:gap-4">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `text-xs sm:text-sm font-semibold px-3 py-2 rounded-xl transition-all ${
                  isActive
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              Agenda 📅
            </NavLink>

            {/* Ítem Destacado: Radar Cultural 📊 */}
            <NavLink
              to="/radar-cultural"
              className={({ isActive }) =>
                `text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/40'
                    : 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 hover:text-white'
                }`
              }
            >
              <span>Radar Cultural</span>
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-400/30 text-indigo-200 rounded-md border border-indigo-400/20">
                PRO
              </span>
            </NavLink>
          </nav>
        </div>
      </div>
    </header>
  );
}
