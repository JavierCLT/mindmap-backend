import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'https://javierclt.github.io',
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}));

// Initialize OpenAI client for Grok API
const openai = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: 'https://api.x.ai/v1'
});

// Generate mindmap endpoint
app.post('/generate-mindmap', async (req, res) => {
  try {
    const { topic } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }
    
    console.log(`Generating mindmap for topic: ${topic}`);
    
    // Create prompt for Grok API
    const prompt = `Create a detailed mindmap in markdown format for the topic "${topic}".
    
    Use the following format:
    # ${topic}
    ## Main Branch 1
    ### Sub-branch 1.1
    ### Sub-branch 1.2
    ## Main Branch 2
    ### Sub-branch 2.1
    ### Sub-branch 2.2
    
    Make sure to:
    1. Use # for the main topic
    2. Use ## for main branches (at least 4-6 main branches)
    3. Use ### for sub-branches (at least 2-3 sub-branches per main branch)
    4. Be comprehensive but concise
    5. Only output the markdown, no explanations or other text
    
    The markdown should be hierarchical and well-structured for visualization with the Markmap library.`;
    
    // Call Grok API
    const completion = await openai.chat.completions.create({
      model: 'grok-beta',
      messages: [
        { role: 'system', content: 'You are a mindmap generation assistant. You create well-structured, hierarchical mindmaps in markdown format.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });
    
    // Extract markdown from response
    const markdown = completion.choices[0].message.content.trim();
    
    // Validate markdown structure
    if (!markdown.startsWith('# ')) {
      console.error('Invalid markdown format received from API');
      return res.status(500).json({ error: 'Failed to generate valid mindmap structure' });
    }
    
    console.log('Mindmap generated successfully');
    
    // Return the markdown
    return res.json({ markdown });
    
  } catch (error) {
    console.error('Error generating mindmap:', error);
    return res.status(500).json({ 
      error: 'Failed to generate mindmap',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
