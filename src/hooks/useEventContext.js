import { useContext } from 'react';
import { EventContext } from '../context/EventContext';

/**
 * Custom Hook para consumir el contexto global de eventos.
 */
export function useEventContext() {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEventContext debe ser usado dentro de un EventProvider');
  }
  return context;
}

export default useEventContext;
