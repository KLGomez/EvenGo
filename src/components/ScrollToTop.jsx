import React, { useState, useEffect } from 'react';

/**
 * Componente ScrollToTop
 * Botón flotante en la esquina inferior izquierda que aparece al hacer scroll hacia abajo (> 300px)
 * y desplaza la página suavemente hasta el inicio al hacer clic.
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

    // Limpieza del event listener al desmontar el componente
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
      className="fixed bottom-5 left-5 z-40 p-3 rounded-full
        bg-slate-800/80 backdrop-blur-md border border-white/10 text-slate-300
        hover:bg-slate-700 hover:text-white hover:border-white/20
        shadow-lg shadow-black/30 transition-all duration-300 ease-in-out
        active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-5 h-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 10l7-7m0 0l7 7m-7-7v18"
        />
      </svg>
    </button>
  );
}
