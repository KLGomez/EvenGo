import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import FilterPanel from './components/FilterPanel';
import EventGrid from './components/EventGrid';
import DataSourceBanner from './components/DataSourceBanner';
import { useEvents } from './hooks/useEvents';

/**
 * Componente raíz de EvenGo.
 * Orquesta todos los componentes y el estado de la aplicación.
 */
export default function App() {
  const {
    filters,
    filteredEvents,
    updateFilter,
    resetFilters,
    totalEvents,
    loading,
    error,
    usingMocks,
    retry,
  } = useEvents();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Fondo general con gradiente sutil */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.12), transparent)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10">
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
          {/* Hero */}
          <Hero totalEvents={totalEvents} />

          {/* Layout: filtros + grid */}
          <div className="flex flex-col lg:flex-row gap-6 mt-6">
            {/* Sidebar de filtros */}
            <div className="w-full lg:w-72 lg:flex-shrink-0">
              <div className="lg:sticky lg:top-24">
                <FilterPanel
                  filters={filters}
                  onFilterChange={updateFilter}
                  onReset={resetFilters}
                  resultCount={filteredEvents.length}
                />
              </div>
            </div>

            {/* Grid de eventos */}
            <div className="flex-1 min-w-0">
              {/* Banner de estado de la fuente de datos */}
              <DataSourceBanner
                loading={loading}
                error={error}
                usingMocks={usingMocks}
                onRetry={retry}
              />

              {/* Encabezado del grid */}
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-white font-bold text-lg">
                  Eventos{' '}
                  {filters.location !== 'Todas las zonas' && (
                    <span className="text-indigo-400">en {filters.location}</span>
                  )}
                </h2>
                <span className="text-slate-500 text-sm">
                  {filteredEvents.length} de {totalEvents}
                </span>
              </div>

              <EventGrid events={filteredEvents} onReset={resetFilters} />
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8 text-center">
          <p className="text-slate-600 text-sm">
            © 2026{' '}
            <span className="text-indigo-400 font-semibold">EvenGo</span>{' '}
            · Hecho con ❤️ en Buenos Aires
          </p>
        </footer>
      </div>
    </div>
  );
}
