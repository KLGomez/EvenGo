import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useEventContext } from '../hooks/useEventContext';

/**
 * Componentes de estilizado Tailwind para ReactMarkdown (Edición Compacta UI/UX)
 */
const markdownComponents = {
  p: ({ children }) => <p className="mb-1.5 last:mb-0 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc ml-4 mb-1.5 space-y-0.5">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal ml-4 mb-1.5 space-y-0.5">{children}</ol>,
  li: ({ children }) => <li className="mb-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
  h3: ({ children }) => <h3 className="text-sm font-bold text-white mt-2 mb-1">{children}</h3>,
  h4: ({ children }) => <h4 className="text-[13px] font-bold text-white mt-1.5 mb-0.5">{children}</h4>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-300 underline hover:text-indigo-200 transition-colors"
    >
      {children}
    </a>
  ),
};

/**
 * ChatBot: Asistente Virtual Flotante de EvenGo con Google Gemini (Diseño Compacto & Responsivo)
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
      text: '¡Hola! 👋 Soy el asistente virtual de **EvenGo**. ¿Buscas algún plan cultural en Buenos Aires? Dime qué te gustaría hacer y te recomendaré las mejores opciones.',
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

  const handleSendMessage = async (textToSend) => {
    const query = textToSend || input;
    if (!query.trim() || isLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Optimización de Contexto: Recorte a máximo 20 eventos y selección de campos esenciales
      const contextData = (filteredEvents || []).slice(0, 20).map((event) => ({
        title: event.title,
        category: event.category,
        location: event.location,
        address: event.address || '',
        date: event.date,
        time: event.time || '',
        description: event.description || '',
      }));

      // Petición POST a la Serverless Function /api/chat
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
        text: data.reply || 'No pude generar una respuesta adecuada en este momento.',
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error('[ChatBot] Error al comunicarse con /api/chat:', error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: `⚠️ Ocurrió un error al consultar con la IA (${error.message}). Por favor, intenta nuevamente más tarde.`,
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

  const promptSuggestions = [
    '¿Qué eventos hay este fin de semana?',
    'Recomiéndame un concierto en Palermo',
    '¿Hay opciones culturales gratuitas?',
  ];

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end">
      {/* Ventana de Chat Modal (Versión Compacta & Responsiva) */}
      {isOpen && (
        <div className="w-[90vw] sm:w-[340px] h-[450px] max-h-[75vh] mb-3 flex flex-col rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden transition-all duration-300 animate-in fade-in slide-in-from-bottom-3">
          {/* Header Compacto */}
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
                  EvenGo AI
                  <span className="px-1 py-0.2 text-[9px] bg-indigo-500/20 text-indigo-300 rounded font-mono border border-indigo-500/30">
                    Gemini
                  </span>
                </h3>
                <p className="text-slate-400 text-[11px]">Asistente de Eventos en BA</p>
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
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.sender === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[88%] px-3 py-2 rounded-xl text-[13px] leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-xs shadow-md shadow-indigo-600/20'
                      : 'bg-slate-800 text-slate-200 border border-white/10 rounded-bl-xs shadow-md'
                  }`}
                >
                  {msg.sender === 'bot' ? (
                    <ReactMarkdown components={markdownComponents}>
                      {msg.text}
                    </ReactMarkdown>
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.text}</span>
                  )}
                </div>
                <span className="text-[9px] text-slate-500 mt-0.5 px-1">
                  {msg.sender === 'user' ? 'Tú' : 'EvenGo AI'}
                </span>
              </div>
            ))}

            {/* Indicador de Carga */}
            {isLoading && (
              <div className="flex flex-col items-start">
                <div className="bg-slate-800 border border-white/10 text-slate-300 px-3 py-2 rounded-xl rounded-bl-xs flex items-center gap-1.5">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium ml-1">Consultando agenda...</span>
                </div>
              </div>
            )}

            {/* Sugerencias Rápidas */}
            {messages.length === 1 && !isLoading && (
              <div className="pt-1">
                <p className="text-slate-500 text-[11px] mb-1.5 font-medium">Sugerencias rápidas:</p>
                <div className="flex flex-col gap-1">
                  {promptSuggestions.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(sug)}
                      className="text-left text-[11px] bg-white/5 hover:bg-indigo-500/20 text-slate-300 hover:text-indigo-200 border border-white/5 hover:border-indigo-500/30 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      💡 {sug}
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
              placeholder="Pregunta sobre eventos en BA..."
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
              Asistente AI
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
