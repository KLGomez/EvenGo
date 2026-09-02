// @vitest-environment jsdom
// src/components/WeatherOpportunityWidget.test.jsx
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WeatherOpportunityWidget } from './WeatherOpportunityWidget';

describe('WeatherOpportunityWidget Component', () => {
  let container = null;
  let root = null;

  const mockEvents = [
    { id: 1, title: 'Rock en el Parque', address: 'Parque Centenario', category: 'Musical' },
    { id: 2, title: 'Feria Gastronómica', address: 'Plaza Dorrego', category: 'Gastronomía' },
    { id: 3, title: 'Ciclo de Cine', address: 'Cine Arte Palermo', category: 'Cultural' },
    { id: 4, title: 'Torneo Ajedrez', address: 'Club Belgrano', category: 'Cultural' },
  ];

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Mock fetchBuenosAiresWeather global fetch to avoid real network call in tests
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 22,
          apparent_temperature: 23,
          precipitation: 0,
          weather_code: 0,
          wind_speed_10m: 10,
          relative_humidity_2m: 55,
        },
        hourly: {
          precipitation_probability: new Array(24).fill(5),
        },
      }),
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
    vi.restoreAllMocks();
  });

  it('se monta y muestra el título principal del widget', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <WeatherOpportunityWidget events={mockEvents} />
        </MemoryRouter>
      );
    });

    expect(container.textContent).toContain('Índice de Clima y Oportunidad');
    expect(container.textContent).toContain('Pronóstico en Buenos Aires & Recomendaciones');
  });

  it('permite cambiar a modo simulación de lluvia y actualiza el badge a refugio cultural', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <WeatherOpportunityWidget events={mockEvents} />
        </MemoryRouter>
      );
    });

    // Buscar botón de simulación de lluvia
    const rainButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent.includes('Lluvia')
    );

    expect(rainButton).toBeDefined();

    await act(async () => {
      rainButton.click();
    });

    // Debe mostrar badge y textos para clima adverso / refugio cultural
    expect(container.textContent).toContain('Refugio Cultural');
    expect(container.textContent).toContain("Oportunidad: Explorar 'Planes Bajo Techo'");
    expect(container.textContent).toContain('Recomendados Bajo Techo');
  });

  it('permite cambiar a modo buen tiempo y destaca actividades al aire libre', async () => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <WeatherOpportunityWidget events={mockEvents} />
        </MemoryRouter>
      );
    });

    const clearButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent.includes('Buen tiempo')
    );

    expect(clearButton).toBeDefined();

    await act(async () => {
      clearButton.click();
    });

    expect(container.textContent).toContain('Aire Libre Óptimo');
    expect(container.textContent).toContain('Ventana Óptima para Salidas al Aire Libre');
    expect(container.textContent).toContain('Al Aire Libre');
  });
});
