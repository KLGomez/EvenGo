import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Vercel Serverless Function: POST /api/chat
 * Asistente Virtual Cultural de EvenGo alimentado por la API de Google Gemini.
 */
export default async function handler(req, res) {
  // Configuración de encabezados CORS y Content-Type
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utiliza POST.' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[api/chat] GEMINI_API_KEY no encontrada en las variables de entorno de Vercel.');
      return res.status(500).json({
        error: 'Configuración incompleta en el servidor: Falta GEMINI_API_KEY en Vercel.',
      });
    }

    // Extracción segura del cuerpo de la petición (soporta objeto parseado o string JSON)
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { message, contextData = [] } = body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'El campo "message" es requerido y no puede estar vacío.' });
    }

    // Inicializar SDK de Google Generative AI
    const genAI = new GoogleGenerativeAI(apiKey);

    const systemInstruction = `Eres el asistente virtual de EvenGo, experto en la agenda cultural de Buenos Aires. Basándote ÚNICAMENTE en la siguiente lista de eventos en formato JSON, responde a la consulta del usuario recomendando el mejor plan. Sé amable, conciso y formatea tu respuesta.`;

    // Inicializar el modelo gemini-1.5-flash con la instrucción del sistema
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction,
    });

    // Construcción del prompt unificado
    const prompt = `Lista de Eventos Culturales Disponibles en Buenos Aires (JSON):\n${JSON.stringify(
      contextData,
      null,
      2
    )}\n\nConsulta del Usuario:\n"${message}"`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const replyText = response.text();

    return res.status(200).json({ reply: replyText });
  } catch (error) {
    // Registro detallado de la traza de error en los logs de Vercel
    console.error('Error en API Gemini:', error.message || error);
    return res.status(500).json({
      error: 'Error en API Gemini',
      detail: error.message || String(error),
    });
  }
}
