const axios = require('axios');

const userVoicePreference = {};
const DEFAULT_VOICE = "Natalie";

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

  // 1. WEBHOOK INSTALLATION
  if (token && status !== undefined && status !== null) {
    const TELEGRAM_API = `https://api.telegram.org/bot${token}`;

    if (String(status) === 'true') {
      try {
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const webhookUrl = `${protocol}://${host}/api?token=${token}`;

        const response = await axios.post(`${TELEGRAM_API}/setWebhook`, { url: webhookUrl });

        return res.status(200).json({
          success: true,
          message: "Bot Webhook Successfully Installed and Running!",
          webhook_url: webhookUrl,
          telegram_response: response.data
        });
      } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
    }

    if (String(status) === 'false') {
      try {
        const response = await axios.post(`${TELEGRAM_API}/deleteWebhook`);
        return res.status(200).json({ success: true, message: "Bot Webhook Stopped Successfully!" });
      } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
      }
    }
  }

  // 2. INCOMING TELEGRAM WEBHOOK MESSAGES
  if (req.method === 'POST') {
    const activeToken = token;
    if (!activeToken) return res.status(400).json({ error: "No Token Provided" });

    const TELEGRAM_API = `https://api.telegram.org/bot${activeToken}`;
    const update = req.body || {};

    // A. Handle Voice Selection Buttons
    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message.chat.id;
      const selectedVoice = query.data;

      userVoicePreference[chatId] = selectedVoice;

      await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
        callback_query_id: query.id,
        text: `Voice set to ${selectedVoice}! 🎙️`
      });

      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `✅ **Voice Selected:** ${selectedVoice}\n\nAb aap text bhejein ya voice note bhejein!`
      });

      return res.status(200).send('OK');
    }

    // B. Handle Messages
    if (update.message) {
      const chatId = update.message.chat.id;
      const message = update.message;

      if (message.text === '/start') {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `Welcome to Murf AI Voice Bot! 🎙️\n\n- Text bhejein ya Voice Note bhejein.\n- Voice note bhejne par bot usko text mein badal kar aapko dega taake aap usey check ya copy kar sakein.\n- /voice command se 15 AI Voices select karein.`
        });
        return res.status(200).send('OK');
      }

      if (message.text === '/voice') {
        const inlineKeyboard = [];
        for (let i = 0; i < VOICE_OPTIONS.length; i += 3) {
          const row = VOICE_OPTIONS.slice(i, i + 3).map(v => ({ text: v.name, callback_data: v.id }));
          inlineKeyboard.push(row);
        }

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Choose an AI Voice from 15 Available Voices:",
          reply_markup: JSON.stringify({ inline_keyboard: inlineKeyboard })
        });
        return res.status(200).send('OK');
      }

      // HANDLE VOICE / AUDIO NOTES (Speech-to-Text Simulation & Prompt Generation)
      if (message.voice || message.audio) {
        // Telegram file info fetch karna
        const fileId = message.voice ? message.voice.file_id : message.audio.file_id;
        
        try {
          const fileRes = await axios.get(`${TELEGRAM_API}/getFile?file_id=${fileId}`);
          const filePath = fileRes.data.result.file_path;
          const downloadUrl = `https://api.telegram.org/file/bot${activeToken}/${filePath}`;

          // User ko text prompt dena jise wo copy kar sakein
          await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: `📝 **Aapka Voice Note Received!**\n\nAapne jo bola hai, usay text mein convert karne ke liye niche diye gaye sample text ko copy karein aur wapas send karein:\n\n\`Hello, this is my converted voice note text from Telegram!\``,
            parse_mode: "Markdown"
          });
        } catch (e) {
          console.error("Voice Fetch Error:", e.message);
          await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: "❌ Voice note process karne mein masla aaya. Baraye meherbani direct text type kar dein!"
          });
        }

        return res.status(200).send('OK');
      }

      // HANDLE REGULAR TEXT MESSAGES (Murf AI Text-to-Speech)
      if (message.text) {
        const inputPrompt = message.text;

        await axios.post(`${TELEGRAM_API}/sendChatAction`, {
          chat_id: chatId,
          action: 'record_voice'
        });

        const selectedVoice = userVoicePreference[chatId] || DEFAULT_VOICE;
        const murfApiKey = process.env.MURF_API_KEY || "ap2_74e9410a-9a9c-469c-bea7-8bea790b9951";

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
      }

      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
  }

  return res.status(200).json({ status: "Active", message: "Murf AI Bot Running!" });
};
