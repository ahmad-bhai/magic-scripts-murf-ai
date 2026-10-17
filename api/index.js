const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { text, voiceId } = req.body || {};

      if (!text) {
        return res.status(400).json({ success: false, error: "Text is required!" });
      }

      const murfApiKey = process.env.MURF_API_KEY || "ap2_d20159bd-3aba-4def-837e-a884f91ab9b2";

      const response = await axios.post('https://api.murf.ai/v1/speech/generate', {
        text: text,
        voiceId: voiceId || "Priya",
        format: 'MP3'
      }, {
        headers: {
          'api-key': murfApiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.data && response.data.audioFile) {
        return res.status(200).json({
          success: true,
          audioUrl: response.data.audioFile
        });
      } else {
        return res.status(500).json({ success: false, error: "Invalid response from Murf API" });
      }
    } catch (error) {
      const errMessage = error.response && error.response.data 
        ? JSON.stringify(error.response.data) 
        : error.message;
      
      return res.status(500).json({ success: false, error: errMessage });
    }
  }

  return res.status(200).json({ status: "Active", message: "Murf AI TTS API Engine Ready!" });
};
