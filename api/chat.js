import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Vercel Serverless Function: POST /api/chat
 * Asistente Virtual Cultural de EvenGo alimentado por la API de Google Gemini.
 * Soporta memoria de conversación (historial) e inyección de contexto con enlaces Markdown.
 */
export default async function handler(req, res) {
  // Encabezados CORS y Content-Type
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
        error: 'Configuración incompleta en el servidor: Falta GEMINI_API_KEY.',
      });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { messages = [], message, contextData = [] } = body;

    // Construcción del historial de conversación para preservar la memoria
    let conversationHistory = [];
    if (Array.isArray(messages) && messages.length > 0) {
      conversationHistory = messages;
    } else if (message) {
      conversationHistory = [{ role: 'user', content: message }];
    }

    if (conversationHistory.length === 0) {
      return res.status(400).json({ error: 'El campo "messages" o "message" es requerido.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    const systemInstruction = `Eres el asistente virtual de EvenGo, experto en la agenda cultural de Buenos Aires. Basándote ÚNICAMENTE en la siguiente lista de eventos en formato JSON, responde a las consultas del usuario recomendando los mejores planes.

REGLAS DE FORMATO Y REDIRECCIÓN:
1. Sé amable, conciso y formatea tu respuesta de manera clara usando Markdown.
2. CADA VEZ que recomiendes o menciones un evento de la lista, DEBES incluir obligatoriamente su enlace clickeable utilizando estrictamente el formato Markdown: [Nombre del Evento](url) usando el campo "url" exacto especificado en el JSON del evento.
3. Mantén el contexto de la conversación anterior para responder preguntas de seguimiento (memoria activa).

Lista de Eventos Culturales Disponibles en Buenos Aires (JSON):
${JSON.stringify(contextData, null, 2)}`;

    const model = genAI.getGenerativeModel({
      model: 'gemini-flash-latest',
      systemInstruction: systemInstruction,
    });

    // Formatear historial para el SDK de Gemini ({ role: 'user'|'model', parts: [{ text }] })
    const contents = conversationHistory.map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));

    const result = await model.generateContent({ contents });
    const response = await result.response;
    const replyText = response.text();

    return res.status(200).json({ reply: replyText });
  } catch (error) {
    console.error('Error en API Gemini:', error.message || error);
    return res.status(500).json({
      error: 'Error en API Gemini',
      detail: error.message || String(error),
    });
  }
}
