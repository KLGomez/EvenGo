import React from 'react';
import { CATEGORIES, ZONES, DATE_FILTERS } from '../data/events';

/**
 * Panel de filtros combinables.
 * Recibe el estado de filtros actual y el callback para actualizar cada filtro.
 */
export default function FilterPanel({ filters, onFilterChange, onReset, resultCount }) {
  return (
    <aside className="w-full sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar pr-1">
      <div
        className="bg-white/5 backdrop-blur-md border border-white/10
          rounded-2xl p-5 flex flex-col gap-5"
      >
        {/* Header del panel */}
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-base flex items-center gap-2">
            <span className="text-indigo-400">⚙️</span> Filtros
          </h2>
          <button
            onClick={onReset}
            id="reset-filters-btn"
            className="text-xs text-slate-400 hover:text-white transition-colors underline underline-offset-2"
          >
            Limpiar todo
          </button>
        </div>

        {/* Buscador de texto */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Buscar
          </label>
          <input
            id="search-input"
            type="text"
            placeholder="Nombre o descripción..."
            value={filters.searchText}
            onChange={(e) => onFilterChange('searchText', e.target.value)}
            className="w-full bg-white/10 text-white placeholder-slate-500
              border border-white/10 rounded-xl px-4 py-2.5 text-sm
              focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
          />
        </div>

        {/* Filtro de Categoría (pills) */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Categoría
          </label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                id={`category-filter-${cat.toLowerCase()}`}
                onClick={() => onFilterChange('category', cat)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-all duration-150 active:scale-95
                  ${
                    filters.category === cat
                      ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-500/30'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/15'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Filtro de Zona */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="zone-filter"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            Zona / Barrio
          </label>
          <select
            id="zone-filter"
            value={filters.location}
            onChange={(e) => onFilterChange('location', e.target.value)}
            className="w-full bg-slate-800 text-white border border-white/10
              rounded-xl px-4 py-2.5 text-sm appearance-none cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
          >
            {ZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro de Precio */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="price-filter"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            Precio
          </label>
          <select
            id="price-filter"
            value={filters.price || 'Todos'}
            onChange={(e) => onFilterChange('price', e.target.value)}
            className="w-full bg-slate-900 text-slate-300 border border-white/10
              rounded-xl px-4 py-2.5 text-sm appearance-none cursor-pointer
              focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
            <option value="Todos">Todos los precios</option>
            <option value="Gratis">Gratis</option>
            <option value="Pago">De pago</option>
          </select>
        </div>

        {/* Filtro de Fecha */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Fecha
          </label>
          <div className="flex flex-col gap-1.5">
            {DATE_FILTERS.map((df) => (
              <button
                key={df.value}
                id={`date-filter-${df.value}`}
                onClick={() => onFilterChange('dateRange', df.value)}
                className={`text-sm font-medium px-4 py-2.5 rounded-xl text-left border transition-all duration-150
                  ${
                    filters.dateRange === df.value
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                      : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                  }`}
              >
                {df.label}
              </button>
            ))}
          </div>
        </div>

        {/* Contador de resultados */}
        <div className="pt-2 border-t border-white/10 text-center">
          <p className="text-slate-400 text-xs">
            <span className="text-indigo-300 font-bold text-sm">{resultCount}</span>{' '}
            evento{resultCount !== 1 ? 's' : ''} encontrado{resultCount !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </aside>
  );
}
