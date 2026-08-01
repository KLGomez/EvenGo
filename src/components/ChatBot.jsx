import React, { useState, useRef, useEffect } from 'react';
import { useEventContext } from '../hooks/useEventContext';

/**
 * ChatBot: Asistente Virtual Flotante de EvenGo con Google Gemini
 * 
 * Ofrece recomendaciones culturales personalizadas basadas en los eventos filtrados
 * en la interfaz del usuario, enviando un payload optimizado a la Serverless Function /api/chat.
 */
export default function ChatBot() {
  const { filteredEvents } = useEventContext();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: '¡Hola! 👋 Soy el asistente virtual de EvenGo. ¿Buscas algún plan cultural en Buenos Aires? Dime qué te gustaría hacer y te ayudaré a encontrar los mejores eventos.',
    },
  ]);

  const messagesEndRef = useRef(null);

  // Auto-scroll al recibir o enviar un nuevo mensaje
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen]);

  // Manejador del envío de mensaje
  const handleSendMessage = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query.trim(),
    };

    // Actualizar historial local con el mensaje del usuario
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // ── Optimización de Contexto ─────────────────────────────────────────
      // Mapear filteredEvents para enviar solo campos esenciales recortado a un máximo de 20
      const contextData = (filteredEvents || []).slice(0, 20).map((event) => ({
        title: event.title,
        category: event.category,
        location: event.location,
        address: event.address || '',
        date: event.date,
        time: event.time || '',
        description: event.description || '',
      }));

      // Llamada POST a la Vercel Serverless Function /api/chat
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query.trim(),
          contextData,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.detail || 'Error en la respuesta del servidor');
      }

      const botMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: data.reply || 'No pude obtener una respuesta adecuada en este momento.',
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('[ChatBot] Error al consultar /api/chat:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: `⚠️ Lo siento, ocurrió un inconveniente al consultar con el asistente (${error.message}). Por favor, verifica la API Key o intenta nuevamente más tarde.`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Sugerencias rápidas para el usuario
  const promptSuggestions = [
    '¿Qué eventos hay este fin de semana?',
    'Recomiéndame un concierto en Palermo',
    '¿Hay opciones culturales gratuitas?',
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* ── Ventana del Chat (Modal estilo Tarjeta) ────────────────────────── */}
      {isOpen && (
        <div
          className="w-[90vw] sm:w-96 h-[520px] mb-4 flex flex-col rounded-2xl
            bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl
            overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
        >
          {/* Header del Chat */}
          <div className="px-4 py-3.5 bg-slate-950/80 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-lg shadow-md shadow-indigo-500/20">
                  ✨
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm leading-tight flex items-center gap-1.5">
                  EvenGo AI
                  <span className="px-1.5 py-0.2 text-[10px] bg-indigo-500/20 text-indigo-300 rounded-md font-mono font-medium border border-indigo-500/30">
                    Gemini 1.5
                  </span>
                </h3>
                <p className="text-slate-400 text-xs">Asistente de Eventos en BA</p>
              </div>
            </div>

            {/* Botón Cerrar */}
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors"
              aria-label="Cerrar chat"
            >
              ✕
            </button>
          </div>

          {/* Historial de Mensajes */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-xs shadow-md shadow-indigo-600/20'
                      : 'bg-slate-800 text-slate-200 border border-white/10 rounded-bl-xs shadow-md'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1">
                  {msg.sender === 'user' ? 'Tú' : 'EvenGo AI'}
                </span>
              </div>
            ))}

            {/* Indicador de Carga */}
            {isLoading && (
              <div className="flex flex-col items-start">
                <div className="bg-slate-800 border border-white/10 text-slate-300 px-4 py-3 rounded-2xl rounded-bl-xs flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-xs text-slate-400 font-medium ml-1">Consultando agenda...</span>
                </div>
              </div>
            )}

            {/* Sugerencias Rápidas al inicio */}
            {messages.length === 1 && !isLoading && (
              <div className="pt-2">
                <p className="text-slate-500 text-xs mb-2 font-medium">Sugerencias rápidas:</p>
                <div className="flex flex-col gap-1.5">
                  {promptSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(sug)}
                      className="text-left text-xs bg-white/5 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-200 border border-white/5 hover:border-indigo-500/30 px-3 py-2 rounded-xl transition-all"
                    >
                      💡 {sug}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Formulario de Entrada */}
          <div className="p-3 bg-slate-950/90 border-t border-white/10 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta sobre eventos en BA..."
              disabled={isLoading}
              className="flex-1 bg-slate-900 border border-white/10 text-white placeholder-slate-500 text-sm rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 transition-all"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all shadow-md shadow-indigo-500/20"
              aria-label="Enviar mensaje"
            >
              ➔
            </button>
          </div>
        </div>
      )}

      {/* ── Botón Flotante Principal ───────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group relative flex items-center justify-center p-4 rounded-full shadow-2xl transition-all duration-300 active:scale-95 ${
          isOpen
            ? 'bg-slate-800 text-slate-300 border border-white/20 hover:bg-slate-700'
            : 'bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500 text-white shadow-indigo-500/30 hover:scale-105'
        }`}
        aria-label="Abrir asistente de IA"
      >
        {isOpen ? (
          <span className="text-xl font-bold">✕</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-2xl animate-pulse">✨</span>
            <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs font-semibold text-sm transition-all duration-300 ease-in-out">
              Asistente AI
            </span>
          </div>
        )}

        {/* Notificación indicadora si está cerrado */}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-pink-500" />
          </span>
        )}
      </button>
    </div>
  );
}
