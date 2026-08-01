// ============================================================
// MOCK DATA — Eventos ficticios de Buenos Aires
// ============================================================
// TODO: Reemplazar `mockEvents` por una llamada real a la API.
// Ejemplo de integración futura:
//
// export async function fetchEvents() {
//   const response = await fetch('https://api.evengo.com.ar/v1/events');
//   if (!response.ok) throw new Error('Error al obtener eventos');
//   return response.json();
// }
//
// En su lugar, actualmente exportamos datos estáticos de prueba:
// ============================================================

export const CATEGORIES = ['Todos', 'Deportivo', 'Musical', 'Cultural', 'Gastronomía'];

export const ZONES = [
  'Todas las zonas',
  'Palermo',
  'San Telmo',
  'Quilmes',
  'Obelisco / Centro',
  'La Boca',
  'Belgrano',
];

export const DATE_FILTERS = [
  { label: 'Cualquier fecha', value: 'all' },
  { label: 'Hoy', value: 'today' },
  { label: 'Esta semana', value: 'week' },
  { label: 'Este mes', value: 'month' },
];

export const mockEvents = [
  {
    id: 1,
    title: 'Rock en el Parque Centenario',
    description:
      'Una jornada de rock nacional con las mejores bandas emergentes de Buenos Aires. Entrada libre y gratuita para toda la familia.',
    category: 'Musical',
    date: '2026-08-02',
    time: '18:00',
    location: 'Palermo',
    address: 'Av. Ángel Gallardo 490, Parque Centenario',
    url: 'https://ejemplo.com/rock-centenario',
  },
  {
    id: 2,
    title: 'Feria Gastronómica San Telmo',
    description:
      'Más de 40 puestos con cocina argentina, fusión y street food en el barrio más bohemio de la ciudad. Degustaciones y show de tango en vivo.',
    category: 'Gastronomía',
    date: '2026-08-03',
    time: '12:00',
    location: 'San Telmo',
    address: 'Defensa 1100, Plaza Dorrego',
    url: 'https://ejemplo.com/feria-santelmo',
  },
  {
    id: 3,
    title: 'Maratón Solidaria Quilmes',
    description:
      'Carrera de 5 y 10 km a beneficio del Hospital Interzonal de Quilmes. Apta para corredores de todos los niveles. Inscripción anticipada con cupo limitado.',
    category: 'Deportivo',
    date: '2026-08-07',
    time: '08:00',
    location: 'Quilmes',
    address: 'Av. Rivadavia 200, Quilmes Centro',
    url: 'https://ejemplo.com/maraton-quilmes',
  },
  {
    id: 4,
    title: 'Exposición Arte Urbano BA',
    description:
      'Muestra colectiva de arte urbano, graffiti y stencil en pleno centro porteño. Artistas locales e internacionales intervienen el espacio público.',
    category: 'Cultural',
    date: '2026-08-05',
    time: '15:00',
    location: 'Obelisco / Centro',
    address: 'Av. Corrientes 1600, CABA',
    url: 'https://ejemplo.com/arte-urbano-obelisco',
  },
  {
    id: 5,
    title: 'Festival de Jazz La Boca',
    description:
      'Dos días de jazz y blues al aire libre en el colorido barrio de La Boca. Músicos nacionales e invitados de Brasil y Uruguay.',
    category: 'Musical',
    date: '2026-08-09',
    time: '20:00',
    location: 'La Boca',
    address: 'Caminito 100, La Boca',
    url: 'https://ejemplo.com/jazz-laboca',
  },
  {
    id: 6,
    title: 'Torneo de Ajedrez Abierto',
    description:
      'Torneo clasificatorio de ajedrez con modalidad suiza, abierto a todas las categorías. Premios para los tres primeros puestos de cada rama.',
    category: 'Deportivo',
    date: '2026-08-14',
    time: '10:00',
    location: 'Belgrano',
    address: 'Cuba 2222, Club Atlético Belgrano',
    url: 'https://ejemplo.com/torneo-ajedrez-belgrano',
  },
  {
    id: 7,
    title: 'Ciclo de Cine Silente',
    description:
      'Proyecciones de clásicos del cine mudo con acompañamiento musical en vivo a cargo del ensamble Tango & Groove.',
    category: 'Cultural',
    date: '2026-08-01',
    time: '21:00',
    location: 'Palermo',
    address: 'Thames 1744, Cine Arte Palermo',
    url: 'https://ejemplo.com/cine-silente-palermo',
  },
  {
    id: 8,
    title: 'Brunch Vegano Porteño',
    description:
      'El mayor encuentro de gastronomía vegana y plant-based de Buenos Aires. Más de 60 emprendedores, talleres de cocina y música en vivo.',
    category: 'Gastronomía',
    date: '2026-08-16',
    time: '10:30',
    location: 'Belgrano',
    address: 'Juramento 1400, Belgrano',
    url: 'https://ejemplo.com/brunch-vegano',
  },
];
