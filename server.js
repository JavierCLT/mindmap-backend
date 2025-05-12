import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { OpenAI } from "openai"

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(express.json())

// Configure CORS to only allow requests from the frontend domain
const corsOptions = {
  origin: ["https://javierclt.github.io", "http://localhost:3000"],
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

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

Make sure the mindmap is well-structured, hierarchical, and covers the most important aspects of the topic. The markdown should be clean and properly formatted for rendering with the Markmap library.`

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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
