/**
 * Genera una URL de Google Calendar para agregar un evento.
 * Formato de fechas: YYYYMMDDTHHMMSS
 *
 * @param {Object} event - Objeto del evento
 * @returns {string} URL lista para abrir en Google Calendar
 */
export function buildGoogleCalendarUrl(event) {
  const { title, description, date, time, address, location } = event;

  // Convertir fecha y hora al formato requerido por Google Calendar (YYYYMMDDTHHMMSS)
  const [year, month, day] = date.split('-');
  const [hour, minute] = time.split(':');

  const startDateTime = `${year}${month}${day}T${hour}${minute}00`;

  // La duración estimada del evento es 2 horas
  const endHour = String(parseInt(hour, 10) + 2).padStart(2, '0');
  const endDateTime = `${year}${month}${day}T${endHour}${minute}00`;

  const locationString = address ? `${address}, ${location}` : location;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startDateTime}/${endDateTime}`,
    details: description,
    location: locationString,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD) a formato legible en español.
 * @param {string} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('es-AR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Comprueba si una fecha ISO pertenece al rango del filtro seleccionado.
 * @param {string} dateStr - fecha ISO del evento (YYYY-MM-DD)
 * @param {'all'|'today'|'week'|'month'} filter
 * @returns {boolean}
 */
export function isInDateRange(dateStr, filter) {
  if (filter === 'all') return true;

  const [y, m, d] = dateStr.split('-').map(Number);
  const eventDate = new Date(y, m - 1, d);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter === 'today') {
    return eventDate.getTime() === today.getTime();
  }

  if (filter === 'week') {
    const weekEnd = new Date(today);
    weekEnd.setDate(today.getDate() + 6);
    return eventDate >= today && eventDate <= weekEnd;
  }

  if (filter === 'month') {
    return (
      eventDate.getFullYear() === today.getFullYear() &&
      eventDate.getMonth() === today.getMonth()
    );
  }

  return true;
}
