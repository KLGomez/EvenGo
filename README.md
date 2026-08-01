# EvenGo 🗺️ - Agenda y Radar Cultural de Buenos Aires

EvenGo es una aplicación web moderna diseñada para descubrir y explorar la oferta cultural de la Ciudad Autónoma de Buenos Aires. Va más allá de una simple agenda de eventos: integra un **Motor Analítico de Datos en el frontend** que procesa grandes volúmenes de eventos en tiempo real para transformar datos brutos en información ejecutiva y gráficos interactivos.

---

## ✨ Funcionalidades Principales

- **Exploración de Eventos**: Grilla interactiva y dinámica con filtros combinables por categoría, zona geográfica, rango de fecha y búsqueda por texto libre.
- **Radar Cultural 📊**: Dashboard de inteligencia cultural con:
  - **KPIs Ejecutivos**: Métricas clave a simple vista (Total de eventos, Barrio líder, Porcentaje de eventos gratuitos y Próximo evento).
  - **Ecosistema Temático**: Gráfico poligonal (`RadarChart`) que visualiza la concentración de eventos en el Top 6 de categorías culturales.
  - **Visualización por Precio y Zona**: Gráficos interactivos de Donut/Torta (`PieChart`) y Barras (`BarChart`) para analizar costos y densidad geográfica.
- **Exportación de Datos a CSV 📥**: Descarga directa del catálogo completo de eventos procesados en formato CSV con soporte de **BOM UTF-8 (`\uFEFF`)**, garantizando compatibilidad nativa con Microsoft Excel sin distorsión de caracteres o acentos.

---

## 🏗️ Arquitectura y Decisiones Técnicas

1. **Single Source of Truth (Context API)**: 
   Implementación de `EventProvider` en el nivel superior de la aplicación. Al centralizar la carga de datos de la API, tanto la vista principal de la agenda (`/`) como la vista inmersiva del Radar Cultural (`/radar-cultural`) consumen el mismo estado memorizado en React, eliminando latencia de red y evitando peticiones HTTP duplicadas al cambiar de ruta.

2. **Procesamiento Eficiente O(N)**: 
   El custom hook `useEventAnalytics` actúa como un *Data Pipeline* en el cliente. Agrupa la clasificación de precios, conteo por barrios, distribución de categorías y cálculo de KPIs en una única pasada lineal $O(N)$ utilizando `.reduce()`. El uso estratégico de `useMemo` previene recálculos innecesarios en el hilo principal durante los re-renders.

3. **Componentización Responsiva**: 
   Aprovechamiento de la librería `Recharts` encapsulada en contenedores `ResponsiveContainer`, logrando un diseño visual en modo oscuro (*Dark Mode*) con Tailwind CSS adaptado fluidamente para dispositivos móviles, tablets y monitores de alta resolución.

---

## 🛠️ Stack Tecnológico

- **React 19** (Custom Hooks, Context API, useMemo, useCallback)
- **React Router DOM v7** (Enrutamiento declarativo y rutas inmersivas)
- **Recharts** (Visualización interactiva de datos y gráficos SVG)
- **Tailwind CSS v4** (Diseño moderno, utilidades y Dark Theme)
- **Vite** (Build tool y servidor de desarrollo ultra rápido)

---

## 🚀 Instalación y Ejecución Local

Para clonar y ejecutar este proyecto en tu entorno local, sigue estos pasos:

```bash
# 1. Clonar el repositorio
git clone https://github.com/KLGomez/EvenGo.git

# 2. Ingresar al directorio del proyecto
cd EvenGo

# 3. Instalar dependencias
npm install

# 4. Iniciar el servidor de desarrollo
npm run dev
```

---

*Desarrollado con ❤️ por Katherine Gomez desde Quilmes, Buenos Aires.*
