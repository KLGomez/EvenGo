import React, { useState, useEffect } from 'react';

/**
 * Componente ScrollToTop
 * Botón flotante centrado en formato pastilla ("Volver arriba ↑")
 * Aparece cuando el usuario hace scroll hacia abajo (> 300px) y desplaza suavemente al inicio.
 */
export default function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!isVisible) {
    return null;
  }

  return (
    <button
      onClick={scrollToTop}
      id="scroll-to-top-btn"
      aria-label="Volver arriba"
      className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40
        flex items-center gap-2 px-5 py-2.5 rounded-full
        bg-slate-800/90 backdrop-blur-md border border-white/10 shadow-2xl
        hover:bg-slate-700 hover:-translate-y-1 transition-all duration-300 group
        active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
    >
      <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors">
        Volver arriba
      </span>
      <span className="text-lg text-indigo-400 group-hover:text-indigo-300 transition-colors group-hover:-translate-y-0.5 transform duration-300">
        ↑
      </span>
    </button>
  );
}
