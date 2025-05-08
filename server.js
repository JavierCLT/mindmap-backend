const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const GROK_API_KEY = process.env.GROK_API_KEY;

app.get('/generate', (req, res) => {
  res.status(405).json({ error: 'Method Not Allowed. Use POST to generate a mind map.' });
});

app.post('/generate', async (req, res) => {
  const { topic } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  try {
    const response = await axios.post(
      'https://api.x.ai/v1/chat/completions', // Updated endpoint
      {
        prompt: `Create a mind map in markdown format for the topic: ${topic}. List topics as central ideas, main branches, and sub-branches.`,
      },
      {
        headers: {
          'Authorization': `Bearer ${GROK_API_KEY}`, // API key in headers
          'Content-Type': 'application/json'
        }
      }
    );

    const markdown = response.data.markdown || response.data.text; // Adjust based on actual response format
    if (!markdown) {
      throw new Error('No markdown received from Grok API');
    }

    res.json({ markdown });
  } catch (error) {
    console.error('Error calling Grok API:', error.message);
    res.status(500).json({ error: 'Failed to generate mind map' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
