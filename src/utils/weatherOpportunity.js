// src/utils/weatherOpportunity.js
// Lógica meteorológica y motor analítico de oportunidad para EvenGo

/**
 * Coordenadas de la Ciudad Autónoma de Buenos Aires (CABA)
 */
export const BSAS_COORDS = {
  latitude: -34.6037,
  longitude: -58.3816,
};

/**
 * Presets de clima para simulación y pruebas directas
 */
export const WEATHER_PRESETS = {
  clear: {
    temperature: 23,
    apparentTemperature: 24,
    conditionText: 'Templado y soleado',
    isFavorable: true,
    precipitationProb: 10,
    windSpeed: 12,
    code: 0,
    icon: 'sun',
  },
  rainy: {
    temperature: 15,
    apparentTemperature: 13,
    conditionText: 'Lluvia y cielo cubierto',
    isFavorable: false,
    precipitationProb: 85,
    windSpeed: 24,
    code: 61,
    icon: 'rain',
  },
};

/**
 * Clasifica un evento como 'outdoor' (al aire libre) o 'indoor' (bajo techo)
 * evaluando semánticamente título, descripción, ubicación y dirección.
 *
 * @param {Object} event - Objeto de evento de EvenGo
 * @returns {'outdoor'|'indoor'}
 */
