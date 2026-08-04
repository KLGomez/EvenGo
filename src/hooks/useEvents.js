import { useState, useMemo, useEffect, useCallback } from 'react';
import { mockEvents } from '../data/events';
import { fetchEvenGoEvents } from '../services/evengoService';
import { isInDateRange } from '../utils/calendarUtils';

/**
 * Determina si un evento aún no ha caducado comparando su fecha y hora con el momento actual.
 *
 * @param {string} dateString - Fecha del evento (soporta YYYY-MM-DD, DD/MM/YYYY, etc. con separadores - y /)
 * @param {string} timeString - Horario del evento (ej: '18:30', '20:00 hs', null)
 * @returns {boolean} true si el evento es futuro o actual (>= new Date()), false si ya pasó.
 */
export function isEventUpcoming(dateString, timeString) {
  if (!dateString || typeof dateString !== 'string') return false;

  // 1. Parsear dateString de forma robusta (soportando tanto '-' como '/')
  const cleanDateStr = dateString.trim().replace(/\//g, '-');
  const parts = cleanDateStr.split('-');

  if (parts.length !== 3) return false;

  let year, month, day;

  // Detectar formato: YYYY-MM-DD vs DD-MM-YYYY
  if (parts[0].length === 4) {
    // YYYY-MM-DD o YYYY/MM/DD
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  } else if (parts[2].length === 4) {
    // DD-MM-YYYY o DD/MM/YYYY
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    year = parseInt(parts[2], 10);
  } else {
    // Fallback estándar
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10) - 1;
    day = parseInt(parts[2], 10);
  }

  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;

  // 2. Extraer horas y minutos de timeString
  let hours = 23;
  let minutes = 59;
  let seconds = 59;
  let hasValidTime = false;

  if (timeString && typeof timeString === 'string') {
    // Busca patrones de hora válidos (ej. '18:30', '20:00 hs', '9:15', '08:00')
    const match = timeString.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      const parsedHours = parseInt(match[1], 10);
      const parsedMinutes = parseInt(match[2], 10);

      if (
        !isNaN(parsedHours) &&
        parsedHours >= 0 &&
        parsedHours < 24 &&
        !isNaN(parsedMinutes) &&
        parsedMinutes >= 0 &&
        parsedMinutes < 60
      ) {
        hours = parsedHours;
        minutes = parsedMinutes;
        seconds = 0;
        hasValidTime = true;
      }
    }
  }

  // Caso borde crítico: Si timeString es nulo, vacío o ilegible,
  // asume que el evento dura todo el día y setea la hora a las 23:59:59.
  if (!hasValidTime) {
    hours = 23;
    minutes = 59;
    seconds = 59;
  }

  // 3. Crear el objeto Date del evento y comparar con el momento actual (new Date())
  const eventDate = new Date(year, month, day, hours, minutes, seconds);
  const now = new Date();

  return eventDate >= now;
}

/**
 * Hook personalizado que gestiona los eventos y el sistema de filtros combinables.
 *
 * Estrategia de datos:
 *  1. En el primer render, carga los mocks vigentes inmediatamente.
 *  2. Dispara un fetch al backend propio (/api/events) en background.
 *  3. Si el fetch tiene éxito y retorna eventos → aplica filtro isEventUpcoming y setea estado.
 *  4. Si el fetch falla o no hay datos → mantiene los mocks vigentes.
 */
export function useEvents() {
  // ── Estado de datos (inicializa solo con eventos vigentes) ────────────────
  const [events, setEvents] = useState(() =>
    mockEvents.filter((event) => isEventUpcoming(event.date, event.time))
  );
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

      // Filtrar eventos que no hayan caducado
      const upcomingEvents = liveEvents.filter((event) =>
        isEventUpcoming(event.date, event.time)
      );

      if (upcomingEvents.length > 0) {
        setEvents(upcomingEvents);
        setUsingMocks(false);
      } else {
        // El backend respondió OK pero sin eventos vigentes
        console.warn('[EvenGo] /api/events retornó 0 eventos vigentes. Usando datos de demostración.');
        setEvents(mockEvents.filter((event) => isEventUpcoming(event.date, event.time)));
        setUsingMocks(true);
      }
    } catch (err) {
      console.error('[EvenGo] Error al cargar eventos desde /api/events:', err.message);
      // En caso de error mantenemos los mocks vigentes visibles para el usuario
      setEvents(mockEvents.filter((event) => isEventUpcoming(event.date, event.time)));
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

export default useEvents;
