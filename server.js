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
app.use(cors(corsOptions))

// Configure CORS to be more permissive
const corsOptions = {
  origin: [
    'https://JavierCLT.github.io', // Your GitHub username
    'https://JavierCLT.github.io/frontend', // Your specific repo
    'http://localhost:5173', // For local development
    'http://localhost:3000' // Alternative local development port
    ],
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
}

// Apply CORS middleware
app.use(express.json())

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

// Remove the custom CORS headers middleware and replace with this simpler version
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*")
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization")

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(204).end()
  }
  next()
})

// Initialize OpenAI client for Grok API
const openai = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
})

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "Mindmap Backend API is running" })
})

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
Your goal is to help users understand topics`

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
