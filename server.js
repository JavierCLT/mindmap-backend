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
app.use(
  cors({
    origin: "https://JavierCLT.github.io",
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
)

// Initialize Grok API client
const grokClient = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
})

// Generate mindmap endpoint
app.post("/generate-mindmap", async (req, res) => {
  try {
    const { topic } = req.body

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" })
    }

    console.log(`Generating mindmap for topic: ${topic}`)

    const prompt = `Create a comprehensive mindmap in markdown format for the topic "${topic}".
    
Use the following format:
# ${topic}
## Main Branch 1
### Sub-branch 1.1
### Sub-branch 1.2
## Main Branch 2
### Sub-branch 2.1
### Sub-branch 2.2

Make sure to include at least 5-7 main branches and 2-4 sub-branches for each main branch.
The mindmap should be detailed but concise, with each branch and sub-branch being 1-5 words.
Do not include any explanatory text, only the hierarchical markdown structure.`

    const response = await grokClient.chat.completions.create({
      model: "grok-beta",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates well-structured mindmaps in markdown format.",
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    })

    const markdown = response.choices[0].message.content.trim()
    console.log("Mindmap generated successfully")

    return res.status(200).json({ markdown })
  } catch (error) {
    console.error("Error generating mindmap:", error)
    return res.status(500).json({
      error: "Failed to generate mindmap",
      details: error.message,
    })
  }
})

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).send("Mindmap Maker API is running")
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
