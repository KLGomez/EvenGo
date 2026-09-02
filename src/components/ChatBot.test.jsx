// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ChatBot from './ChatBot';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('ChatBot Component - UI States & Conditional Rendering', () => {
  let container = null;
  let root = null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    vi.restoreAllMocks();
  });

  it('abre la ventana de chat y muestra el mensaje de bienvenida inicial', async () => {
    await act(async () => {
      root.render(<ChatBot />);
    });

    const openButton = container.querySelector('button[aria-label="Abrir asistente de IA"]');
    expect(openButton).toBeTruthy();

    await act(async () => {
      openButton.click();
    });

    // Ventana abierta
    expect(container.textContent).toContain('EvenGo Concierge');
    expect(container.textContent).toContain('Soy el Concierge Ejecutivo de EvenGo');
  });

  it('muestra exclusivamente la burbuja unificada de carga sin nodo fantasma vacío encima al enviar un mensaje', async () => {
    let capturedController = null;

    // Mock fetch with delayed stream
    global.fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        body: new ReadableStream({
          start(controller) {
            capturedController = controller;
          },
        }),
      })
    );

    await act(async () => {
      root.render(<ChatBot />);
    });

    // Abrir chat
    const openBtn = container.querySelector('button[aria-label="Abrir asistente de IA"]');
    await act(async () => {
      openBtn.click();
    });

    // Escribir en el input
    const input = container.querySelector('input[type="text"]');
    const sendBtn = container.querySelector('button[aria-label="Enviar mensaje"]');

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeInputValueSetter.call(input, 'Armame un plan para el sábado');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Enviar mensaje
    await act(async () => {
      sendBtn.click();
    });

    // Verificar que el mensaje del usuario está presente
    expect(container.textContent).toContain('Armame un plan para el sábado');

    // Debe existir exactamente UNA burbuja de carga unificada
    const loadingBubbles = container.querySelectorAll('[data-testid="loading-message-bubble"]');
    expect(loadingBubbles.length).toBe(1);
    expect(loadingBubbles[0].textContent).toContain('Planificando itinerario y logística...');
    expect(loadingBubbles[0].textContent).toContain('EvenGo AI Agent');

    // NO debe existir ningún indicador fallback duplicado
    const fallbackBubbles = container.querySelectorAll('[data-testid="loading-fallback-bubble"]');
    expect(fallbackBubbles.length).toBe(0);

    // Verificar que los contenedores de mensaje con etiqueta de autor no estén vacíos ni sean fantasmas
    const authorLabels = container.querySelectorAll('span.text-\\[9px\\]');
    expect(authorLabels.length).toBeGreaterThanOrEqual(2); // Al menos bienvenida + usuario + loading
    for (const label of authorLabels) {
      const parent = label.parentElement;
      // No debe ser solo 'EvenGo AI Agent' sin contenido o sin loading
      expect(parent.textContent.trim()).not.toBe('EvenGo AI Agent');
    }

    // Completar el stream para limpiar
    if (capturedController) {
      await act(async () => {
        const encoder = new TextEncoder();
        capturedController.enqueue(
          encoder.encode('data: {"text":"¡Hola! Aquí está tu plan."}\n\ndata: {"done":true,"toolCalls":[],"actions":{}}\n\n')
        );
        capturedController.close();
      });
    }
  });

  it('reemplaza la burbuja de carga por el contenido del asistente cuando llegan los tokens', async () => {
    const encoder = new TextEncoder();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"text":"¡Hola! Aquí está tu itinerario."}\n\n'));
          controller.enqueue(encoder.encode('data: {"done":true,"toolCalls":[],"actions":{"favorites":[],"invites":[],"itineraries":[]}}\n\n'));
          controller.close();
        },
      }),
    });

    await act(async () => {
      root.render(<ChatBot />);
    });

    // Abrir chat
    const openBtn = container.querySelector('button[aria-label="Abrir asistente de IA"]');
    await act(async () => {
      openBtn.click();
    });

    const input = container.querySelector('input[type="text"]');
    const sendBtn = container.querySelector('button[aria-label="Enviar mensaje"]');

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeInputValueSetter.call(input, 'Sugerime eventos');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      sendBtn.click();
    });

    // Una vez resuelto el stream, la burbuja de carga desaparece y el texto está visible
    expect(container.querySelector('[data-testid="loading-message-bubble"]')).toBeNull();
    expect(container.textContent).toContain('¡Hola! Aquí está tu itinerario.');
  });

  it('maneja errores de red mostrando el mensaje de error en la burbuja sin nodo fantasma', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Fallo de conexión'));

    await act(async () => {
      root.render(<ChatBot />);
    });

    const openBtn = container.querySelector('button[aria-label="Abrir asistente de IA"]');
    await act(async () => {
      openBtn.click();
    });

    const input = container.querySelector('input[type="text"]');
    const sendBtn = container.querySelector('button[aria-label="Enviar mensaje"]');

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeInputValueSetter.call(input, 'Hola');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      sendBtn.click();
    });

    // El indicador de carga ya no debe estar
    expect(container.querySelector('[data-testid="loading-message-bubble"]')).toBeNull();
    // Debe mostrar el mensaje de error formateado
    expect(container.textContent).toContain('⚠️ Ocurrió un error al consultar con el Agente (Fallo de conexión)');
    // No debe haber nodos vacíos
    const authorLabels = container.querySelectorAll('span.text-\\[9px\\]');
    for (const label of authorLabels) {
      expect(label.parentElement.textContent.trim()).not.toBe('EvenGo AI Agent');
    }
  });

  it('renderiza tarjetas de itinerario cuando el payload done incluye itineraries', async () => {
    const encoder = new TextEncoder();
    const mockItinerary = {
      title: 'Salida Palermo Sábado',
      date: '2026-09-05',
      weather: { willRain: false, tempMaxC: 22, tempMinC: 14, rainProbability: 10 },
      primaryEvent: { title: 'Jazz en el Parque', anchorLink: '#event-1' },
      timeline: [{ time: '19:00', activity: 'Encuentro en Palermo' }],
      logistics: { clothingTip: 'Llevar abrigo liviano' },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"text":"¡Aquí está tu itinerario detallado!"}\n\n'));
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                toolCalls: [],
                actions: { favorites: [], invites: [], itineraries: [mockItinerary] },
              })}\n\n`
            )
          );
          controller.close();
        },
      }),
    });

    await act(async () => {
      root.render(<ChatBot />);
    });

    const openBtn = container.querySelector('button[aria-label="Abrir asistente de IA"]');
    await act(async () => {
      openBtn.click();
    });

    const input = container.querySelector('input[type="text"]');
    const sendBtn = container.querySelector('button[aria-label="Enviar mensaje"]');

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeInputValueSetter.call(input, 'Itinerario');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      sendBtn.click();
    });

    expect(container.textContent).toContain('Salida Palermo Sábado');
    expect(container.textContent).toContain('Jazz en el Parque');
    expect(container.textContent).toContain('Llevar abrigo liviano');
    expect(container.querySelector('[data-testid="loading-message-bubble"]')).toBeNull();
  });

  it('cierra automáticamente el chat y hace scroll suave al hacer clic en un enlace de evento Markdown', async () => {
    // Creamos en el DOM un elemento simulando la tarjeta de evento en la grilla
    const eventCard = document.createElement('div');
    eventCard.id = 'event-42';
    eventCard.textContent = 'Recital en Vivo Palermo';
    document.body.appendChild(eventCard);

    const encoder = new TextEncoder();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode('data: {"text":"Te recomiendo este show: [Recital en Vivo Palermo](#event-42) en el parque."}\n\n')
          );
          controller.enqueue(
            encoder.encode('data: {"done":true,"toolCalls":[],"actions":{}}\n\n')
          );
          controller.close();
        },
      }),
    });

    await act(async () => {
      root.render(<ChatBot />);
    });

    // Abrir chat
    const openBtn = container.querySelector('button[aria-label="Abrir asistente de IA"]');
    await act(async () => {
      openBtn.click();
    });

    // Enviar consulta
    const input = container.querySelector('input[type="text"]');
    const sendBtn = container.querySelector('button[aria-label="Enviar mensaje"]');

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeInputValueSetter.call(input, 'recital');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      sendBtn.click();
    });

    // Verificamos que el enlace Markdown con anchor está en el chat
    const eventLink = container.querySelector('a[href="#event-42"]');
    expect(eventLink).toBeTruthy();

    // Verificamos que el chat modal está abierto antes del clic
    expect(container.querySelector('input[placeholder="Pide un plan, evento o sugerencia..."]')).toBeTruthy();

    // Hacemos clic en el enlace recomendado
    await act(async () => {
      eventLink.click();
    });

    // 1. El chat debe haberse cerrado automáticamente
    expect(container.querySelector('input[placeholder="Pide un plan, evento o sugerencia..."]')).toBeNull();

    // 2. scrollIntoView debe haberse invocado sobre la tarjeta del evento
    expect(eventCard.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });

    // 3. Debe haberse aplicado el feedback visual destacado
    expect(eventCard.classList.contains('ring-4')).toBe(true);
    expect(eventCard.classList.contains('ring-pink-500')).toBe(true);

    eventCard.remove();
  });

  it('cierra automáticamente el chat y hace scroll suave al hacer clic en el botón de itinerario "Ver en EvenGo"', async () => {
    const primaryEventCard = document.createElement('div');
    primaryEventCard.id = 'event-101';
    primaryEventCard.textContent = 'Feria del Libro';
    document.body.appendChild(primaryEventCard);

    const encoder = new TextEncoder();
    const mockItinerary = {
      title: 'Plan Cultural',
      date: '2026-09-06',
      primaryEvent: { title: 'Feria del Libro', anchorLink: '#event-101' },
      alternativeEvents: [{ title: 'Café Literario', anchorLink: '#event-102' }],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"text":"Tu plan cultural:"}\n\n'));
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                toolCalls: [],
                actions: { favorites: [], invites: [], itineraries: [mockItinerary] },
              })}\n\n`
            )
          );
          controller.close();
        },
      }),
    });

    await act(async () => {
      root.render(<ChatBot />);
    });

    // Abrir chat
    const openBtn = container.querySelector('button[aria-label="Abrir asistente de IA"]');
    await act(async () => {
      openBtn.click();
    });

    const input = container.querySelector('input[type="text"]');
    const sendBtn = container.querySelector('button[aria-label="Enviar mensaje"]');

    await act(async () => {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      ).set;
      nativeInputValueSetter.call(input, 'cultura');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await act(async () => {
      sendBtn.click();
    });

    // Buscamos el botón '📍 Ver en EvenGo'
    const viewButton = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent.includes('Ver en EvenGo')
    );
    expect(viewButton).toBeTruthy();

    // Hacemos clic en el botón del evento principal
    await act(async () => {
      viewButton.click();
    });

    // 1. El chat debe cerrarse automáticamente
    expect(container.querySelector('input[placeholder="Pide un plan, evento o sugerencia..."]')).toBeNull();

    // 2. scrollIntoView invocado en la tarjeta del evento
    expect(primaryEventCard.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(primaryEventCard.classList.contains('ring-pink-500')).toBe(true);

    primaryEventCard.remove();
  });
});

