// api/sync-gcba.test.js
// Tests unitarios para las funciones puras del pipeline ETL GCBA → EvenGo.
// Corre con: npm test

import { describe, it, expect } from 'vitest';
import { classifyCategory, normalizeLocation } from './sync-gcba.js';

// ── classifyCategory ──────────────────────────────────────────────────────────

describe('classifyCategory', () => {
  it('clasifica eventos musicales por keyword directo', () => {
    expect(classifyCategory('Concierto de Tango en el Obelisco')).toBe('Musical');
  });

  it('clasifica eventos deportivos por keyword', () => {
    expect(classifyCategory('Maratón Solidaria de la Ciudad')).toBe('Deportivo');
  });

  it('clasifica eventos gastronómicos por keyword', () => {
    expect(classifyCategory('Feria de food trucks en Palermo')).toBe('Gastronomía');
  });

  it('usa "Cultural" como categoría por defecto cuando no hay coincidencia', () => {
    expect(classifyCategory('Exposición de arte contemporáneo en galería')).toBe('Cultural');
  });

  it('normaliza tildes correctamente: "musica" coincide con regla "música"', () => {
    expect(classifyCategory('Festival de musica en vivo')).toBe('Musical');
  });

  it('es case-insensitive (mayúsculas en el input)', () => {
    expect(classifyCategory('RECITAL DE ROCK NACIONAL')).toBe('Musical');
  });

  it('maneja input null/undefined sin lanzar error', () => {
    expect(() => classifyCategory(null)).not.toThrow();
    expect(classifyCategory(null)).toBe('Cultural');
  });

  it('maneja string vacío devolviendo el default Cultural', () => {
    expect(classifyCategory('')).toBe('Cultural');
  });

  it('clasifica torneo como Deportivo', () => {
    expect(classifyCategory('Torneo de Ajedrez Abierto de la Ciudad')).toBe('Deportivo');
  });

  it('clasifica jazz como Musical', () => {
    expect(classifyCategory('Festival de Jazz en La Boca')).toBe('Musical');
  });
});

// ── normalizeLocation ─────────────────────────────────────────────────────────

describe('normalizeLocation', () => {
  it('mapea "Palermo" exacto al barrio Palermo', () => {
    expect(normalizeLocation('Palermo')).toBe('Palermo');
  });

  it('mapea variantes de Palermo (Palermo Hollywood)', () => {
    expect(normalizeLocation('Palermo Hollywood')).toBe('Palermo');
  });

  it('mapea "San Telmo" al barrio San Telmo', () => {
    expect(normalizeLocation('San Telmo')).toBe('San Telmo');
  });

  it('mapea "Obelisco / Centro" usando substring "obelisco"', () => {
    expect(normalizeLocation('Obelisco / Centro')).toBe('Obelisco / Centro');
  });

  it('mapea "La Boca" al barrio La Boca', () => {
    expect(normalizeLocation('La Boca')).toBe('La Boca');
  });

  it('mapea "Belgrano" al barrio Belgrano', () => {
    expect(normalizeLocation('Belgrano')).toBe('Belgrano');
  });

  it('retorna el barrio original si no hay match en el mapa', () => {
    expect(normalizeLocation('Villa Devoto')).toBe('Villa Devoto');
  });

  it('retorna "Buenos Aires" como default cuando el barrio viene vacío', () => {
    expect(normalizeLocation('')).toBe('Buenos Aires');
  });

  it('retorna "Buenos Aires" cuando barrio es null/undefined', () => {
    expect(normalizeLocation(null)).toBe('Buenos Aires');
    expect(normalizeLocation(undefined)).toBe('Buenos Aires');
  });

  it('es case-insensitive en la comparación de barrios', () => {
    expect(normalizeLocation('PALERMO')).toBe('Palermo');
    expect(normalizeLocation('san telmo')).toBe('San Telmo');
  });
});
