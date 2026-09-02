import React from 'react';
import useFavorites from '../hooks/useFavorites';
import { formatDate } from '../utils/calendarUtils';

/**
 * Panel Lateral Deslizable (Drawer) para visualizar y gestionar eventos guardados en Favoritos (Planner personal).
 * Soporta redirección al evento al hacer clic en la información de la mini-tarjeta.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Booleano que indica si el drawer está visible.
 * @param {Function} props.onClose - Función callback para cerrar el drawer.
 * @param {Array} [props.favorites] - Array opcional de eventos favoritos.
 * @param {Function} [props.onRemove] - Función opcional para eliminar un evento de favoritos.
 */
export default function FavoritesDrawer({ isOpen, onClose, favorites: favoritesProp, onRemove }) {
  const { favorites: favoritesHook, toggleFavorite } = useFavorites();

  const favorites = favoritesProp ?? favoritesHook;
  const handleRemove = onRemove ?? toggleFavorite;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 flex justify-end"
      onClick={onClose}
    >
      {/* Panel Lateral */}
      <aside
        onClick={(e) => e.stopPropagation()}
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-slate-900 border-l border-white/10 shadow-2xl p-6 transform transition-transform duration-300 overflow-y-auto z-50 flex flex-col gap-6 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header del Panel */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xl">❤️</span>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Mis Eventos Guardados
            </h2>
            {favorites.length > 0 && (
              <span className="ml-1.5 px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {favorites.length}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar panel"
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido del Panel */}
        <div className="flex-1 flex flex-col">
          {favorites.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-3xl">
                📌
              </div>
              <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-xs">
                Aún no guardaste ningún evento para tu ruta.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {favorites.map((event) => {
                const eventId = typeof event === 'object' && event !== null ? event.id : event;
                const title = typeof event === 'object' && event !== null ? event.title : `Evento #${eventId}`;
                const formattedDate = typeof event === 'object' && event?.date ? formatDate(event.date) : '';
                const time = typeof event === 'object' && event?.time ? `${event.time} hs` : '';
                const dateTime = [formattedDate, time].filter(Boolean).join(' • ');

                return (
                  <div
                    key={eventId}
                    className="flex items-center justify-between gap-3 p-4 rounded-xl bg-slate-800/50 border border-white/10 hover:border-white/20 transition-all group"
                  >
                    {/* Contenedor interactivo de información del evento con redirección */}
                    <div
                      onClick={() => {
                        if (typeof onClose === 'function') {
                          onClose();
                        }
                        const el =
                          document.getElementById(`event-${eventId}`) ||
                          document.getElementById(String(eventId));
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          const cls = [
                            'ring-4',
                            'ring-pink-500',
                            'bg-indigo-900/40',
                            'scale-[1.03]',
                            'shadow-[0_0_40px_rgba(236,72,153,0.4)]',
                            'z-10',
                          ];
                          el.classList.add(...cls);
                          setTimeout(() => el.classList.remove(...cls), 3000);
                        } else {
                          const targetUrl =
                            typeof event === 'object' && event !== null
                              ? event.url || event.link
                              : null;
                          if (targetUrl) {
                            window.open(targetUrl, '_blank');
                          }
                        }
                      }}
                      className="flex flex-col gap-1 min-w-0 flex-1 cursor-pointer hover:bg-slate-700/30 transition-colors rounded-lg p-1 -ml-1"
                    >
                      <h4 className="text-white text-sm font-semibold truncate leading-snug group-hover:text-indigo-300 transition-colors">
                        {title}
                      </h4>
                      {dateTime && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5">
                          <span>📅</span>
                          <span className="capitalize truncate">{dateTime}</span>
                        </p>
                      )}
                    </div>

                    {/* Botón de eliminación (con stopPropagation) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(event);
                      }}
                      title="Eliminar de favoritos"
                      aria-label={`Eliminar ${title} de favoritos`}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 active:scale-95 transition-all flex-shrink-0"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
