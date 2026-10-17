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
      const { audioBase64, voiceId } = req.body || {};

      if (!audioBase64) {
        return res.status(400).json({ 
          success: false, 
          error: "Audio file payload is required!" 
        });
      }

      const murfApiKey = process.env.MURF_API_KEY || "ap2_d20159bd-3aba-4def-837e-a884f91ab9b2";

      const response = await axios.post('https://api.murf.ai/v1/speech/change-voice', {
        audio: audioBase64,
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
        return res.status(500).json({
          success: false,
          error: "Failed to convert voice via Murf API."
        });
      }
    } catch (error) {
      const errMessage = error.response && error.response.data 
        ? JSON.stringify(error.response.data) 
        : error.message;
      
      console.error('API Error:', errMessage);
      return res.status(500).json({
        success: false,
        error: errMessage
      });
    }
  }

  return res.status(200).json({ 
    success: true, 
    message: "Voice Changer API Engine Ready!" 
  });
};
