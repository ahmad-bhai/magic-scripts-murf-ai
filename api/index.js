const axios = require('axios');

// In-Memory Storage for User Selected Voices
// (Note: Production mein aap Redis ya Database replace kar sakte hain)
const userVoicePreference = {};

// Popular Murf AI Voice Options List
const DEFAULT_VOICE = "Natalie";
const VOICE_OPTIONS = [
  { name: "Natalie (US Female)", id: "Natalie" },
  { name: "Marcus (US Male)", id: "Marcus" },
  { name: "Terrell (UK Male)", id: "Terrell" },
  { name: "Julia (UK Female)", id: "Julia" }
];

module.exports = async (req, res) => {
  const { action, token } = req.query;

  // Telegram API Base URL
  const TELEGRAM_API = `https://api.telegram.org/bot${token}`;

  // -------------------------------------------------------------
  // 1. INSTALL / RUN ROUTE: /api/v/{bot-token}/true
  // -------------------------------------------------------------
  if (action === 'install') {
    try {
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const webhookUrl = `${protocol}://${host}/api/webhook/${token}`;

      const response = await axios.post(`${TELEGRAM_API}/setWebhook`, {
        url: webhookUrl
      });

      return res.status(200).json({
        success: true,
        message: "Bot Webhook Successfully Installed and Running!",
        telegram_response: response.data
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // -------------------------------------------------------------
  // 2. UNINSTALL / STOP ROUTE: /api/{bot-token}/false
  // -------------------------------------------------------------
  if (action === 'stop') {
    try {
      const response = await axios.post(`${TELEGRAM_API}/deleteWebhook`);
      return res.status(200).json({
        success: true,
        message: "Bot Webhook Successfully Stopped/Uninstalled!",
        telegram_response: response.data
      });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  // -------------------------------------------------------------
  // 3. WEBHOOK LISTENER (Handling Incoming Bot Updates)
  // -------------------------------------------------------------
  if (action === 'webhook' && req.method === 'POST') {
    const update = req.body;

    // A. Handle Callback Query (When user clicks a Voice Button)
    if (update.callback_query) {
      const query = update.callback_query;
      const chatId = query.message.chat.id;
      const selectedVoice = query.data;

      // Save Voice Preference
      userVoicePreference[chatId] = selectedVoice;

      await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, {
        callback_query_id: query.id,
        text: `Voice updated to ${selectedVoice}! 🎙️`
      });

      await axios.post(`${TELEGRAM_API}/sendMessage`, {
        chat_id: chatId,
        text: `✅ **Voice Selected:** ${selectedVoice}\n\nAb koi bhi text message bhejein, main is voice mein audio convert kar doonga!`
      });

      return res.status(200).send('OK');
    }

    // B. Handle Text Messages
    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const text = update.message.text;

      // Command: /start
      if (text === '/start') {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: `Welcome to Murf AI Voiceover Bot! 🎙️\n\n- Text bhejein to convert it into speech.\n- Use /voice command to change the AI Voice.`
        });
        return res.status(200).send('OK');
      }

      // Command: /voice (Interactive Voice Selection Buttons)
      if (text === '/voice') {
        const inlineKeyboard = VOICE_OPTIONS.map(v => ([{
          text: v.name,
          callback_data: v.id
        }]));

        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "Select an AI Voice from the options below:",
          reply_markup: JSON.stringify({ inline_keyboard: inlineKeyboard })
        });
        return res.status(200).send('OK');
      }

      // Handle Speech Generation Request
      try {
        await axios.post(`${TELEGRAM_API}/sendChatAction`, {
          chat_id: chatId,
          action: 'record_voice'
        });

        // Fetch User Preference or Fallback to Default
        const selectedVoice = userVoicePreference[chatId] || DEFAULT_VOICE;

        // Call Murf AI API (Key added via Vercel Environment Variables)
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

        // Send Generated Audio Back to Telegram User
        await axios.post(`${TELEGRAM_API}/sendAudio`, {
          chat_id: chatId,
          audio: audioUrl,
          caption: `🎙️ Voice: ${selectedVoice} | Generated via Murf AI`
        });

      } catch (err) {
        console.error('Murf AI / Telegram Error:', err.response ? err.response.data : err.message);
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
          chat_id: chatId,
          text: "❌ Error generating audio. Please check your Murf API Key balance or try again."
        });
      }

      return res.status(200).send('OK');
    }

    return res.status(200).send('OK');
  }

  // Fallback Route Response
  return res.status(404).json({ error: "Invalid Endpoint" });
};
          
