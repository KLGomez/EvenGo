import React, { useState } from 'react';
import { NavLink, Link } from 'react-router-dom';
import useFavorites from '../hooks/useFavorites';
import FavoritesDrawer from './FavoritesDrawer';

/**
 * Barra de navegación superior con branding de EvenGo, enrutamiento activo y acceso a Favoritos (Mi Ruta).
 * Ajustada con diseño responsivo para dispositivos móviles.
 */
export default function Navbar() {
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const { favorites } = useFavorites();

  return (
    <header className="sticky top-0 z-50 w-full">
      <div
        className="backdrop-blur-xl bg-slate-950/80 border-b border-white/10
          px-3 sm:px-6 py-3 sm:py-4"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          {/* Logo y Nombre */}
          <Link to="/" className="flex items-center gap-2 sm:gap-2.5 group flex-shrink-0">
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600
                flex items-center justify-center text-base sm:text-lg shadow-lg shadow-indigo-500/30
                group-hover:scale-105 transition-transform"
            >
              🗺️
            </div>
            <div>
              <span className="text-white font-extrabold text-lg sm:text-xl tracking-tight">
                Even<span className="text-indigo-400">Go</span>
              </span>
              <p className="text-slate-500 text-[10px] sm:text-xs -mt-0.5 hidden sm:block">
                Buenos Aires
              </p>
            </div>
          </Link>

          {/* Menú de Navegación Principal Responsivo */}
          <nav className="flex items-center flex-wrap justify-end gap-1 sm:gap-2">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `text-[10px] sm:text-sm font-semibold px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl transition-all ${
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
                `text-[10px] sm:text-sm font-semibold px-2 py-1.5 sm:px-3.5 sm:py-2 rounded-xl transition-all flex items-center gap-1 sm:gap-1.5 ${
                  isActive
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/40'
                    : 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 hover:text-white'
                }`
              }
            >
              <span>Radar Cultural</span>
              <span className="px-1 py-0.2 sm:px-1.5 sm:py-0.5 text-[9px] sm:text-[10px] font-bold bg-indigo-400/30 text-indigo-200 rounded-md border border-indigo-400/20">
                PRO
              </span>
            </NavLink>

            {/* Botón Disparador de Mis Eventos Guardados (Mi Ruta) */}
            <button
              type="button"
              onClick={() => setIsFavoritesOpen(true)}
              className="relative flex items-center gap-1 sm:gap-2 text-[10px] sm:text-sm font-semibold px-2 py-1.5 sm:px-3 sm:py-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 border border-white/10 transition-all active:scale-95"
            >
              <span>Mi Ruta</span>
              <span className="text-rose-400">❤️</span>
              {favorites.length > 0 && (
                <span className="px-1 py-0.2 sm:px-1.5 sm:py-0.5 text-[9px] sm:text-[10px] font-bold bg-rose-500 text-white rounded-full">
                  {favorites.length}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

      {/* Drawer de Favoritos */}
      <FavoritesDrawer
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
      />
    </header>
  );
}
