import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from 'recharts';
import {
  Download,
  ChevronDown,
  FileText,
  Table,
} from 'lucide-react';
import { useEventAnalytics } from '../hooks/useEventAnalytics';
import { useEventContext } from '../hooks/useEventContext';
import { downloadCSV } from '../utils/exportToCSV';
import { NextEventCard } from './NextEventCard';
import { WeatherOpportunityWidget } from './WeatherOpportunityWidget';

// Paletas de colores vibrantes para los gráficos
const PRICING_COLORS = {
  Gratuito: '#10B981', // Verde Esmeralda
  Pago: '#8B5CF6',     // Violeta Moderno
};

const BAR_COLOR = '#3B82F6'; // Azul primario para barrios
const RADAR_COLOR = '#8B5CF6'; // Violeta principal para el radar temático

/**
 * Retorna la fecha actual en formato DD/MM/YYYY asegurando fidelidad ejecutiva.
 * Ej: '02/09/2026'
 */
const getExecutiveFormattedDate = () => {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Componente Visual: Dashboard Cultural de EvenGo (Vista Inmersiva /radar-cultural)
 * 
 * Consume el contexto global de eventos y el motor analítico `useEventAnalytics`
 * para renderizar tarjetas KPI e indicadores gráficos interactivos con Recharts.
 * Ofrece exportación multimodal: CSV (datos tabulares crudos) y PDF (Reporte Ejecutivo Corporativo
 * estilizado para impresión A4 mediante window.print() y @media print).
 */
export function Dashboard() {
  // Consumo del estado global para reutilizar la data en memoria sin re-fetchear
  const { events, loading, error, usingMocks, retry } = useEventContext();

  // Invocación del Motor Analítico
  const { pricingStats, topLocations, categoryStats, kpis } = useEventAnalytics(events);

  // Control de estado para el dropdown de exportación
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportMenuRef = useRef(null);

  // Fecha actual calculada para el reporte ejecutivo
  const executiveDate = getExecutiveFormattedDate();

  // Métricas analíticas secundarias para contextualizar los KPIs superiores
  const freeCount = pricingStats.find((item) => item.name === 'Gratuito')?.value ?? 0;
  const leaderCount = topLocations.length > 0 ? topLocations[0].count : 0;
  const leaderNeighborhoodShare = kpis.totalEvents > 0
    ? Math.round((leaderCount / kpis.totalEvents) * 100)
    : 0;

  // Manejo de accesibilidad y cierre al hacer clic fuera o presionar 'Escape'
  useEffect(() => {
    if (!isExportOpen) return;

    const handleClickOutside = (event) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setIsExportOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsExportOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isExportOpen]);

  // Manejador: Exportar CSV
  const handleExportCSV = () => {
    setIsExportOpen(false);
    downloadCSV(events, 'evengo-radar-cultural.csv');
  };

  // Manejador: Descargar Reporte Ejecutivo en PDF (window.print() estilizado)
  const handlePrintPDF = () => {
    setIsExportOpen(false);
    const originalTitle = document.title;
    const fileDateTag = executiveDate.replace(/\//g, '-');
    document.title = `EvenGo_Reporte_Ejecutivo_RadarCultural_${fileDateTag}`;

    // Despacho asíncrono para garantizar que el menú dropdown se cierre en el DOM antes de invocar print()
    setTimeout(() => {
      window.print();
      // Restauración limpia del título original de la pestaña
      setTimeout(() => {
        document.title = originalTitle;
      }, 1000);
    }, 150);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20 print:pb-6 print:bg-[#0b1120]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 print:px-0 print:pt-2">
        
        {/* ── Encabezado Corporativo Exclusivo para Impresión / PDF ─────────────── */}
        <header className="hidden print:block mb-6 border-b-2 border-indigo-500 pb-4">
          <div className="flex items-start justify-between">
            {/* Identidad de Marca EvenGo */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-indigo-600 flex items-center justify-center text-2xl shadow-sm border border-indigo-400">
                🗺️
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black tracking-tight text-white">
                    Even<span className="text-indigo-400">Go</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-widest">
                    Reporte Ejecutivo
                  </span>
                </div>
                <h1 className="text-xl font-extrabold text-slate-100 mt-1">
                  Radar Cultural — Diagnóstico y Métricas Estratégicas
                </h1>
                <p className="text-xs text-slate-300 mt-0.5">
                  Observatorio de Dinámicas Culturales y Agenda Urbana · Ciudad Autónoma de Buenos Aires
                </p>
              </div>
            </div>

            {/* Metadatos Ejecutivos de Emisión */}
            <div className="text-right text-xs text-slate-300 space-y-1 bg-slate-900/60 p-3 rounded-xl border border-slate-700/80">
              <div>
                <span className="text-slate-400 font-medium">Fecha de Emisión: </span>
                <span className="font-bold text-white tracking-wide">{executiveDate}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Eventos Auditados: </span>
                <span className="font-bold text-indigo-300">{kpis.totalEvents}</span>
              </div>
              <div>
                <span className="text-slate-400 font-medium">Ámbito: </span>
                <span className="font-semibold text-slate-200">Buenos Aires (CABA)</span>
              </div>
            </div>
          </div>
        </header>

        {/* ── Encabezado Interactivo en Pantalla (Oculto al Imprimir) ───────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b border-white/10 pb-6 no-print print:hidden">
          <div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors mb-2"
            >
              ← Volver a la Agenda
            </Link>
            <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Radar Cultural 📊
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Visualización analítica en tiempo real · {events.length} eventos en catálogo
            </p>
          </div>

          {/* Acciones de Encabezado (Badge Mocks + Dropdown de Exportación) */}
          <div className="flex flex-wrap items-center gap-3">
            {usingMocks && (
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Modo Mocks Activado
              </div>
            )}

            {/* Dropdown de Exportación Ejecutivo (CSV / PDF) */}
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setIsExportOpen((prev) => !prev)}
                disabled={events.length === 0}
                aria-expanded={isExportOpen}
                aria-haspopup="menu"
                className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all flex items-center gap-2.5 border shadow-sm ${
                  isExportOpen
                    ? 'bg-indigo-600 text-white border-indigo-500 ring-2 ring-indigo-500/30'
                    : 'bg-white/5 hover:bg-white/10 active:scale-95 text-slate-200 border-white/10 hover:border-white/20'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title="Opciones de exportación de datos y reportes ejecutivos"
              >
                <Download className="w-4 h-4 text-indigo-400" />
                <span>Exportar</span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                    isExportOpen ? 'rotate-180 text-white' : ''
                  }`}
                />
              </button>

              {/* Panel Flotante del Menú de Exportación */}
              {isExportOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Opciones de Exportación
                    </p>
                  </div>

                  {/* Opción 1: Descargar Reporte PDF */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handlePrintPDF}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-xs sm:text-sm text-slate-200 hover:text-white hover:bg-indigo-600/20 active:bg-indigo-600/30 flex items-start gap-3 transition-colors group"
                  >
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold flex items-center justify-between">
                        <span>Descargar Reporte PDF</span>
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-medium px-1.5 py-0.5 rounded">
                          PDF
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                        Reporte corporativo estilizado con KPIs y métricas (A4)
                      </p>
                    </div>
                  </button>

                  {/* Opción 2: Exportar Datos CSV */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleExportCSV}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-xs sm:text-sm text-slate-200 hover:text-white hover:bg-emerald-600/20 active:bg-emerald-600/30 flex items-start gap-3 transition-colors group mt-1"
                  >
                    <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-colors mt-0.5">
                      <Table className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold flex items-center justify-between">
                        <span>Exportar CSV</span>
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-medium px-1.5 py-0.5 rounded">
                          CSV
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                        Dataset tabular ({events.length} registros) para hojas de cálculo
                      </p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>


        {/* Estado de Carga / Error */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-400 text-sm">Procesando métricas culturales...</p>
          </div>
        ) : error && events.length === 0 ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-300 p-6 rounded-xl text-center my-8">
            <p className="font-semibold mb-2">Error al cargar datos del Radar</p>
            <button
              onClick={retry}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-500 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {/* ── Widget Analítico: Índice de Clima y Oportunidad ──────────── */}
            <div className="print-break-inside-avoid print:mb-4">
              <WeatherOpportunityWidget events={events} />
            </div>

            {/* ── Fila Superior de Tarjetas KPI ───────────────────────────── */}
            <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-4 print:gap-3 mb-8 print:mb-6 print-break-inside-avoid">
              {/* Card 1: Total Eventos */}
              <div className="flex flex-col justify-between h-full p-6 print:p-4 bg-[#131b2f] rounded-2xl border border-slate-800 print:border-slate-700 shadow-lg print-break-inside-avoid">
                {/* Top */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium text-sm">Total Eventos</span>
                  <span className="text-xl">🎟️</span>
                </div>

                {/* Centro (Métrica) */}
                <div className="my-auto py-2">
                  <span className="text-2xl lg:text-3xl font-bold text-white tracking-tight block">
                    {kpis.totalEvents}
                  </span>
                </div>

                {/* Bottom */}
                <div className="border-t border-slate-800/60 print:border-slate-700/60 pt-3 mt-4 print:mt-2 print:pt-2">
                  <p className="text-xs text-slate-400 truncate">
                    Sincronizado con portal GCBA
                  </p>
                </div>
              </div>

              {/* Card 2: Barrio Líder */}
              <div className="flex flex-col justify-between h-full p-6 print:p-4 bg-[#131b2f] rounded-2xl border border-slate-800 print:border-slate-700 shadow-lg print-break-inside-avoid">
                {/* Top */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium text-sm">Barrio Líder</span>
                  <span className="text-xl">📍</span>
                </div>

                {/* Centro (Métrica) */}
                <div className="my-auto py-2 min-w-0">
                  <span
                    className="text-2xl lg:text-3xl font-bold text-white tracking-tight truncate block"
                    title={kpis.topNeighborhood}
                  >
                    {kpis.topNeighborhood}
                  </span>
                </div>

                {/* Bottom */}
                <div className="border-t border-slate-800/60 print:border-slate-700/60 pt-3 mt-4 print:mt-2 print:pt-2">
                  <p className="text-xs text-slate-400 truncate">
                    {leaderNeighborhoodShare > 0
                      ? `Concentra el ${leaderNeighborhoodShare}% de la agenda cultural`
                      : 'Mayor concentración cultural'}
                  </p>
                </div>
              </div>

              {/* Card 3: % Eventos Gratis */}
              <div className="flex flex-col justify-between h-full p-6 print:p-4 bg-[#131b2f] rounded-2xl border border-slate-800 print:border-slate-700 shadow-lg print-break-inside-avoid">
                {/* Top */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium text-sm">Eventos Gratis</span>
                  <span className="text-xl">💰</span>
                </div>

                {/* Centro (Métrica) */}
                <div className="my-auto py-2">
                  <span className="text-2xl lg:text-3xl font-bold text-white tracking-tight block">
                    {kpis.freePercentage}
                  </span>
                </div>

                {/* Bottom */}
                <div className="border-t border-slate-800/60 print:border-slate-700/60 pt-3 mt-4 print:mt-2 print:pt-2">
                  <p className="text-xs text-slate-400 truncate">
                    {freeCount > 0
                      ? `${freeCount} opciones de acceso libre en cartelera`
                      : 'Opciones de acceso libre en cartelera'}
                  </p>
                </div>
              </div>

              {/* Card 4: Próximo Evento (Interactivo con micro-interacciones) */}
              <div className="print-break-inside-avoid">
                <NextEventCard event={kpis.nextEventItem || { title: kpis.nextEvent }} />
              </div>
            </section>

            {/* ── Grid de Gráficos Recharts ───────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 gap-6 print:gap-4">
              
              {/* 1. PieChart: Gratuitos vs Pagos */}
              <article className="bg-slate-900/80 backdrop-blur-md border border-white/10 print:border-slate-700 p-6 print:p-4 rounded-2xl shadow-xl print-break-inside-avoid">
                <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  🏷️ Distribución por Precio
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  Proporción de eventos culturales de acceso libre vs entrada paga
                </p>

                <div className="w-full h-80 print:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pricingStats}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={95}
                        innerRadius={55}
                        paddingAngle={6}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pricingStats.map((entry) => (
                          <Cell
                            key={`cell-${entry.name}`}
                            fill={PRICING_COLORS[entry.name] || '#9CA3AF'}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val) => [`${val} eventos`, 'Total']}
                        contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#FFF', borderRadius: '12px' }}
                      />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </article>

              {/* 2. BarChart: Top 5 Barrios */}
              <article className="bg-slate-900/80 backdrop-blur-md border border-white/10 print:border-slate-700 p-6 print:p-4 rounded-2xl shadow-xl print-break-inside-avoid">
                <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  📍 Top 5 Barrios Culturales
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  Barrios con mayor concentración de oferta de eventos
                </p>

                <div className="w-full h-80 print:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topLocations}
                      margin={{ top: 10, right: 30, left: 0, bottom: 25 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#94A3B8', fontSize: 12 }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                      />
                      <YAxis allowDecimals={false} tick={{ fill: '#94A3B8' }} />
                      <Tooltip
                        formatter={(val) => [`${val} eventos`, 'Eventos']}
                        contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#FFF', borderRadius: '12px' }}
                      />
                      <Bar
                        dataKey="count"
                        name="Eventos"
                        fill={BAR_COLOR}
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </article>

              {/* 3. RadarChart: Ecosistema Temático */}
              <article className="bg-slate-900/80 backdrop-blur-md border border-white/10 print:border-slate-700 p-6 print:p-4 rounded-2xl shadow-xl col-span-1 md:col-span-2 lg:col-span-1 print:col-span-1 print-break-inside-avoid">
                <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                  🕸️ Ecosistema Temático
                </h2>
                <p className="text-xs text-slate-400 mb-4">
                  Distribución de eventos por las 6 principales categorías
                </p>

                <div className="w-full h-80 print:h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={categoryStats}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="name" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                      <PolarRadiusAxis angle={30} stroke="#334155" tick={{ fill: '#64748B', fontSize: 10 }} />
                      <Radar
                        name="Eventos"
                        dataKey="count"
                        stroke={RADAR_COLOR}
                        fill={RADAR_COLOR}
                        fillOpacity={0.6}
                      />
                      <Tooltip
                        formatter={(val) => [`${val} eventos`, 'Cantidad']}
                        contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', color: '#FFF', borderRadius: '12px' }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </article>

            </div>

            {/* ── Pie de Página Corporativo Exclusivo para Reporte Ejecutivo en PDF ── */}
            <footer className="hidden print:flex flex-col sm:flex-row items-center justify-between mt-10 pt-4 border-t border-slate-700/80 text-xs text-slate-400 print-break-inside-avoid">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200">EvenGo Buenos Aires</span>
                <span>·</span>
                <span>Plataforma de Inteligencia y Descubrimiento Cultural</span>
              </div>
              <div className="text-right text-slate-400 mt-1 sm:mt-0">
                <span>Reporte Oficial emitido el {executiveDate} · Confidencial / Uso Ejecutivo</span>
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
