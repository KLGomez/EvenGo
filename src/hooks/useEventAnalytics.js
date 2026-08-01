import { useMemo } from 'react';

/**
 * Custom Hook: useEventAnalytics
 * 
 * Procesa el array de eventos de EvenGo para calcular métricas clave de negocio y KPIs.
 * Utiliza .reduce() para agrupar y transformar los datos en un solo pase lineal O(N),
 * y useMemo para optimizar el rendimiento evitando recálculos innecesarios.
 * 
 * @param {Array} events - Array de objetos EvenGoEvent { id, title, category, location, precio, date, startDate, fecha }
 * @returns {{ pricingStats: Array, topLocations: Array, categoryStats: Array, kpis: Object }}
 */
export function useEventAnalytics(events = []) {
  return useMemo(() => {
    // Si la lista de eventos está vacía o es inválida, retorna valores iniciales seguros
    if (!Array.isArray(events) || events.length === 0) {
      return {
        pricingStats: [
          { name: 'Gratuito', value: 0 },
          { name: 'Pago', value: 0 },
        ],
        topLocations: [],
        categoryStats: [],
        kpis: {
          totalEvents: 0,
          topNeighborhood: 'Sin datos',
          freePercentage: '0%',
          nextEvent: 'No hay próximos',
        },
      };
    }

    // 1. Transformación de datos mediante .reduce() en una sola pasada O(N)
    const analyticsMap = events.reduce(
      (acc, event) => {
        // --- Transformación 1: Clasificación de Precio ---
        const rawPrice = event.precio;
        const isFree =
          rawPrice === 0 ||
          rawPrice === '0' ||
          rawPrice === 'Gratis' ||
          !rawPrice ||
          (typeof rawPrice === 'string' && rawPrice.toLowerCase().includes('gratis'));

        if (isFree) {
          acc.pricing.Gratuito += 1;
        } else {
          acc.pricing.Pago += 1;
        }

        // --- Transformación 2: Conteo por Barrio (Location) ---
        const loc = event.location || 'Sin ubicación';
        acc.locations[loc] = (acc.locations[loc] || 0) + 1;

        // --- Transformación 3: Conteo por Categoría ---
        const cat = event.category || 'Otros';
        acc.categories[cat] = (acc.categories[cat] || 0) + 1;

        return acc;
      },
      {
        pricing: { Gratuito: 0, Pago: 0 },
        locations: {},
        categories: {},
      }
    );

    // 2. Formatear pricingStats para PieChart (Array de { name, value })
    const pricingStats = [
      { name: 'Gratuito', value: analyticsMap.pricing.Gratuito },
      { name: 'Pago', value: analyticsMap.pricing.Pago },
    ];

    // 3. Formatear y ordenar topLocations (Top 5 barrios con mayor número de eventos)
    const topLocations = Object.entries(analyticsMap.locations)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 4. Formatear y ordenar categoryStats (Top 6 categorías { name, count })
    const categoryStats = Object.entries(analyticsMap.categories)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    // 5. Cálculo de Indicadores Clave (KPIs)
    const totalEvents = events.length;

    // Barrio líder (posición 0 de topLocations)
    const topNeighborhood = topLocations.length > 0 ? topLocations[0].name : 'Sin datos';

    // Porcentaje exacto de eventos gratuitos sobre el total
    const freeCount = analyticsMap.pricing.Gratuito;
    const freePercentage = totalEvents > 0 ? `${Math.round((freeCount / totalEvents) * 100)}%` : '0%';

    // Próximo evento futuro respecto a new Date()
    const now = new Date().getTime();
    const futureEvents = events
      .map((e) => {
        const rawDate = e.startDate || e.date || e.fecha;
        if (!rawDate) return null;
        const parsedDate = new Date(rawDate);
        return isNaN(parsedDate.getTime()) ? null : { title: e.title, time: parsedDate.getTime() };
      })
      .filter((e) => e !== null && e.time >= now)
      .sort((a, b) => a.time - b.time);

    const nextEvent = futureEvents.length > 0 ? futureEvents[0].title : 'No hay próximos';

    const kpis = {
      totalEvents,
      topNeighborhood,
      freePercentage,
      nextEvent,
    };

    return {
      pricingStats,
      topLocations,
      categoryStats,
      kpis,
    };
  }, [events]);
}

export default useEventAnalytics;
