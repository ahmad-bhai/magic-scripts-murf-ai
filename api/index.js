const axios = require('axios');

const userVoicePreference = {};
const DEFAULT_VOICE = "Natalie";

// 15 Diverse Murf AI Voices
const VOICE_OPTIONS = [
  { name: "Natalie (US Female)", id: "Natalie" },
  { name: "Marcus (US Male)", id: "Marcus" },
  { name: "Terrell (UK Male)", id: "Terrell" },
  { name: "Julia (UK Female)", id: "Julia" },
  { name: "Samantha (US Casual)", id: "Samantha" },
  { name: "Ken (US Professional)", id: "Ken" },
  { name: "Rachel (US Soft)", id: "Rachel" },
  { name: "Miles (US Deep)", id: "Miles" },
  { name: "Finley (UK Promo)", id: "Finley" },
  { name: "George (UK Storyteller)", id: "George" },
  { name: "Priya (Indian Female)", id: "Priya" },
  { name: "Aarav (Indian Male)", id: "Aarav" },
  { name: "Abigail (US E-Learning)", id: "Abigail" },
  { name: "Clive (UK News)", id: "Clive" },
  { name: "Aria (US Energetic)", id: "Aria" }
];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = req.url || '';
  const searchParams = new URLSearchParams(url.includes('?') ? url.split('?')[1] : '');
  
  let token = req.query.token || searchParams.get('token');
  let status = req.query.status || searchParams.get('status');

  if (!token) {
    const cleanPath = url.split('?')[0];
    const parts = cleanPath.split('/').filter(Boolean);
    if (parts.length >= 3) {
      if (parts[1] === 'v') {
        token = parts[2];
        status = parts[3];
      } else {
        token = parts[1];
        status = parts[2];
      }
    }
  }

  // -------------------------------------------------------------
  // 1. WEBHOOK INSTALLATION & MANAGEMENT
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
  // 2. INCOMING TELEGRAM WEBHOOK MESSAGES
  // -------------------------------------------------------------
  if (req.method === 'POST') {
    const activeToken = token;
    if (!activeToken) {
      return res.status(400).json({ error: "No Bot Token Provided in POST request" });
    }

    const TELEGRAM_API = `https://api.telegram.org/bot${activeToken}`;
    const update = req.body || {};

    // A. Handle Voice Selection via Inline Buttons
    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message.chat.id;
      const selectedVoice = query.data;

      userVoicePreference[chatId] = selectedVoice;

      try {
        await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
          callback_query_id: query.id,
          text: `Voice set to ${selectedVoice}! 🎙️`
        });

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `✅ **Voice Selected:** ${selectedVoice}\n\nAb koi bhi text ya voice/audio message bhejein!`
        });
      } catch (e) {
        console.error("Callback Error:", e.message);
      }

      return res.status(200).send('OK');
    }

    // B. Handle Incoming Messages (Text, Voice, or Audio)
    if (update.message) {
      const chatId = update.message.chat.id;
      const message = update.message;

      // Command: /start
      if (message.text === '/start') {
        try {
          await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: `Welcome to Murf AI Voice Bot! 🎙️\n\n- Text, Voice ya Audio message bhejein.\n- /voice command se 15 AI Voices mein se select karein.`
          });
        } catch (e) {
          console.error("Start Error:", e.message);
        }
        return res.status(200).send('OK');
      }

      // Command: /voice (Interactive 15 Voices Keyboard Grid)
      if (message.text === '/voice') {
        // Multi-row Grid Buttons Arrangement (3 per row)
        const inlineKeyboard = [];
        for (let i = 0; i < VOICE_OPTIONS.length; i += 3) {
          const row = VOICE_OPTIONS.slice(i, i + 3).map(v => ({
            text: v.name,
            callback_data: v.id
          }));
          inlineKeyboard.push(row);
        }

        try {
          await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: "Choose an AI Voice from 15 Available Voices:",
            reply_markup: JSON.stringify({ inline_keyboard: inlineKeyboard })
          });
        } catch (e) {
          console.error("Voice Menu Error:", e.message);
        }
        return res.status(200).send('OK');
      }

      // Handle Input (Text OR Voice/Audio Message)
      let inputPrompt = message.text;

      // If user sends Voice Note or Audio file
      if (!inputPrompt && (message.voice || message.audio)) {
        inputPrompt = message.caption || "Hello! Converting your voice message with Murf AI.";
      }

      if (inputPrompt) {
        try {
          await axios.post(`${TELEGRAM_API}/sendChatAction`, {
            chat_id: chatId,
            action: 'record_voice'
          });

          const selectedVoice = userVoicePreference[chatId] || DEFAULT_VOICE;
          const murfApiKey = process.env.MURF_API_KEY || "ap2_74e9410a-9a9c-469c-bea7-8bea790b9951";

          // Generate Speech via Murf AI
          const murfResponse = await axios.post('https://api.murf.ai/v1/speech/generate', {
            text: inputPrompt,
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
            text: "❌ Error processing audio. Please check your Murf API Key."
          });
        }
      }

      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
  }

  return res.status(200).json({ 
    status: "Active", 
    message: "15 Voices & Audio Support Murf AI Telegram Engine Active!" 
  });
};
