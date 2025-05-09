// mindmap-backend/server.js
const express = require('express');
const OpenAI = require('openai');
const cors = require('cors');

const app = express();

// Enable CORS for your front-end domain
app.use(cors({ origin: 'https://javierclt.github.io' }));
app.use(express.json());

// Create an instance of the OpenAI client with Grok API settings
const client = new OpenAI({
    apiKey: process.env.GROK_API_KEY,  // Store your API key securely in environment variables
    baseURL: 'https://api.x.ai/v1',
});

// Define the POST endpoint for generating mindmaps
app.post('/generate-mindmap', async (req, res) => {
    const { topic } = req.body;

    // Construct the prompt for the Grok API
    const messages = [
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
        // Call the Grok API using the OpenAI client
        const completion = await client.chat.completions.create({
            model: 'grok-beta',
            messages: messages,
        });

        // Extract the markdown from the response
        const markdown = completion.choices[0].message.content;
        res.json({ markdown });
    } catch (error) {
        console.error('Error calling Grok API:', error);
        res.status(500).json({ error: 'Failed to generate mindmap' });
    }
});

// Start the server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
