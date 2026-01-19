/**
 * Netlify Function - Contacto Form Handler
 * Envía emails usando Resend API
 * 
 * IMPORTANTE: Las API keys se configuran en Netlify Dashboard como variables de entorno
 * Nunca expongas las API keys en el código
 */

const https = require('https');

exports.handler = async (event, context) => {
  // Solo permitir POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Método no permitido' })
    };
  }

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    // Parse form data
    const data = JSON.parse(event.body);
    const { name, email, message } = data;

    // Validación básica
    if (!name || !email || !message) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Faltan campos requeridos',
          success: false 
        })
      };
    }

    // Validar email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Email inválido',
          success: false 
        })
      };
    }

    // API Key desde variable de entorno de Netlify
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    
    if (!RESEND_API_KEY) {
      console.error('ERROR: RESEND_API_KEY no configurada');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'Configuración del servidor incompleta',
          success: false 
        })
      };
    }

    // Enviar email de notificación a contacto@autoaiuy.com
    const emailSent = await sendEmail(RESEND_API_KEY, {
      from: 'AutoAIUY <contacto@autoaiuy.com>',
      to: 'contacto@autoaiuy.com',
      replyTo: email, // Para que puedas responder directamente al cliente
      subject: `Nueva consulta de ${name}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%); 
                     color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .field { margin-bottom: 20px; }
            .label { font-weight: bold; color: #6366f1; margin-bottom: 5px; }
            .value { background: white; padding: 15px; border-radius: 6px; border-left: 3px solid #8b5cf6; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🚀 Nueva Consulta - AutoAIUY</h1>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">Nombre:</div>
                <div class="value">${escapeHtml(name)}</div>
              </div>
              <div class="field">
                <div class="label">Email:</div>
                <div class="value"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></div>
              </div>
              <div class="field">
                <div class="label">Mensaje:</div>
                <div class="value">${escapeHtml(message).replace(/\n/g, '<br>')}</div>
              </div>
              <p style="margin-top: 30px; color: #666; font-size: 14px;">
                📧 Responder directamente a ${escapeHtml(email)}
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    // Verificar que el email se envió
    if (!emailSent) {
      throw new Error('Error al enviar el email');
    }

    // Respuesta exitosa
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true,
        message: 'Emails enviados correctamente'
      })
    };

  } catch (error) {
    console.error('Error en función contacto:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Error al procesar la solicitud',
        success: false,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};

/**
 * Función helper para enviar emails usando Resend API
 */
function sendEmail(apiKey, emailData) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(emailData);

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log('Email enviado exitosamente:', data);
          resolve(true);
        } else {
          console.error('Error al enviar email:', res.statusCode, data);
          reject(new Error(`Resend API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('Error en request HTTPS:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

/**
 * Sanitizar HTML para prevenir XSS
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
