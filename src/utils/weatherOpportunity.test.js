// src/utils/weatherOpportunity.test.js
import { describe, it, expect } from 'vitest';
import {
  classifyEventEnvironment,
  calculateOpportunityMetrics,
  interpretWeather,
  WEATHER_PRESETS,
} from './weatherOpportunity.js';

describe('weatherOpportunity - classifyEventEnvironment', () => {
  it('clasifica eventos en parques o plazas como outdoor', () => {
    const event = {
      title: 'Rock en el Parque Centenario',
      description: 'Música en vivo al aire libre',
      address: 'Av. Ángel Gallardo 490, Parque Centenario',
      category: 'Musical',
    };
    expect(classifyEventEnvironment(event)).toBe('outdoor');
  });

  it('clasifica eventos en plazas y ferias a cielo abierto como outdoor', () => {
    const event = {
      title: 'Feria Gastronómica',
      description: 'Puestos de comida callejera en Plaza Dorrego',
      address: 'Defensa 1100, Plaza Dorrego',
      category: 'Gastronomía',
    };
    expect(classifyEventEnvironment(event)).toBe('outdoor');
  });

  it('clasifica maratones y deportes como outdoor', () => {
    const event = {
      title: 'Maratón de la Ciudad',
      description: 'Carrera de 10K',
      category: 'Deportivo',
    };
    expect(classifyEventEnvironment(event)).toBe('outdoor');
  });

  it('clasifica eventos en cines, salas o clubes como indoor', () => {
    const event = {
      title: 'Ciclo de Cine Silente',
      description: 'Proyecciones de clásicos en sala climatizada',
      address: 'Thames 1744, Cine Arte Palermo',
      category: 'Cultural',
    };
    expect(classifyEventEnvironment(event)).toBe('indoor');
  });

  it('clasifica torneos bajo techo o museos como indoor', () => {
    const event = {
      title: 'Torneo de Ajedrez Abierto',
      description: 'Modalidad suiza en salón cerrado',
      address: 'Cuba 2222, Club Atlético Belgrano',
      category: 'Cultural',
    };
    expect(classifyEventEnvironment(event)).toBe('indoor');
  });

  it('maneja eventos vacíos o nulos de forma segura retornando indoor', () => {
    expect(classifyEventEnvironment(null)).toBe('indoor');
    expect(classifyEventEnvironment({})).toBe('indoor');
  });
});

describe('weatherOpportunity - interpretWeather', () => {
  it('identifica clima favorable con código 0 y baja probabilidad de lluvia', () => {
    const result = interpretWeather(0, 10, 22);
    expect(result.isFavorable).toBe(true);
    expect(result.icon).toBe('sun');
  });

  it('identifica clima adverso con código de lluvia WMO', () => {
    const result = interpretWeather(61, 80, 16);
    expect(result.isFavorable).toBe(false);
    expect(result.icon).toBe('rain');
  });

  it('identifica clima adverso si la probabilidad de lluvia es alta (>= 40%)', () => {
    const result = interpretWeather(2, 60, 20);
    expect(result.isFavorable).toBe(false);
    expect(result.icon).toBe('rain');
  });

  it('identifica frío extremo (< 10°C) como clima adverso para exteriores', () => {
    const result = interpretWeather(0, 5, 8);
    expect(result.isFavorable).toBe(false);
  });
});

describe('weatherOpportunity - calculateOpportunityMetrics', () => {
  const sampleEvents = [
    { id: 1, title: 'Rock en Parque', address: 'Parque Centenario', category: 'Musical' }, // outdoor
    { id: 2, title: 'Feria en Plaza', address: 'Plaza Dorrego', category: 'Gastronomía' }, // outdoor
    { id: 3, title: 'Cine Silente', address: 'Cine Arte Palermo', category: 'Cultural' }, // indoor
    { id: 4, title: 'Ajedrez en Club', address: 'Club Belgrano', category: 'Cultural' }, // indoor
  ];

  it('calcula porcentajes correctos para la lista de eventos', () => {
    const metrics = calculateOpportunityMetrics(sampleEvents, WEATHER_PRESETS.clear);
    expect(metrics.totalEvents).toBe(4);
    expect(metrics.outdoorCount).toBe(2);
    expect(metrics.indoorCount).toBe(2);
    expect(metrics.outdoorPercentage).toBe(50);
    expect(metrics.indoorPercentage).toBe(50);
  });

  it('recomienda eventos outdoor si el clima es favorable', () => {
    const metrics = calculateOpportunityMetrics(sampleEvents, WEATHER_PRESETS.clear);
    expect(metrics.targetEnvironment).toBe('outdoor');
    expect(metrics.recommendedEvents).toHaveLength(2);
    expect(metrics.recommendedEvents[0].title).toBe('Rock en Parque');
  });

  it('recomienda eventos indoor (planes bajo techo) si el clima es desfavorable', () => {
    const metrics = calculateOpportunityMetrics(sampleEvents, WEATHER_PRESETS.rainy);
    expect(metrics.targetEnvironment).toBe('indoor');
    expect(metrics.recommendedEvents).toHaveLength(2);
    expect(metrics.recommendedEvents[0].title).toBe('Cine Silente');
  });

  it('retorna métricas seguras cuando el array de eventos está vacío', () => {
    const metrics = calculateOpportunityMetrics([], WEATHER_PRESETS.clear);
    expect(metrics.totalEvents).toBe(0);
    expect(metrics.outdoorPercentage).toBe(0);
    expect(metrics.indoorPercentage).toBe(0);
    expect(metrics.recommendedEvents).toEqual([]);
  });
});
