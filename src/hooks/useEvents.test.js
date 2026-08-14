// src/hooks/useEvents.test.js
// Tests unitarios para isEventUpcoming — la función de lógica de fechas más crítica del proyecto.
// Usa vi.useFakeTimers() para fijar el tiempo y hacer los tests deterministas.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isEventUpcoming } from './useEvents.js';

// ── isEventUpcoming ───────────────────────────────────────────────────────────
//
// Sistema de referencia fijo: 2026-08-14 12:00:00 (mediodía del día de hoy)
// Todos los asserts razonan desde este punto en el tiempo.

describe('isEventUpcoming', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-14T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Casos básicos de fecha ─────────────────────────────────────────────────

  it('devuelve true para una fecha futura en formato YYYY-MM-DD', () => {
    expect(isEventUpcoming('2026-08-20', '19:00')).toBe(true);
  });

  it('devuelve false para una fecha claramente pasada', () => {
    expect(isEventUpcoming('2026-08-01', '19:00')).toBe(false);
  });

  it('devuelve true para hoy cuando el horario aún no pasó (19:00 > 12:00 actual)', () => {
    expect(isEventUpcoming('2026-08-14', '19:00')).toBe(true);
  });

  it('devuelve false para hoy cuando el horario ya pasó (08:00 < 12:00 actual)', () => {
    expect(isEventUpcoming('2026-08-14', '08:00')).toBe(false);
  });

  // ── Soporte de múltiples formatos de fecha ────────────────────────────────

  it('soporta formato DD-MM-YYYY (fecha futura)', () => {
    expect(isEventUpcoming('20-08-2026', '19:00')).toBe(true);
  });

  it('soporta formato DD/MM/YYYY con separador barra', () => {
    expect(isEventUpcoming('20/08/2026', '19:00')).toBe(true);
  });

  it('soporta formato YYYY/MM/DD con separador barra', () => {
    expect(isEventUpcoming('2026/08/20', '19:00')).toBe(true);
  });

  // ── Comportamiento sin hora ────────────────────────────────────────────────

  it('sin hora, asume fin de día (23:59:59) y devuelve true para hoy', () => {
    // Hoy 2026-08-14 a las 12:00 → sin hora asume 23:59:59, evento aún no pasó
    expect(isEventUpcoming('2026-08-14', null)).toBe(true);
  });

  it('sin hora, devuelve false para fechas pasadas', () => {
    expect(isEventUpcoming('2026-08-01', null)).toBe(false);
  });

  it('con timeString vacío, se comporta igual que null (fin de día)', () => {
    expect(isEventUpcoming('2026-08-14', '')).toBe(true);
  });

  // ── Manejo de errores / edge cases ────────────────────────────────────────

  it('devuelve false para una fecha con formato completamente inválido', () => {
    expect(isEventUpcoming('fecha-invalida', '19:00')).toBe(false);
  });

  it('devuelve false si dateString es null', () => {
    expect(isEventUpcoming(null, '19:00')).toBe(false);
  });

  it('devuelve false si dateString es undefined', () => {
    expect(isEventUpcoming(undefined, '19:00')).toBe(false);
  });

  it('devuelve false si dateString es string vacío', () => {
    expect(isEventUpcoming('', '19:00')).toBe(false);
  });

  it('ignora texto extra en timeString y parsea la hora correctamente', () => {
    // "20:00 hs" → extrae "20:00" → futuro
    expect(isEventUpcoming('2026-08-20', '20:00 hs')).toBe(true);
  });
});
