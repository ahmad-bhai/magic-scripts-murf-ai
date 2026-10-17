const axios = require('axios');

// User preferences storage (Voice & Language)
const userVoicePreference = {};
const userLangPreference = {};

// Default Fallback Voice
const DEFAULT_VOICE = "Priya"; // Native South Asian tone for Roman Urdu

// Language & Voice Catalog Mapping
const LANGUAGE_VOICES = {
  "English": [
    { name: "Natalie (US Female)", id: "Natalie" },
    { name: "Marcus (US Male)", id: "Marcus" },
    { name: "Julia (UK Female)", id: "Julia" },
    { name: "Terrell (UK Male)", id: "Terrell" }
  ],
  "Hindi": [
    { name: "Ananya (Hindi Female)", id: "Ananya" },
    { name: "Kabir (Hindi Male)", id: "Kabir" },
    { name: "Aditi (Hindi Soft)", id: "Aditi" },
    { name: "Karan (Hindi Male)", id: "Karan" }
  ],
  "Urdu": [
    { name: "Priya (Urdu/Hindi Accent)", id: "Priya" },
    { name: "Aarav (Urdu/Hindi Accent)", id: "Aarav" }
  ],
  "Roman_Urdu": [
    { name: "Priya (Desi Natural)", id: "Priya" },
    { name: "Aarav (Desi Natural)", id: "Aarav" },
    { name: "Samantha (Casual Accent)", id: "Samantha" },
    { name: "Ken (Smooth Accent)", id: "Ken" }
  ]
};

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
  // 1. WEBHOOK INSTALLATION
  // -------------------------------------------------------------
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

  // -------------------------------------------------------------
  // 2. INCOMING TELEGRAM WEBHOOK MESSAGES
  // -------------------------------------------------------------
  if (req.method === 'POST') {
    const activeToken = token;
    if (!activeToken) return res.status(400).json({ error: "No Token Provided" });

    const TELEGRAM_API = `https://api.telegram.org/bot${activeToken}`;
    const update = req.body || {};

    // A. Handle Inline Buttons (Language & Voice Selection)
    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message.chat.id;
      const data = query.data;

      // Check if Language Selected
      if (data.startsWith('LANG_')) {
        const selectedLang = data.replace('LANG_', '');
        userLangPreference[chatId] = selectedLang;

        const voices = LANGUAGE_VOICES[selectedLang] || LANGUAGE_VOICES["Roman_Urdu"];
        const inlineKeyboard = voices.map(v => ([{
          text: v.name,
          callback_data: `VOICE_${v.id}`
        }]));

        await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
          callback_query_id: query.id,
          text: `Language set to ${selectedLang.replace('_', ' ')}!`
        });

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `🌐 **Language Selected:** ${selectedLang.replace('_', ' ')}\n\nAb niche diye gaye AI Voices mein se apni pasandida voice select karein:`,
          reply_markup: JSON.stringify({ inline_keyboard: inlineKeyboard })
        });

        return res.status(200).send('OK');
      }

      // Check if Voice Selected
      if (data.startsWith('VOICE_')) {
        const selectedVoice = data.replace('VOICE_', '');
        userVoicePreference[chatId] = selectedVoice;

        await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
          callback_query_id: query.id,
          text: `Voice set to ${selectedVoice}! 🎙️`
        });

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `✅ **Voice Selected:** ${selectedVoice}\n\nAb aap text message send karein, bot is Desi/Native Voice mein audio generate karke dega!`
        });

        return res.status(200).send('OK');
      }

      return res.status(200).send('OK');
    }

    // B. Handle Text Commands & Messages
    if (update.message) {
      const chatId = update.message.chat.id;
      const message = update.message;

      // Command: /start
      if (message.text === '/start') {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `Welcome to Murf AI Multi-Language Voice Bot! 🎙️\n\n- /lang command se apni Language (English, Hindi, Urdu, Roman Urdu) select karein.\n- Phir text type karke bhejein, bot perfect accent mein bol kar sunaye ga!`
        });
        return res.status(200).send('OK');
      }

      // Command: /lang or /voice (Language Selector Menu)
      if (message.text === '/lang' || message.text === '/voice') {
        const langKeyboard = [
          [{ text: "🇬🇧 English", callback_data: "LANG_English" }],
          [{ text: "🇮🇳 Hindi (हिन्दी)", callback_data: "LANG_Hindi" }],
          [{ text: "🇵🇰 Urdu (اردو)", callback_data: "LANG_Urdu" }],
          [{ text: "🗣️ Roman Urdu (Desi Accent)", callback_data: "LANG_Roman_Urdu" }]
        ];

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Select your preferred Language / Accent:",
          reply_markup: JSON.stringify({ inline_keyboard: langKeyboard })
        });
        return res.status(200).send('OK');
      }

      // Handle Voice Note / Audio Messages
      if (message.voice || message.audio) {
        const fileId = message.voice ? message.voice.file_id : message.audio.file_id;
        
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `🎙️ **Voice Received!**\n\nIs voice message ko jis text mein convert karke audio banani hai, wo text niche reply/type kar dein!`,
          parse_mode: "Markdown"
        });
        return res.status(200).send('OK');
      }

      // Process Text Messages to Voiceover
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
          caption: `🎙️ Voice: ${selectedVoice} | Generated via MAGIC SCRIPTS`
        });
      }

      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
  }

  return res.status(200).json({ status: "Active", message: "Multi-Language Murf AI Bot Active!" });
};
