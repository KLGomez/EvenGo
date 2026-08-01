import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Vercel Serverless Function: POST /api/chat
 * Asistente Virtual Cultural de EvenGo alimentado por la API de Google Gemini.
 * 
 * Recibe:
 *  - message: consulta enviada por el usuario (string)
 *  - contextData: array con los eventos culturales filtrados en el frontend (max 20)
 * 
 * Retorna:
 *  - { reply: string }
 */
export default async function handler(req, res) {
  // Manejo de CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido. Utiliza POST.' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[api/chat] GEMINI_API_KEY no encontrada en las variables de entorno.');
      return res.status(500).json({
        error: 'Configuración incompleta en el servidor: Falta GEMINI_API_KEY.',
      });
    }

    const { message, contextData = [] } = req.body || {};

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'El campo "message" es requerido y no puede estar vacío.' });
    }

    // Inicializar el SDK de Google Generative AI
    const genAI = new GoogleGenerativeAI(apiKey);

    const systemInstruction = `Eres el asistente virtual de EvenGo, experto en la agenda cultural de Buenos Aires. Basándote ÚNICAMENTE en la siguiente lista de eventos en formato JSON, responde a la consulta del usuario recomendando el mejor plan. Sé amable, conciso y formatea tu respuesta.`;

    // Inicializar modelo (gemini-1.5-flash es óptimo por rapidez y costo)
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: systemInstruction,
    });

    // Construir la solicitud combinando el contexto de eventos y la duda del usuario
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
    console.error('[api/chat] Error al comunicarse con Gemini API:', error.message || error);
    return res.status(500).json({
      error: 'Error al generar la recomendación cultural.',
      detail: error.message || 'Ocurrió un error inesperado al procesar la solicitud.',
    });
  }
}
