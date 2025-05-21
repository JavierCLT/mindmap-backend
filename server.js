import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { OpenAI } from "openai"
import rateLimit from "express-rate-limit"

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(express.json())

// Configure CORS to be more permissive
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://javierclt.github.io',
      'http://localhost:5173',
      'http://localhost:3000',
      'https://www.mind-map-maker.com',
      'https://mind-map-maker.com',
      'http://www.mind-map-maker.com',
      'http://mind-map-maker.com'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('vercel.app')) {
      callback(null, true);
    } else {
      console.log('CORS blocked for origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
}
//3. Debugging Middleware
//Add a debugging middleware to log all incoming requests:

// Add this before your routes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Origin:', req.headers.origin);
  console.log('Referer:', req.headers.referer);
  next();
});
//4. Explicit Error Response Format
//Make sure your error responses are consistent:

app.post("/generate-mindmap", async (req, res) => {
  try {
    // ... existing code ...
  } catch (error) {
    console.error("Error generating mindmap:", error);
    
    // More detailed error response
    res.status(500).json({
      error: "Failed to generate mindmap",
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});
//5. Health Check Enhancement
//Improve your health check to verify the API key is set:

app.get("/", (req, res) => {
  const apiKeyConfigured = !!process.env.GROK_API_KEY;
  
  res.status(200).json({ 
    status: "ok", 
    message: "Mindmap Backend API is running",
    apiKeyConfigured: apiKeyConfigured,
    environment: process.env.NODE_ENV || 'development'
  });
});
//6. Preflight Request Handling
//Ensure your OPTIONS handling is correct:

// This should be before your routes
app.options('*', cors(corsOptions));
// Recommendation
// After making these changes, deploy your backend and test it with a simple request. You can use a tool like Postman or a simple curl command to test the API directly:

curl -X POST https://mindmap-backend-five.vercel.app/generate-mindmap \
  -H "Content-Type: application/json" \
  -d '{"topic":"test topic"}'
// This will help you determine if the issue is with your backend configuration or with how the frontend is making the request.

Chat Input

// Apply CORS middleware
app.use(cors(corsOptions))

// Configure rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // limit each IP to 30 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: "Too many requests, please try again after 15 minutes"
})

// Apply rate limiting to all requests
app.use(limiter)


// Initialize OpenAI client for Grok API
const openai = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
})

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "Mindmap Backend API is running", environment: process.env.NODE_ENV || 'production' });
});

// Mindmap generation endpoint
app.post("/generate-mindmap", async (req, res) => {
  try {
    const { topic } = req.body

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" })
    }

    console.log(`Generating mindmap for topic: ${topic}`)

    // Create the prompt for the Grok API
    const prompt = `Create a comprehensive mindmap in markdown format for the topic "${topic}".
    
Format the mindmap as follows:
- Use a single # for the main topic (the title)
- Use ## for main branches (key categories)
- Use ### for sub-branches (subcategories)
- Use #### for details under sub-branches 

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
Including the topic, the markdown structure can only have up to 4 levels. Never include a 5th level of identation in the markdown.
The markdown should be clean and properly formatted for rendering with the Markmap library. 
Never include comments to introduce or summarize the content such as "Here is a detailed mindmap on "Brokerage Platforms in the US". 
The only content you generate is the structured markdown.
Your goal is to help users understand topics. Mind maps are visual tools used for capturing, organizing, and visualizing ideas and information. 
They help users understand concepts by breaking them down into their component parts and showing the relationships between them. 
Mind maps are used for brainstorming, note-taking, problem-solving, decision-making, and even as a study aid`

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
      max_tokens: 10000,
    })

    // Extract the markdown from the response
    const markdown = completion.choices[0]?.message?.content || ""

    if (!markdown) {
      throw new Error("Failed to generate mindmap content")
    }

    // Return the markdown to the frontend
    res.status(200).json({ markdown })
  } catch (error) {
    console.error("Error generating mindmap:", error)
    res.status(500).json({
      error: "Failed to generate mindmap",
      details: error.message,
    })
  }
})

// Handle OPTIONS requests explicitly
app.options("/generate-mindmap", cors(corsOptions), (req, res) => {
  res.status(204).send()
})

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
