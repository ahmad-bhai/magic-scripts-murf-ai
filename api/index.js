const axios = require('axios');

const userVoicePreference = {};
const DEFAULT_VOICE = "Natalie";
const VOICE_OPTIONS = [
  { name: "Natalie (US Female)", id: "Natalie" },
  { name: "Marcus (US Male)", id: "Marcus" },
  { name: "Terrell (UK Male)", id: "Terrell" },
  { name: "Julia (UK Female)", id: "Julia" }
];

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // URL Parsing Fix
  const url = req.url || '';
  const searchParams = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
  
  // Extract Query Parameters
  let token = req.query.token || searchParams.get('token');
  let status = req.query.status || searchParams.get('status');

  // Fallback Path Parser (e.g. /api/v/TOKEN/true or /api/TOKEN/false)
  if (!token) {
    const cleanPath = url.split('?')[0];
    const parts = cleanPath.split('/').filter(Boolean);
    
    if (parts.length >= 3) {
      // Handles /api/v/{token}/{status}
      if (parts[1] === 'v') {
        token = parts[2];
        status = parts[3];
      } else {
        // Handles /api/{token}/{status}
        token = parts[1];
        status = parts[2];
      }
    }
  }

  // -------------------------------------------------------------
  // 1. INSTALL / STOP BOT ACTION
  // -------------------------------------------------------------
  if (token && status !== undefined && status !== null) {
    const TELEGRAM_API = `https://api.telegram.org/bot${token}`;

    if (String(status) === 'true') {
      try {
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const webhookUrl = `${protocol}://${host}/api?token=${token}`;

        const response = await axios.post(`${TELEGRAM_API}/setWebhook`, {
          url: webhookUrl
        });

        return res.status(200).json({
          success: true,
          message: "Bot Webhook Successfully Installed and Running!",
          webhook_url: webhookUrl,
          telegram_response: response.data
        });
      } catch (error) {
        return res.status(500).json({ 
          success: false, 
          error: error.response ? error.response.data : error.message 
        });
      }
    }

    if (String(status) === 'false') {
      try {
        const response = await axios.post(`${TELEGRAM_API}/deleteWebhook`);
        return res.status(200).json({
          success: true,
          message: "Bot Webhook Successfully Stopped/Uninstalled!",
          telegram_response: response.data
        });
      } catch (error) {
        return res.status(500).json({ 
          success: false, 
          error: error.response ? error.response.data : error.message 
        });
      }
    }
  }

  // -------------------------------------------------------------
  // 2. TELEGRAM WEBHOOK INCOMING MESSAGES (POST)
  // -------------------------------------------------------------
  if (req.method === 'POST') {
    const activeToken = token;
    if (!activeToken) {
      return res.status(400).json({ error: "No Bot Token Provided in POST request" });
    }

    const TELEGRAM_API = `https://api.telegram.org/bot${activeToken}`;
    const update = req.body || {};

    // A. Handle Callback Query (Voice Inline Keyboard Click)
    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message.chat.id;
      const selectedVoice = query.data;

      userVoicePreference[chatId] = selectedVoice;

      try {
        await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
          callback_query_id: query.id,
          text: `Voice updated to ${selectedVoice}! 🎙️`
        });

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `✅ **Voice Selected:** ${selectedVoice}\n\nAb koi bhi text message bhejein, main is voice mein audio convert kar doonga!`
        });
      } catch (e) {
        console.error("Callback Error:", e.message);
      }

      return res.status(200).send('OK');
    }

    // B. Handle Text Messages
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      if (text === '/start') {
        try {
          await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: `Welcome to Murf AI Voiceover Bot! 🎙️\n\n- Text bhejein to convert it into speech.\n- Use /voice command to change the AI Voice.`
          });
        } catch (e) {
          console.error("Start Error:", e.message);
        }
        return res.status(200).send('OK');
      }

      if (text === '/voice') {
        const inlineKeyboard = VOICE_OPTIONS.map(v => ([{
          text: v.name,
          callback_data: v.id
        }]));

        try {
          await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: "Select an AI Voice from the options below:",
            reply_markup: JSON.stringify({ inline_keyboard: inlineKeyboard })
          });
        } catch (e) {
          console.error("Voice Menu Error:", e.message);
        }
        return res.status(200).send('OK');
      }

      // Generate Murf AI Voiceover
      try {
        await axios.post(`${TELEGRAM_API}/sendChatAction`, {
          chat_id: chatId,
          action: 'record_voice'
        });

        const selectedVoice = userVoicePreference[chatId] || DEFAULT_VOICE;
        const murfApiKey = process.env.MURF_API_KEY || "ap2_74e9410a-9a9c-469c-bea7-8bea790b9951";

        const murfResponse = await axios.post('https://api.murf.ai/v1/speech/generate', {
          text: text,
          voiceId: selectedVoice,
          format: 'MP3'
        }, {
          headers: { 
            'api-key': murfApiKey,
            'Content-Type': 'application/json'
          }
        });

        const audioUrl = murfResponse.data.audioFile;

        await axios.post(`${TELEGRAM_API}/sendAudio`, {
          chat_id: chatId,
          audio: audioUrl,
          caption: `🎙️ Voice: ${selectedVoice} | Generated via Murf AI`
        });

      } catch (err) {
        console.error('Murf AI Error:', err.response ? err.response.data : err.message);
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "❌ Error generating audio. Please check your Murf API Key balance or try again."
        });
      }

      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
  }

  // Healthy Response Dashboard
  return res.status(200).json({ 
    status: "Active", 
    message: "Murf AI Telegram Engine is Running!",
    usage: "Hit /api?token=YOUR_BOT_TOKEN&status=true to activate webhook."
  });
};
