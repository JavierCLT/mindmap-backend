// mindmap-backend/server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors'); // Import CORS at the top

const app = express();

// Enable CORS for your front-end domain (move this before routes)
app.use(cors({ origin: 'https://JavierCLT.github.io' }));
app.use(express.json());

// Define the POST endpoint
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
    const response = await axios.post('https://api.x.ai/v1', {
      messages: prompt,
      model: 'grok', // Verify this model name with Grok API docs
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const markdown = response.data.choices[0].message.content; // Verify response structure
    res.json({ markdown });
  } catch (error) {
    console.error('Error calling Grok API:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to generate mindmap' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
