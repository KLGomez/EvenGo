import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'evengo_favorites';
const CUSTOM_EVENT_NAME = 'favoritesUpdated';

/**
 * Función auxiliar para leer los favoritos desde localStorage de forma segura.
 */
function getStoredFavorites() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error al leer favoritos desde localStorage:', error);
    return [];
  }
}

/**
 * Custom Hook para gestionar el estado y la persistencia de eventos favoritos (Planner personal).
 * Implementa un bus de eventos (window.dispatchEvent) y listener de storage para sincronizar
 * de forma reactiva el estado entre múltiples componentes y pestañas en tiempo real.
 */
export default function useFavorites() {
  // 1. Inicialización diferida leyendo localStorage
  const [favorites, setFavorites] = useState(getStoredFavorites);

  // 2. Función callback para sincronizar el estado reactivamente
  const syncFavorites = useCallback(() => {
    setFavorites(getStoredFavorites());
  }, []);

  // 3. Suscripción a eventos de sincronización (Custom Event para la misma pestaña, 'storage' para otras)
  useEffect(() => {
    window.addEventListener(CUSTOM_EVENT_NAME, syncFavorites);
    window.addEventListener('storage', syncFavorites);

    // Limpieza de event listeners al desmontar
    return () => {
      window.removeEventListener(CUSTOM_EVENT_NAME, syncFavorites);
      window.removeEventListener('storage', syncFavorites);
    };
  }, [syncFavorites]);

  /**
   * Agrega o elimina un evento de la lista de favoritos.
   * Guarda los datos en localStorage y despacha la notificación de actualización.
   * @param {Object|string|number} event - Objeto del evento o ID del evento.
   */
  const toggleFavorite = (event) => {
    if (!event) return;
    const targetId = typeof event === 'object' && event !== null ? event.id : event;

    const currentFavorites = getStoredFavorites();
    const exists = currentFavorites.some(
      (item) => (typeof item === 'object' && item !== null ? item.id : item) === targetId
    );

    let updatedFavorites;
    if (exists) {
      updatedFavorites = currentFavorites.filter(
        (item) => (typeof item === 'object' && item !== null ? item.id : item) !== targetId
      );
    } else {
      updatedFavorites = [event, ...currentFavorites];
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedFavorites));
      setFavorites(updatedFavorites);
      window.dispatchEvent(new Event(CUSTOM_EVENT_NAME));
    } catch (error) {
      console.error('Error al guardar favoritos en localStorage:', error);
    }
  };

  /**
   * Comprueba si un evento está guardado en favoritos según su ID.
   * @param {string|number} eventId - ID del evento a verificar.
   * @returns {boolean} true si está en favoritos, false en caso contrario.
   */
  const isFavorite = (eventId) => {
    return favorites.some(
      (item) => (typeof item === 'object' && item !== null ? item.id : item) === eventId
    );
  };

  return {
    favorites,
    toggleFavorite,
    isFavorite,
  };
}