export function classifyEventEnvironment(event) {
  if (!event) return 'indoor';

  const text = [
    event.title,
    event.description,
    event.address,
    event.location,
    event.category,
    event.venue,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // Palabras clave inequívocas de interiores
  const indoorKeywords = [
    'teatro', 'cine', 'museo', 'galeria', 'sala', 'auditorio',
    'biblioteca', 'club', 'centro cultural', 'salon', 'taller',
    'estudio', 'bar', 'cafe', 'recinto', 'complejo teatral',
    'palacio', 'cupula', 'microteatro', 'caras y caretas',
    'bellas artes', 'planetario', 'usina del arte', 'bajo techo',
    'espacio cerrado', 'estacion'
  ];

  // Palabras clave inequívocas de exteriores
  const outdoorKeywords = [
    'parque', 'plaza', 'aire libre', 'anfiteatro', 'calle', 'playa',
    'costanera', 'puerto madero', 'corredor', 'maraton', 'carrera',
    'ciclismo', 'skate', 'patin', 'bicicleteada', 'callejera',
    'espacio publico', 'cancha', 'estadio', 'jardin', 'bosque',
    'paseo', 'rambla', 'dorrego', 'centenario', 'caminito', 'peatonal',
    'rosedal', 'lagos de palermo'
  ];

  const matchesOutdoor = outdoorKeywords.some((kw) => text.includes(kw));
  const matchesIndoor = indoorKeywords.some((kw) => text.includes(kw));

  // Prioridad a 'aire libre' si se menciona explícitamente
  if (text.includes('aire libre') || text.includes('a cielo abierto')) {
    return 'outdoor';
  }

  if (matchesOutdoor && !matchesIndoor) return 'outdoor';
  if (matchesIndoor && !matchesOutdoor) return 'indoor';

  if (matchesOutdoor && matchesIndoor) {
    // Si contiene ambos (ej: "Concierto en la plaza del Centro Cultural"),
    // verificamos si la dirección física indica parque o plaza
    const locationText = [event.address, event.location].filter(Boolean).join(' ').toLowerCase();
    if (outdoorKeywords.some((kw) => locationText.includes(kw))) {
      return 'outdoor';
    }
    return 'indoor';
  }

  // Fallbacks por categoría
  if (event.category === 'Deportivo') return 'outdoor';

  return 'indoor';
}

/**
 * Determina la descripción y favorabilidad del clima según el código meteorológico WMO
 * @param {number} code - WMO weather code
 * @param {number} precipitationProb - Probabilidad de lluvia (0-100)
 * @param {number} temp - Temperatura en Celsius
 */
export function interpretWeather(code, precipitationProb = 0, temp = 20) {
  // Códigos WMO de lluvia / tormenta / nieve
  const isRainCode = (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
  const isHighRainRisk = precipitationProb >= 40;
  const isExtremeCold = temp < 10;
  const isExtremeHeat = temp > 36;

  const isFavorable = !isRainCode && !isHighRainRisk && !isExtremeCold && !isExtremeHeat;

  let conditionText = 'Templado y agradable';
  let icon = 'sun';

  if (isRainCode || precipitationProb >= 70) {
    conditionText = 'Lluvias y precipitaciones';
    icon = 'rain';
  } else if (precipitationProb >= 40) {
    conditionText = 'Inestable con riesgo de chaparrones';
    icon = 'rain';
  } else if (code >= 1 && code <= 3) {
    conditionText = 'Parcialmente nublado';
    icon = 'cloud-sun';
  } else if (code === 0) {
    conditionText = temp >= 26 ? 'Cálido y despejado' : 'Templado y despejado';
    icon = 'sun';
  } else if (isExtremeCold) {
    conditionText = 'Frío intenso';
    icon = 'cloud';
  }

  return {
    isFavorable,
    conditionText,
    icon,
  };
}

/**
 * Consulta el clima en tiempo real de Buenos Aires con la API de Open-Meteo
 * @returns {Promise<Object>}
 */
export async function fetchBuenosAiresWeather() {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${BSAS_COORDS.latitude}&longitude=${BSAS_COORDS.longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=precipitation_probability&forecast_days=1&timezone=America%2FArgentina%2FBuenos_Aires`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = await res.json();

    const current = data.current || {};
    const temp = Math.round(current.temperature_2m ?? 21);
    const apparent = Math.round(current.apparent_temperature ?? temp);
    const wind = Math.round(current.wind_speed_10m ?? 12);
    const humidity = Math.round(current.relative_humidity_2m ?? 60);
    const code = current.weather_code ?? 0;

    // Obtener la probabilidad de lluvia de la hora actual
    const currentHour = new Date().getHours();
    const precipitationProb = data.hourly?.precipitation_probability?.[currentHour] ?? 10;

    const interpretation = interpretWeather(code, precipitationProb, temp);

    return {
      temperature: temp,
      apparentTemperature: apparent,
      conditionText: interpretation.conditionText,
      isFavorable: interpretation.isFavorable,
      precipitationProb,
      windSpeed: wind,
      humidity,
      code,
      icon: interpretation.icon,
      isLive: true,
    };
  } catch (err) {
    console.warn('[WeatherOpportunity] Fallback a preset local:', err.message);
    return {
      ...WEATHER_PRESETS.clear,
      isLive: false,
    };
  }
}

/**
 * Calcula las métricas de contraste entre el clima y el catálogo de eventos
 *
 * @param {Array} events - Lista de eventos
 * @param {Object} weather - Estado del clima
 * @returns {Object}
 */
export function calculateOpportunityMetrics(events = [], weather = WEATHER_PRESETS.clear) {
  if (!Array.isArray(events) || events.length === 0) {
    return {
      totalEvents: 0,
      outdoorCount: 0,
      indoorCount: 0,
      outdoorPercentage: 0,
      indoorPercentage: 0,
      recommendedEvents: [],
      targetEnvironment: weather.isFavorable ? 'outdoor' : 'indoor',
    };
  }

  const outdoorEvents = [];
  const indoorEvents = [];

  events.forEach((event) => {
    const env = classifyEventEnvironment(event);
    if (env === 'outdoor') {
      outdoorEvents.push(event);
    } else {
      indoorEvents.push(event);
    }
  });

  const totalEvents = events.length;
  const outdoorCount = outdoorEvents.length;
  const indoorCount = indoorEvents.length;

  const outdoorPercentage = totalEvents > 0 ? Math.round((outdoorCount / totalEvents) * 100) : 0;
  const indoorPercentage = totalEvents > 0 ? Math.round((indoorCount / totalEvents) * 100) : 0;

  const targetEnvironment = weather.isFavorable ? 'outdoor' : 'indoor';
  const recommendedPool = weather.isFavorable ? outdoorEvents : indoorEvents;

  // Tomamos los primeros 3 eventos como recomendaciones destacadas
  const recommendedEvents = recommendedPool.slice(0, 3);

  return {
    totalEvents,
    outdoorCount,
    indoorCount,
    outdoorPercentage,
    indoorPercentage,
    recommendedEvents,
    targetEnvironment,
  };
}
