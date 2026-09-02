import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';

/**
 * ChatBot: Asistente Virtual Conversacional & Concierge Ejecutivo de EvenGo.
 * Soporta itinerarios autónomos (plan_itinerary), clima, guardado de favoritos y descargas .ics.
 */
export default function ChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        '¡Hola! 👋 Soy el Concierge Ejecutivo de **EvenGo**. Puedo planificar itinerarios completos en Buenos Aires, verificar el clima, sugerir transporte y agendar eventos en tu calendario.',
    },
  ]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen]);

  /**
   * Manejador de selección de evento recomendado:
   * 1. Cierra automáticamente la ventana flotante del chat para despejar la vista.
   * 2. Desplaza suavemente hacia la tarjeta correspondiente en la grilla y aplica feedback visual destacado.
   */
  const handleEventSelect = useCallback((anchorLink) => {
    if (!anchorLink) return;

    // 1. Cerrar automáticamente la ventana flotante del chat
    setIsOpen(false);

    // 2. Navegación y scroll suave hacia la tarjeta del evento en la agenda
    const executeScroll = () => {
      const element = document.querySelector(anchorLink);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const highlightClasses = [
          'ring-4',
          'ring-pink-500',
          'bg-indigo-900/40',
          'scale-[1.03]',
          'shadow-[0_0_40px_rgba(236,72,153,0.4)]',
          'z-10',
        ];
        element.classList.add(...highlightClasses);
        setTimeout(() => {
          element.classList.remove(...highlightClasses);
        }, 3000);
      }
    };

    // Ejecuta de inmediato
    executeScroll();

    // Re-ejecuta tras el cierre del modal para garantizar centrado si hubo reajuste de layout
    setTimeout(executeScroll, 120);
  }, []);

  // Componentes de estilizado Markdown conectados con el cierre y navegación del chat
  const markdownComponents = useMemo(
    () => ({
      p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
      ul: ({ children }) => <ul className="list-disc ml-4 mb-1.5 space-y-0.5">{children}</ul>,
      ol: ({ children }) => <ol className="list-decimal ml-4 mb-1.5 space-y-0.5">{children}</ol>,
      li: ({ children }) => <li className="mb-0.5">{children}</li>,
      strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
      h3: ({ children }) => <h3 className="text-sm font-bold text-white mt-2 mb-1">{children}</h3>,
      h4: ({ children }) => <h4 className="text-[13px] font-bold text-white mt-1.5 mb-0.5">{children}</h4>,
      a: ({ href, children }) => {
        const isAnchor = href?.startsWith('#');

        const handleClick = (e) => {
          if (isAnchor) {
            e.preventDefault();
            handleEventSelect(href);
          }
        };

        return (
          <a
            href={isAnchor ? href : undefined}
            onClick={handleClick}
            target={isAnchor ? '_self' : undefined}
            rel={isAnchor ? undefined : 'noopener noreferrer'}
            className="text-indigo-300 underline font-semibold hover:text-indigo-200 cursor-pointer inline-flex items-center gap-0.5"
          >
            {children}
            <span className="text-[10px]">{isAnchor ? '📍' : '🔗'}</span>
          </a>
        );
      },
    }),
    [handleEventSelect]
  );

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    const userMessage = { role: 'user', content: query.trim() };
    const updatedHistory = [...messages, userMessage];

    // 1. Agrega el mensaje del usuario + un mensaje vacío del asistente con flag loading
    //    que iremos llenando token a token.
    setMessages([
      ...updatedHistory,
      {
        role: 'assistant',
        content: '',
        loading: true,
        toolCalls: [],
        actions: { favorites: [], invites: [], itineraries: [] },
      },
    ]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedHistory }),
      });

      if (!response.ok) {
        // Si el servidor rechaza antes de abrir el stream (400/405/500)
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.detail || `HTTP ${response.status}`);
      }

      // 2. Obtenemos el lector del ReadableStream SSE
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let sseBuffer = '';

      const processPart = (part) => {
        const line = part.trim();
        if (!line.startsWith('data:')) return;

        const raw = line.slice(5).trim();
        let payload;
        try {
          payload = JSON.parse(raw);
        } catch {
          return; // ignorar líneas malformadas
        }

        if (payload.text) {
          // 4. Concatenamos el fragmento al último mensaje y liberamos el estado loading
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = {
              ...last,
              loading: false,
              content: (last.content || '') + payload.text,
            };
            return next;
          });
        }

        if (payload.done) {
          // 5. Evento de cierre: aplicamos toolCalls y actions de una sola vez
          const { toolCalls = [], actions = { favorites: [], invites: [], itineraries: [] } } = payload;

          // ── Persistencia Automática de Favoritos en localStorage ─────────
          if (actions.favorites?.length > 0) {
            try {
              const rawStored = localStorage.getItem('evengo_favorites');
              const storedFavorites = rawStored ? JSON.parse(rawStored) : [];
              let hasChanges = false;
              actions.favorites.forEach((fav) => {
                const exists = storedFavorites.some(
                  (item) => (typeof item === 'object' && item !== null ? item.id : item) === fav.id
                );
                if (!exists) {
                  storedFavorites.unshift(fav);
                  hasChanges = true;
                }
              });
              if (hasChanges) {
                localStorage.setItem('evengo_favorites', JSON.stringify(storedFavorites));
                window.dispatchEvent(new Event('favoritesUpdated'));
              }
            } catch (e) {
              console.error('[ChatBot] Error guardando favoritos en localStorage:', e);
            }
          }

          // Enriquecemos el último mensaje con los metadatos del cierre y aseguramos loading: false
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, loading: false, toolCalls, actions };
            return next;
          });
        }
      };

      // 3. Bucle de lectura de chunks
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });

        // Normalizamos saltos de línea Windows CRLF y dividimos por \n\n
        const parts = sseBuffer.split(/\r?\n\r?\n/);

        // La última parte puede estar incompleta → la retenemos en el buffer
        sseBuffer = parts.pop() || '';

        for (const part of parts) {
          processPart(part);
        }
      }

      // Procesar cualquier residuo que haya quedado en el buffer tras cerrar el stream
      if (sseBuffer.trim()) {
        const remainingParts = sseBuffer.split(/\r?\n\r?\n/);
        for (const part of remainingParts) {
          processPart(part);
        }
      }
    } catch (error) {
      console.error('[ChatBot] Error al comunicarse con /api/chat:', error);
      // Reemplaza el mensaje del asistente por el mensaje de error y desactiva loading
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: 'assistant',
          loading: false,
          content: `⚠️ Ocurrió un error al consultar con el Agente (${error.message}). Por favor, intenta nuevamente.`,
        };
        return next;
      });
    } finally {
      setIsLoading(false);
      setMessages((prev) => {
        const next = [...prev];
        if (next.length > 0 && next[next.length - 1].loading) {
          next[next.length - 1] = { ...next[next.length - 1], loading: false };
        }
        return next;
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const promptSuggestions = [
    '🗺️ Armame un plan para este sábado en Palermo',
    '🎭 Planifica una salida cultural con recital y cena',
    '🌧️ ¿Hay planes bajo techo si llueve hoy?',
  ];

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Ventana de Chat Modal */}
      {isOpen && (
        <div className="w-[90vw] sm:w-[370px] h-[500px] max-h-[82vh] mb-3 flex flex-col rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-3">
          {/* Header */}
          <div className="px-3.5 py-2.5 bg-slate-950/80 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-base shadow-md shadow-indigo-500/20">
                  ✨
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-slate-950 rounded-full" />
              </div>
              <div>
                <h3 className="text-white font-bold text-xs leading-tight flex items-center gap-1">
                  EvenGo Concierge
                  <span className="px-1.5 py-0.2 text-[9px] bg-purple-500/20 text-purple-300 rounded font-mono border border-purple-500/30">
                    Ejecutivo 3.0
                  </span>
                </h3>
                <p className="text-slate-400 text-[11px]">Agente Autónomo & Planificador</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white hover:bg-white/10 p-1 rounded-md transition-colors text-xs"
              aria-label="Cerrar chat"
            >
              ✕
            </button>
          </div>

          {/* Historial de Mensajes */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
            {messages.map((msg, index) => {
              const hasText = Boolean(typeof msg.content === 'string' ? msg.content.trim().length > 0 : msg.content);
              const hasItineraries = Boolean(msg.actions?.itineraries && msg.actions.itineraries.length > 0);
              const hasInvites = Boolean(msg.actions?.invites && msg.actions.invites.length > 0);
              const hasValidContent = hasText || hasItineraries || hasInvites;

              // Identificamos si este mensaje representa un estado de carga transitorio
              const isMessageLoading = Boolean(
                msg.loading ||
                (isLoading && index === messages.length - 1 && msg.role === 'assistant' && !hasValidContent)
              );

              // Si el mensaje es un estado de carga (loading / typing), se muestra exclusivamente
              // dentro de su propia burbuja unificada con los puntos animados, sin generar un nodo fantasma arriba.
              if (isMessageLoading) {
                return (
                  <div
                    key={index}
                    data-testid="loading-message-bubble"
                    className="flex flex-col items-start animate-in fade-in duration-200"
                  >
                    <div className="bg-slate-800 border border-white/10 text-slate-300 px-3 py-2 rounded-xl rounded-bl-xs flex items-center gap-1.5 shadow-md">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium ml-1">
                        Planificando itinerario y logística...
                      </span>
                    </div>
                    <span className="text-[9px] text-slate-500 mt-0.5 px-1">
                      EvenGo AI Agent
                    </span>
                  </div>
                );
              }

              // Si el mensaje no contiene texto ni componentes interactivos válidos,
              // nunca renderizamos el contenedor visual (evita la burbuja vacía y etiqueta de autor fantasma).
              if (!hasValidContent) {
                return null;
              }

              return (
                <div
                  key={index}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[90%] px-3 py-2 rounded-xl text-[13px] leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-xs shadow-md shadow-indigo-600/20'
                        : 'bg-slate-800 text-slate-200 border border-white/10 rounded-bl-xs shadow-md'
                    }`}
                  >
                    {hasText && (
                      msg.role === 'assistant' ? (
                        <ReactMarkdown components={markdownComponents}>
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                      )
                    )}

                    {/* Tarjetas de Itinerarios Ejecutados */}
                    {hasItineraries && (
                      <div className="mt-3 pt-2.5 border-t border-white/10 flex flex-col gap-2">
                        {msg.actions.itineraries.map((itin, idx) => (
                          <div
                            key={idx}
                            className="bg-slate-950/70 border border-indigo-500/30 rounded-xl p-2.5 text-xs text-slate-200 flex flex-col gap-1.5"
                          >
                            <div className="flex items-center justify-between font-bold text-white text-[12px]">
                              <span>🗺️ {itin.title}</span>
                              <span className="text-[10px] bg-indigo-500/30 text-indigo-200 px-1.5 py-0.5 rounded font-mono">
                                {itin.date}
                              </span>
                            </div>

                            {/* Badge de Clima */}
                            {itin.weather && (
                              <div className="text-[11px] text-slate-300 flex items-center gap-1.5 bg-slate-900/60 p-1.5 rounded-lg border border-white/5">
                                <span>{itin.weather.willRain ? '🌧️' : '☀️'}</span>
                                <span>
                                  Máx {itin.weather.tempMaxC}°C / Mín {itin.weather.tempMinC}°C
                                </span>
                                <span className="text-slate-400 text-[10px]">
                                  ({itin.weather.rainProbability}% prob. lluvia)
                                </span>
                              </div>
                            )}

                            {/* Evento Principal con botón de anchor interno */}
                            {itin.primaryEvent && (
                              <div className="flex items-center justify-between gap-2 bg-indigo-500/10 border border-indigo-500/20 p-1.5 rounded-lg">
                                <span
                                  onClick={itin.primaryEvent.anchorLink ? () => handleEventSelect(itin.primaryEvent.anchorLink) : undefined}
                                  className={`text-[11px] text-indigo-200 font-semibold truncate ${itin.primaryEvent.anchorLink ? 'cursor-pointer hover:underline' : ''}`}
                                >
                                  ⭐ {itin.primaryEvent.title}
                                </span>
                                {itin.primaryEvent.anchorLink && (
                                  <button
                                    onClick={() => handleEventSelect(itin.primaryEvent.anchorLink)}
                                    className="flex-shrink-0 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded-md font-semibold transition-colors whitespace-nowrap cursor-pointer"
                                  >
                                    📍 Ver en EvenGo
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Eventos Alternativos con botones internos */}
                            {itin.alternativeEvents?.length > 0 && (
                              <div className="space-y-1">
                                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Alternativas:</span>
                                {itin.alternativeEvents.map((ev, eIdx) => (
                                  <div key={eIdx} className="flex items-center justify-between gap-2">
                                    <span
                                      onClick={ev.anchorLink ? () => handleEventSelect(ev.anchorLink) : undefined}
                                      className={`text-[11px] text-slate-300 truncate ${ev.anchorLink ? 'cursor-pointer hover:underline' : ''}`}
                                    >
                                      {ev.title}
                                    </span>
                                    {ev.anchorLink && (
                                      <button
                                        onClick={() => handleEventSelect(ev.anchorLink)}
                                        className="flex-shrink-0 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-0.5 rounded-md font-semibold transition-colors whitespace-nowrap cursor-pointer"
                                      >
                                        📍 Ver
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {itin.timeline && (
                              <div className="space-y-1 my-1">
                                <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">
                                  Cronograma Sugerido:
                                </span>
                                {itin.timeline.map((step, sIdx) => (
                                  <div key={sIdx} className="flex items-start gap-1.5 text-[11px]">
                                    <span className="font-mono text-indigo-300 font-semibold w-10 flex-shrink-0">
                                      {step.time}
                                    </span>
                                    <span className="text-slate-300">{step.activity}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Consejo de vestimenta/logística */}
                            {itin.logistics?.clothingTip && (
                              <p className="text-[10px] italic text-slate-400 bg-white/5 p-1.5 rounded">
                                💡 {itin.logistics.clothingTip}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Acciones de Descarga de Calendario (.ics) */}
                    {hasInvites && (
                      <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-col gap-1.5">
                        <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                          📅 Pases de Calendario listos:
                        </span>
                        {msg.actions.invites.map((inv, idx) => (
                          <a
                            key={idx}
                            href={inv.downloadUrl}
                            download={inv.filename}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-[11px] font-semibold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                          >
                            📥 Descargar .ics: {inv.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-slate-500 mt-0.5 px-1">
                    {msg.role === 'user' ? 'Tú' : 'EvenGo AI Agent'}
                  </span>
                </div>
              );
            })}

            {/* Indicador de Carga Fallback (solo si no se está renderizando dentro de un mensaje en el historial) */}
            {isLoading && (messages.length === 0 || messages[messages.length - 1].role !== 'assistant') && (
              <div
                data-testid="loading-fallback-bubble"
                className="flex flex-col items-start animate-in fade-in duration-200"
              >
                <div className="bg-slate-800 border border-white/10 text-slate-300 px-3 py-2 rounded-xl rounded-bl-xs flex items-center gap-1.5 shadow-md">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium ml-1">Planificando itinerario y logística...</span>
                </div>
                <span className="text-[9px] text-slate-500 mt-0.5 px-1">
                  EvenGo AI Agent
                </span>
              </div>
            )}

            {/* Sugerencias Rápidas */}
            {messages.length === 1 && !isLoading && (
              <div className="pt-1">
                <p className="text-slate-500 text-[11px] mb-1.5 font-medium">Sugerencias del Concierge:</p>
                <div className="flex flex-col gap-1">
                  {promptSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(sug)}
                      className="text-left text-[11px] bg-white/5 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-200 border border-white/5 hover:border-indigo-500/30 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Formulario Input */}
          <div className="p-2.5 bg-slate-950/90 border-t border-white/10 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pide un plan, evento o sugerencia..."
              disabled={isLoading}
              className="flex-1 bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-[13px] rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isLoading}
              className="w-9 h-9 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all shadow-md shadow-indigo-500/20"
              aria-label="Enviar mensaje"
            >
              ➔
            </button>
          </div>
        </div>
      )}

      {/* Botón Flotante Principal */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group relative flex items-center justify-center p-3.5 rounded-full shadow-2xl transition-all duration-300 active:scale-95 ${
          isOpen
            ? 'bg-slate-800 text-slate-300 border border-white/20 hover:bg-slate-700'
            : 'bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-white shadow-indigo-500/30 hover:scale-105'
        }`}
        aria-label="Abrir asistente de IA"
      >
        {isOpen ? (
          <span className="text-lg font-bold">✕</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xl animate-pulse">✨</span>
            <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs font-semibold text-xs transition-all duration-300 ease-in-out">
              EvenGo Concierge
            </span>
          </div>
        )}

        {!isOpen && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500" />
          </span>
        )}
      </button>
    </div>
  );
}
