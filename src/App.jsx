import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import FilterPanel from './components/FilterPanel';
import EventGrid from './components/EventGrid';
import DataSourceBanner from './components/DataSourceBanner';
import Dashboard from './components/Dashboard';
import ChatBot from './components/ChatBot';
import ScrollToTop from './components/ScrollToTop';
import { EventProvider } from './context/EventProvider';
import { useEventContext } from './hooks/useEventContext';

/**
 * Vista Principal: Agenda de Eventos
 */
function HomeView() {
  const { id } = useParams();
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
  } = useEventContext();

  useEffect(() => {
    if (id) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`event-${id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-pink-500');
          setTimeout(() => el.classList.remove('ring-2', 'ring-pink-500'), 2500);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [id, filteredEvents]);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
      {/* Hero */}
      <Hero totalEvents={totalEvents} />

      {/* Layout principal: filtros + grid */}
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
  );
}

/**
 * Componente Raíz de la Aplicación EvenGo
 * Orquesta el proveedor de contexto global y el enrutamiento principal.
 */
export default function App() {
  return (
    <EventProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-slate-950 text-white">
          {/* Fondo estético con gradiente radial */}
          <div
            className="fixed inset-0 pointer-events-none z-0 no-print print:hidden"
            style={{
              background:
                'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99,102,241,0.12), transparent)',
            }}
            aria-hidden="true"
          />

          <div className="relative z-10">
            {/* Navbar compartido en todas las rutas */}
            <div className="no-print print:hidden">
              <Navbar />
            </div>

            {/* Configuración de Rutas */}
            <Routes>
              {/* Ruta Principal: Agenda de Eventos */}
              <Route path="/" element={<HomeView />} />
              <Route path="/eventos/:id" element={<HomeView />} />

              {/* Ruta Inmersiva: Radar Cultural (Dashboard Analítico) */}
              <Route path="/radar-cultural" element={<Dashboard />} />
            </Routes>

            {/* Widget de Asistente Virtual Flotante (Google Gemini) */}
            <div className="no-print print:hidden">
              <ChatBot />
            </div>

            {/* Botón flotante para regresar al inicio (Scroll to top) */}
            <div className="no-print print:hidden">
              <ScrollToTop />
            </div>

            {/* Footer Global */}
            <footer className="border-t border-white/5 py-8 text-center no-print print:hidden">
              <p className="text-slate-600 text-sm">
                © 2026{' '}
                <span className="text-indigo-400 font-semibold">EvenGo</span>{' '}
                · Hecho con ❤️ en Buenos Aires
              </p>
            </footer>
          </div>
        </div>
      </BrowserRouter>
    </EventProvider>
  );
}

