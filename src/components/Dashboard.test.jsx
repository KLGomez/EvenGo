// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventContext } from '../context/EventContext';
import { Dashboard } from './Dashboard';
import * as exportUtils from '../utils/exportToCSV';

// Mock de fetch para el Weather widget
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

describe('Dashboard Component - Executive PDF & CSV Export', () => {
  let container = null;
  let root = null;

  const mockEvents = [
    {
      id: 1,
      title: 'Festival de Tango',
      address: 'San Telmo',
      category: 'Música',
      isFree: true,
      date: '2026-09-05',
    },
    {
      id: 2,
      title: 'Obra de Teatro Clásico',
      address: 'Palermo',
      category: 'Teatro',
      isFree: false,
      date: '2026-09-06',
    },
  ];

  const mockContextValue = {
    events: mockEvents,
    loading: false,
    error: null,
    usingMocks: false,
    retry: vi.fn(),
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
  });

  const renderDashboard = async (contextValue = mockContextValue) => {
    await act(async () => {
      root.render(
        <MemoryRouter>
          <EventContext.Provider value={contextValue}>
            <Dashboard />
          </EventContext.Provider>
        </MemoryRouter>
      );
    });
  };

  it('renders the Executive Print Header with date and title', async () => {
    await renderDashboard();

    const executiveHeader = container.querySelector('header.hidden.print\\:block');
    expect(executiveHeader).not.toBeNull();
    expect(executiveHeader.textContent).toContain('Radar Cultural');
    expect(executiveHeader.textContent).toContain('Reporte Ejecutivo');
    expect(executiveHeader.textContent).toContain('02/09/2026');
    expect(executiveHeader.textContent).toContain('EvenGo');
  });

  it('renders the Executive Print Footer with EvenGo Buenos Aires branding', async () => {
    await renderDashboard();

    const printFooter = container.querySelector('footer.hidden.print\\:flex');
    expect(printFooter).not.toBeNull();
    expect(printFooter.textContent).toContain('EvenGo Buenos Aires');
    expect(printFooter.textContent).toContain('02/09/2026');
  });

  it('renders the export button dropdown trigger', async () => {
    await renderDashboard();

    const exportBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent.includes('Exportar')
    );
    expect(exportBtn).toBeTruthy();
    expect(exportBtn.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('opens dropdown menu and displays PDF and CSV options when clicked', async () => {
    await renderDashboard();

    const exportBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent.includes('Exportar')
    );

    // Initial state: menu closed
    expect(container.querySelector('[role="menu"]')).toBeNull();

    // Open dropdown
    await act(async () => {
      exportBtn.click();
    });

    const menu = container.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(menu.textContent).toContain('Descargar Reporte PDF');
    expect(menu.textContent).toContain('Exportar CSV');
  });

  it('triggers downloadCSV when Exportar CSV is selected', async () => {
    const downloadCSVSpy = vi.spyOn(exportUtils, 'downloadCSV').mockImplementation(() => {});
    await renderDashboard();

    const exportBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent.includes('Exportar')
    );

    await act(async () => {
      exportBtn.click();
    });

    const csvOption = Array.from(container.querySelectorAll('button[role="menuitem"]')).find(
      (btn) => btn.textContent.includes('Exportar CSV')
    );

    await act(async () => {
      csvOption.click();
    });

    expect(downloadCSVSpy).toHaveBeenCalledWith(mockEvents, 'evengo-radar-cultural.csv');
    // Dropdown should be closed after selection
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('triggers window.print when Descargar Reporte PDF is selected', async () => {
    vi.useFakeTimers();
    const printSpy = vi.fn();
    window.print = printSpy;

    await renderDashboard();

    const exportBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent.includes('Exportar')
    );

    await act(async () => {
      exportBtn.click();
    });

    const pdfOption = Array.from(container.querySelectorAll('button[role="menuitem"]')).find(
      (btn) => btn.textContent.includes('Descargar Reporte PDF')
    );

    await act(async () => {
      pdfOption.click();
    });

    // Dropdown closes immediately
    expect(container.querySelector('[role="menu"]')).toBeNull();

    // Fast-forward timeout for window.print
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(printSpy).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('closes dropdown when clicking outside or pressing Escape', async () => {
    await renderDashboard();

    const exportBtn = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent.includes('Exportar')
    );

    // Open dropdown
    await act(async () => {
      exportBtn.click();
    });
    expect(container.querySelector('[role="menu"]')).not.toBeNull();

    // Press Escape
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();

    // Reopen and click outside
    await act(async () => {
      exportBtn.click();
    });
    expect(container.querySelector('[role="menu"]')).not.toBeNull();

    await act(async () => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(container.querySelector('[role="menu"]')).toBeNull();
  });
});
