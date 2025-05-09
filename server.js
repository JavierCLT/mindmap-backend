const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();

app.use(cors());
app.use(express.json());

const client = new OpenAI({
    apiKey: process.env.GROK_API_KEY,
    baseURL: "https://api.x.ai/v1",
});

app.post('/generate', async (req, res) => {
  const { topic } = req.body;

  if (!topic) {
    return res.status(400).json({ error: 'Topic is required' });
  }

  try {
    const completion = await client.chat.completions.create({
      model: "grok-beta",
      messages: [
        {
          role: "system",
          content: "You are Grok, a highly intelligent, helpful AI assistant that helps users learn about any field of knowledge.",
        },
        {
          role: "user",
          content: `Create a mind map of ${topic} in markdown format. List topics as central ideas, main branches, and sub-branches.`,
        },
      ],
      max_tokens: 500 // Optional: adjust based on needs
    });

    const markdown = completion.choices[0]?.message.content;
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
