// api/generate-mindmap.js
import { OpenAI } from "openai";
import { corsMiddleware } from '../utils/cors.js';
import { rateLimiter } from '../utils/rate-limiter.js';

// Initialize OpenAI client for Grok API
const openai = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

export default async function handler(req, res) {
  // Apply CORS headers
  corsMiddleware(req, res);
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Apply rate limiting
    const rateLimit = await rateLimiter(req);
    if (rateLimit.limited) {
      return res.status(429).json({ 
        error: "Too many requests", 
        message: "Too many requests, please try again after 15 minutes" 
      });
    }
    
    const { topic } = req.body;

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" });
    }

    console.log(`Generating mindmap for topic: ${topic}`);

    // Create the prompt for the Grok API
    const prompt = `Create a comprehensive mindmap in markdown format for the topic "${topic}".
    
Format the mindmap as follows:
- Use a single # for the main topic (the title)
- Use ## for main branches (key categories)
- Use ### for sub-branches (subcategories)
- Use #### for details under sub-branches (if needed)

For example, for "Artificial Intelligence":

# Artificial Intelligence
## Machine Learning
### Supervised Learning
### Unsupervised Learning
## Deep Learning
### Neural Networks
#### CNNs
#### RNNs

Make sure the mindmap is well-structured, hierarchical, and covers the most important aspects of the topic. 
The markdown should be clean and properly formatted for rendering with the Markmap library. 
Never include comments to introduce or summarize the content such as "Here is a detailed mindmap on "Brokerage Platforms in the US". 
The only content you generate is the structured markdown.
Your goal is to help users understand topics`;

    // Call the Grok API
    const completion = await openai.chat.completions.create({
      model: "grok-beta",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates well-structured mindmaps in markdown format.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    // Extract the markdown from the response
    const markdown = completion.choices[0]?.message?.content || "";

    if (!markdown) {
      throw new Error("Failed to generate mindmap content");
    }

    // Return the markdown to the frontend
    return res.status(200).json({ markdown });
  } catch (error) {
    console.error("Error generating mindmap:", error);
    return res.status(500).json({
      error: "Failed to generate mindmap",
      details: error.message,
    });
  }
}
