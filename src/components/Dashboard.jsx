import React from 'react';
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
} from 'recharts';
import { useEventAnalytics } from '../hooks/useEventAnalytics';
import { useEventContext } from '../hooks/useEventContext';

// Paletas de colores vibrantes para los gráficos
const PRICING_COLORS = {
  Gratuito: '#10B981', // Verde Esmeralda
  Pago: '#8B5CF6',     // Violeta Moderno
};

const BAR_COLOR = '#3B82F6'; // Azul primario para barrios

/**
 * Componente Visual: Dashboard Cultural de EvenGo (Vista Inmersiva /radar-cultural)
 * 
 * Consume el contexto global de eventos y el motor analítico `useEventAnalytics`
 * para renderizar métricas procesadas en gráficos interactivos con Recharts.
 */
export function Dashboard() {
  // Consumo del estado global para reutilizar la data en memoria sin re-fetchear
  const { events, loading, error, usingMocks, retry } = useEventContext();

  // Invocación del Motor Analítico
  const { pricingStats, topLocations } = useEventAnalytics(events);

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        
        {/* UX de Retorno + Encabezado de la Ruta Inmersiva */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b border-white/10 pb-6">
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

          {usingMocks && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              Modo Mocks Activado
            </div>
          )}
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
          /* Grid responsivo de gráficos */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* ── 1. Gráfico de Torta: Gratuitos vs Pagos ────────────────── */}
            <article className="bg-slate-900/80 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-xl">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                🏷️ Distribución por Precio
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Proporción de eventos culturales de acceso libre vs entrada paga
              </p>

              <div className="w-full h-80">
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

            {/* ── 2. Gráfico de Barras: Top 5 Barrios ────────────────────── */}
            <article className="bg-slate-900/80 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-xl">
              <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                📍 Top 5 Barrios Culturales
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Barrios con mayor concentración de oferta de eventos
              </p>

              <div className="w-full h-80">
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

          </div>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
