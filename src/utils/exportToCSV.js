/**
 * Utilitario para exportar un array de objetos JSON a un archivo CSV descargable.
 * 
 * Convierte un array de objetos en formato CSV con soporte para UTF-8 y escapado de caracteres
 * especiales (comas, comillas dobles y saltos de línea).
 * 
 * @param {Array<Object>} data - Array de objetos a exportar (ej. eventos de EvenGo)
 * @param {string} filename - Nombre predeterminado del archivo descargado (ej. 'evengo-radar-cultural.csv')
 */
export function downloadCSV(data = [], filename = 'evengo-export.csv') {
  if (!Array.isArray(data) || data.length === 0) {
    console.warn('[downloadCSV] No hay datos válidos para exportar.');
    return;
  }

  // 1. Extraer las cabeceras a partir de las llaves del primer objeto
  const headers = Object.keys(data[0]);

  // Escapa cadenas con comas, saltos de línea o comillas
  const formatCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    // Escapar comillas dobles internas duplicándolas (" -> "")
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };

  // 2. Construir la cabecera
  const headerRow = headers.map(formatCell).join(',');

  // 3. Mapear los datos de cada evento
  const dataRows = data.map((row) => {
    return headers.map((key) => formatCell(row[key])).join(',');
  });

  // 4. Ensamblar el contenido CSV con BOM UTF-8 (\uFEFF) para compatibilidad con Excel
  const csvString = '\uFEFF' + [headerRow, ...dataRows].join('\n');

  // 5. Crear el objeto Blob y forzar la descarga en el navegador
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Liberar memoria
  URL.revokeObjectURL(url);
}

export default downloadCSV;
