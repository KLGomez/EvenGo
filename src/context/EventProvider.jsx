import React from 'react';
import { useEvents } from '../hooks/useEvents';
import { EventContext } from './EventContext';

/**
 * EventProvider: Proveedor de Estado Global de Eventos
 * 
 * Centraliza la carga y el estado de eventos (fetch a /api/events o fallback de mocks)
 * en el nivel superior de la aplicación. De esta forma, múltiples rutas (/ y /radar-cultural)
 * comparten el mismo estado en memoria sin realizar llamadas HTTP duplicadas.
 */
export function EventProvider({ children }) {
  const eventsState = useEvents();

  return (
    <EventContext.Provider value={eventsState}>
      {children}
    </EventContext.Provider>
  );
}

export default EventProvider;
