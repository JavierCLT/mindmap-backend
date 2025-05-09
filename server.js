// mindmap-backend/server.js
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

app.post('/generate-mindmap', async (req, res) => {
  const { topic } = req.body;
  const prompt = [
    {
      role: 'system',
      content: 'You are Grok, a highly intelligent, helpful AI assistant that helps users learn about any field of knowledge.'
    },
    {
      role: 'user',
      content: `Create a mind map of ${topic} in markdown format. List topics as central ideas, main branches, and sub-branches.`
    }
  ];

  try {
    const response = await axios.post('https://api.x.ai/v1/chat/completions', { // Adjust URL based on actual Grok API
      messages: prompt,
      model: 'grok', // Adjust model name as needed
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const markdown = response.data.choices[0].message.content; // Adjust based on actual response structure
    res.json({ markdown });
  } catch (error) {
    console.error('Error calling Grok API:', error);
    res.status(500).json({ error: 'Failed to generate mindmap' });
  }
});

const cors = require('cors');
app.use(cors({ origin: 'https://JavierCLT.github.io' }));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
