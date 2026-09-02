// src/components/WeatherOpportunityWidget.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Sun,
  CloudSun,
  CloudRain,
  CloudLightning,
  Sparkles,
  Compass,
  Building2,
  Trees,
  RefreshCw,
  ArrowUpRight,
} from 'lucide-react';
import {
  fetchBuenosAiresWeather,
  calculateOpportunityMetrics,
  WEATHER_PRESETS,
} from '../utils/weatherOpportunity';

/**
 * WeatherOpportunityWidget - Banner Horizontal Compacto 'Índice de Clima y Oportunidad'
 *
 * Versión optimizada para dashboards modernos:
 * - Diseño tipo banner de una sola franja horizontal (ultra-compacto, reduce >60% de altura)
 * - Izquierda: Estado del clima resumido (ícono, temperatura en grande y condición en una sola línea)
 * - Centro: Veredicto de oportunidad + barrita de progreso simplificada + acceso colapsable a recomendados
 * - Derecha: Pastillas (pills) sutiles de simulación ([En vivo] [Buen tiempo] [Lluvia])
 *
 * @param {Object} props
 * @param {Array} props.events - Array de eventos de EvenGo
 */
export function WeatherOpportunityWidget({ events = [] }) {
  // Modo de simulación: 'live' (Open-Meteo), 'clear' (Soleado), 'rainy' (Lluvia)
  const [mode, setMode] = useState('live');
  const [liveWeather, setLiveWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Consulta meteorológica inicial a Buenos Aires
  const loadLiveWeather = async () => {
    setLoadingWeather(true);
    const data = await fetchBuenosAiresWeather();
    setLiveWeather(data);
    setLoadingWeather(false);
  };

  useEffect(() => {
    loadLiveWeather();
  }, []);

  // Clima efectivo en base al modo seleccionado
  const currentWeather = useMemo(() => {
    if (mode === 'clear') return WEATHER_PRESETS.clear;
    if (mode === 'rainy') return WEATHER_PRESETS.rainy;
    return liveWeather || WEATHER_PRESETS.clear;
  }, [mode, liveWeather]);

  // Motor analítico de oportunidad cultural
  const metrics = useMemo(() => {
    return calculateOpportunityMetrics(events, currentWeather);
  }, [events, currentWeather]);

  const isFavorable = currentWeather.isFavorable;

  // Render del icono de clima
  const renderWeatherIcon = (iconType, className = 'w-5 h-5') => {
    switch (iconType) {
      case 'rain':
        return <CloudRain className={`${className} text-indigo-400`} />;
      case 'cloud-sun':
        return <CloudSun className={`${className} text-amber-300`} />;
      case 'lightning':
        return <CloudLightning className={`${className} text-purple-400`} />;
      case 'sun':
      default:
        return <Sun className={`${className} text-amber-400`} />;
    }
  };

  return (
    <section
      aria-label="Índice de Clima y Oportunidad"
      className="relative rounded-2xl border border-slate-800 bg-[#131b2f] px-4 py-3 sm:px-5 sm:py-3.5 shadow-lg mb-6 transition-all duration-300"
    >
      {/* Resplandor ambiental de fondo sutil */}
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl transition-all duration-700 opacity-60 ${
          isFavorable ? 'bg-emerald-500/10' : 'bg-fuchsia-500/10'
        }`}
        aria-hidden="true"
      />

      {/* ── Micro-barra superior: Identificación y Badge de Estado ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 mb-2.5 border-b border-slate-800/60 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5 text-xs">
            <Compass className="w-3.5 h-3.5 text-indigo-400" />
            Índice de Clima y Oportunidad
          </span>
          <span className="text-slate-600 hidden sm:inline">•</span>
          <span className="text-slate-400 text-[11px] hidden sm:inline">
            Pronóstico en Buenos Aires & Recomendaciones
          </span>
        </div>

        {/* Badge de Estado Dinámico e Interactivo */}
        <div className="relative">
          <button
            type="button"
            onClick={() => metrics.recommendedEvents.length > 0 && setShowSuggestions(!showSuggestions)}
            className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full border transition-all ${
              metrics.recommendedEvents.length > 0 ? 'cursor-pointer hover:scale-105 active:scale-95' : 'cursor-default'
            } ${
              isFavorable
                ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-fuchsia-500/10 hover:bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30'
            }`}
            title={
              metrics.recommendedEvents.length > 0
                ? `Click para ver eventos recomendados (${metrics.recommendedEvents.length})`
                : ''
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                isFavorable ? 'bg-emerald-400' : 'bg-fuchsia-400'
              }`}
            />
            <span>
              {isFavorable ? '☀️ Aire Libre Óptimo' : '🌧️ Refugio Cultural'}
            </span>
            {metrics.recommendedEvents.length > 0 && (
              <span className="text-[10px] opacity-80 font-normal">
                ({metrics.recommendedEvents.length}) ▾
              </span>
            )}
            {/* Texto accesible para lectores de pantalla y tests de recomendados */}
            <span className="sr-only">
              {isFavorable ? 'Recomendados al Aire Libre' : 'Recomendados Bajo Techo'}
            </span>
          </button>

          {/* Popover flotante de sugerencias al hacer clic en el badge */}
          {showSuggestions && metrics.recommendedEvents.length > 0 && (
            <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2 pb-1.5 border-b border-slate-800">
                <span className="font-bold text-white flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  {isFavorable ? 'Recomendados al Aire Libre' : 'Recomendados Bajo Techo'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowSuggestions(false)}
                  className="text-slate-400 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {metrics.recommendedEvents.map((event) => {
                  const targetUrl = event.id ? `/eventos/${event.id}` : '#';
                  return (
                    <Link
                      key={event.id || event.title}
                      to={targetUrl}
                      onClick={() => setShowSuggestions(false)}
                      className="block p-2 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 transition-all text-left group"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
                        <span
                          className={`font-semibold ${
                            isFavorable ? 'text-emerald-400' : 'text-fuchsia-400'
                          }`}
                        >
                          {event.category}
                        </span>
                        <span className="truncate">{event.location || 'Buenos Aires'}</span>
                      </div>
                      <div className="text-xs font-bold text-white group-hover:text-indigo-300 truncate flex items-center justify-between">
                        <span className="truncate">{event.title}</span>
                        <ArrowUpRight className="w-3 h-3 text-slate-500 group-hover:text-white flex-shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Franja Horizontal Unificada (Izquierda • Centro • Derecha) ── */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 lg:gap-6">
        
        {/* 1. IZQUIERDA: Clima actual en una sola línea compacta */}
        <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
          <div className="p-1.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center">
            {renderWeatherIcon(currentWeather.icon, 'w-6 h-6')}
          </div>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-2xl font-black text-white tracking-tight">
              {currentWeather.temperature}°C
            </span>
            <span className="text-slate-500 text-xs">•</span>
            <span className="text-xs font-semibold text-slate-200 capitalize truncate">
              {currentWeather.conditionText}
            </span>
            <span className="text-[11px] text-slate-400 hidden xl:inline">
              (💧 {currentWeather.precipitationProb}% lluvia • 💨 {currentWeather.windSpeed} km/h)
            </span>
          </div>
        </div>

        {/* 2. CENTRO: Veredicto de Oportunidad y Barra de Progreso Minimalista */}
        <div className="flex flex-col gap-1.5 w-full lg:w-auto min-w-0">
          <div className="flex items-center gap-1.5 text-xs">
            {isFavorable ? (
              <span className="font-bold text-emerald-400 flex items-center gap-1.5 truncate">
                <Trees className="w-3.5 h-3.5 flex-shrink-0" />
                Ventana Óptima para Salidas al Aire Libre ({metrics.outdoorPercentage}% Al Aire Libre)
              </span>
            ) : (
              <span className="font-bold text-fuchsia-300 flex items-center gap-1.5 truncate">
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                Oportunidad: Explorar 'Planes Bajo Techo' ({metrics.indoorPercentage}% Bajo Techo)
              </span>
            )}
          </div>

          {/* Barrita de Progreso Simplificada y Contador */}
          <div className="flex items-center gap-2.5">
            <div className="w-28 sm:w-40 h-1.5 bg-slate-800 rounded-full overflow-hidden flex flex-shrink-0">
              <div
                className={`h-full transition-all duration-500 ${
                  isFavorable ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-emerald-700/60'
                }`}
                style={{ width: `${metrics.outdoorPercentage}%` }}
                title={`${metrics.outdoorCount} al aire libre (${metrics.outdoorPercentage}%)`}
              />
              <div
                className={`h-full transition-all duration-500 ${
                  !isFavorable
                    ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-sm shadow-fuchsia-500/50'
                    : 'bg-slate-700'
                }`}
                style={{ width: `${metrics.indoorPercentage}%` }}
                title={`${metrics.indoorCount} bajo techo (${metrics.indoorPercentage}%)`}
              />
            </div>

            <span className="text-[11px] text-slate-400 whitespace-nowrap">
              {isFavorable
                ? `${metrics.outdoorCount} al aire libre`
                : `${metrics.indoorCount} bajo techo`}
            </span>
          </div>
        </div>

        {/* 3. DERECHA: Pastillas (pills) sutiles de simulación */}
        <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-[11px] font-medium flex-shrink-0 self-start sm:self-auto no-print print:hidden">
          <button
            type="button"
            onClick={() => setMode('live')}
            disabled={loadingWeather}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
              mode === 'live'
                ? 'bg-indigo-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Sincronizar estación meteorológica en vivo (Open-Meteo)"
          >
            <RefreshCw
              className={`w-2.5 h-2.5 ${loadingWeather && mode === 'live' ? 'animate-spin' : ''}`}
            />
            <span>En vivo</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('clear')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
              mode === 'clear'
                ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Simular buen tiempo"
          >
            <span>☀️</span>
            <span>Buen tiempo</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('rainy')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 ${
              mode === 'rainy'
                ? 'bg-fuchsia-600 text-white font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="Simular lluvia"
          >
            <span>🌧️</span>
            <span>Lluvia</span>
          </button>
        </div>

      </div>
    </section>
  );
}

export default WeatherOpportunityWidget;
