const axios = require('axios');
const formidable = require('formidable');
const fs = require('fs');

export const config = {
  api: {
    bodyParser: false, // Disabling Vercel body parser to handle file upload stream
  },
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const form = new formidable.IncomingForm();

    form.parse(req, async (err, fields, files) => {
      if (err) {
        return res.status(500).json({ success: false, error: "File upload parsing failed" });
      }

      const voiceId = fields.voiceId || "Priya";
      const uploadedFile = files.audio;

      if (!uploadedFile) {
        return res.status(400).json({ success: false, error: "No audio file provided!" });
      }

      const murfApiKey = process.env.MURF_API_KEY || "ap2_d20159bd-3aba-4def-837e-a884f91ab9b2";

      try {
        // Murf AI Speech-to-Speech / Voice Changer API Call
        const fileStream = fs.createReadStream(uploadedFile.filepath);

        const response = await axios.post('https://api.murf.ai/v1/speech/change-voice', {
          voiceId: voiceId,
          format: 'MP3'
        }, {
          headers: {
            'api-key': murfApiKey,
            'Content-Type': 'multipart/form-data'
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
            error: "Failed to convert voice via API"
          });
        }
      } catch (error) {
        console.error('Voice Changer Error:', error.response ? error.response.data : error.message);
        return res.status(500).json({
          success: false,
          error: error.response && error.response.data ? JSON.stringify(error.response.data) : error.message
        });
      }
    });
    return;
  }

  return res.status(200).json({ status: "Active", message: "Voice Changer Engine Ready!" });
};
