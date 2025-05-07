const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors()); // Allow CORS for your GitHub Pages frontend
app.use(express.json());

// Store your Grok API key securely in an environment variable
const GROK_API_KEY = process.env.GROK_API_KEY;

app.post('/generate', async (req, res) => {
  const { topic } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  try {
    // Call Grok's API to generate a mind map in markdown format
    const response = await axios.post('https://api.x.ai/grok/generate', {
      prompt: `Create a mind map in markdown format for the topic: ${topic}. List topics as central ideas, main branches, and sub-branches.`,
      api_key: GROK_API_KEY
    });

    const markdown = response.data.markdown;
    if (!markdown) {
      throw new Error('No markdown received from Grok API');
    }

    res.json({ markdown });
  } catch (error) {
    console.error('Error calling Grok API:', error.message);
    res.status(500).json({ error: 'Failed to generate mind map' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});