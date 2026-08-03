import { useState, useMemo, useEffect, useCallback } from 'react';
import { mockEvents } from '../data/events';
import { fetchEvenGoEvents } from '../services/evengoService';
import { isInDateRange } from '../utils/calendarUtils';

/**
 * Hook personalizado que gestiona los eventos y el sistema de filtros combinables.
 *
 * Estrategia de datos:
 *  1. En el primer render, carga los mocks inmediatamente para no mostrar pantalla vacía.
 *  2. Dispara un fetch al backend propio (/api/events) en background.
 *     El backend ejecuta el pipeline ETL contra la API del GCBA.
 *  3. Si el fetch tiene éxito y retorna eventos → reemplaza los mocks con datos reales.
 *  4. Si el fetch falla (backend no disponible, GCBA caído, 0 eventos) → mantiene
 *     los mocks y expone el error en el DataSourceBanner.
 *
 * Tip de desarrollo:
 *  - `npm run dev`   → /api/events devuelve 404 → se muestran mocks (OK para UI)
 *  - `vercel dev`    → /api/events ejecuta la función serverless real (ETL completo)
 */
export function useEvents() {
  // ── Estado de datos ──────────────────────────────────────────────────────
  const [events, setEvents] = useState(mockEvents);       // inicia con mocks
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [usingMocks, setUsingMocks] = useState(true);

  // ── Estado de filtros ────────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    category: 'Todos',
    location: 'Todas las zonas',
    dateRange: 'all',
    searchText: '',
    price: 'Todos',
  });

  // ── Fetch de eventos reales ──────────────────────────────────────────────
  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const liveEvents = await fetchEvenGoEvents();

      if (liveEvents.length > 0) {
        setEvents(liveEvents);
        setUsingMocks(false);
      } else {
        // El backend respondió OK pero sin eventos (GCBA sin datos): mantener mocks
        console.warn('[EvenGo] /api/events retornó 0 eventos. Usando datos de demostración.');
        setUsingMocks(true);
      }
    } catch (err) {
      console.error('[EvenGo] Error al cargar eventos desde /api/events:', err.message);
      // En caso de error mantenemos los mocks visibles para el usuario
      setError(err.message);
      setUsingMocks(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Cargar eventos al montar el componente
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // ── Filtrado combinado reactivo ──────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      const matchesCategory =
        filters.category === 'Todos' || event.category === filters.category;

      const matchesLocation =
        filters.location === 'Todas las zonas' ||
        event.location === filters.location;

      const matchesDate = isInDateRange(event.date, filters.dateRange);

      const matchesSearch =
        filters.searchText === '' ||
        event.title.toLowerCase().includes(filters.searchText.toLowerCase()) ||
        event.description.toLowerCase().includes(filters.searchText.toLowerCase());

      const isFree = (price) => {
        if (price == null) return false;
        const p = String(price).toLowerCase().trim();
        return p === '0' || p === 'gratis' || p === 'gratuito' || p === 'sin cargo';
      };

      const eventIsFree = isFree(event.precio ?? event.price);

      const matchesPrice =
        filters.price === 'Todos' ||
        (filters.price === 'Gratis' && eventIsFree) ||
        (filters.price === 'Pago' && !eventIsFree);

      return matchesCategory && matchesLocation && matchesDate && matchesSearch && matchesPrice;
    });
  }, [events, filters]);

  // ── Callbacks de filtros ─────────────────────────────────────────────────
  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => {
    setFilters({
      category: 'Todos',
      location: 'Todas las zonas',
      dateRange: 'all',
      searchText: '',
      price: 'Todos',
    });
  };

  return {
    // Datos
    events,
    filteredEvents,
    totalEvents: events.length,
    // Estado de carga
    loading,
    error,
    usingMocks,
    // Acciones
    updateFilter,
    resetFilters,
    retry: loadEvents,
    filters,
  };
}
