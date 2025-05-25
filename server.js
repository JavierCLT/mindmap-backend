import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import Anthropic from "@anthropic-ai/sdk"
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

// Debugging Middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Origin:', req.headers.origin);
  console.log('Referer:', req.headers.referer);
  next();
});

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

// Initialize Claude client
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY, // You'll need to set this in your environment
})

// Configuration for different detail levels
const DETAIL_LEVELS = {
  normal: {
    name: "Normal",
    maxTokens: 1500,
    model: "claude-3-5-haiku-20241022", // Latest Haiku for basic requests
    systemMessage: "You are a helpful assistant that creates concise, well-structured mindmaps. For normal detail level, keep fourth-level items brief and essential - use only 1-3 words or very short phrases.",
    description: "Basic overview with minimal detail"
  },
  detailed: {
    name: "Detailed", 
    maxTokens: 3000,
    model: "claude-3-7-sonnet-20250219", // Latest Sonnet 3.7 for detailed requests
    systemMessage: "You are a helpful assistant that creates comprehensive mindmaps with good detail. For detailed level, provide helpful examples, ranges, and specific information at the fourth level.",
    description: "Comprehensive with good examples and specifics"
  },
  ultra: {
    name: "Ultra Detailed",
    maxTokens: 4000,
    model: "claude-sonnet-4-20250514", // Latest Sonnet 4 for ultra-detailed requests
    systemMessage: "You are a helpful assistant that creates extremely detailed, comprehensive mindmaps. For ultra detail level, provide extensive specific examples, exact prices, company names, step-by-step instructions, and comprehensive details at the fourth level.",
    description: "Extremely comprehensive with specific examples and details"
  }
}

// Function to generate prompt based on detail level
const generatePrompt = (topic, detailLevel) => {
  if (detailLevel === 'normal') {
    return `Create a basic mindmap in markdown format for the topic "${topic}".

REQUIREMENTS FOR NORMAL DETAIL LEVEL:
- Keep this simple and concise
- Use # for main topic
- Use ## for main branches (4-6 maximum)
- Use ### for sub-branches (2-3 per branch)
- Use #### for brief points ONLY (1-3 words maximum)

Example structure:
# Plan a Wedding Event
## Planning
### Budget
#### Venue costs
#### Catering
### Guests
#### Family list
#### Friend list
## Event Day
### Ceremony
#### Timing
#### Officiant
### Reception
#### Food service
#### Entertainment

Keep ALL fourth-level items to 1-3 words. Be minimal and concise.`
  }
  
  if (detailLevel === 'detailed') {
    return `Create a detailed mindmap in markdown format for the topic "${topic}".

REQUIREMENTS FOR DETAILED LEVEL:
- Provide good examples and specifics
- Use # for main topic
- Use ## for main branches (6-8 branches)
- Use ### for sub-branches (3-4 per branch)
- Use #### for specific examples with helpful detail

Example structure:
# Plan a Wedding Event
## Pre-Wedding Planning
### Budgeting
#### Venue: $3000-8000 depending on location
#### Catering: $40-60 per person for dinner
#### Photography: $1000-3000 professional package
### Guest Management
#### Create list of 50-150 people
#### Send invitations 6-8 weeks early
#### Track RSVPs with spreadsheet
## Wedding Day Logistics
### Ceremony Setup
#### 30-60 minute ceremony duration
#### Hire officiant (religious or civil)
#### Arrange seating for 100+ guests

Provide helpful specifics, ranges, and practical examples at the fourth level.`
  }
  
  if (detailLevel === 'ultra') {
    return `Create an ultra-detailed comprehensive mindmap in markdown format for the topic "${topic}".

REQUIREMENTS FOR ULTRA DETAIL LEVEL:
- Be extremely comprehensive and specific
- Use # for main topic
- Use ## for main branches (8-12 branches)
- Use ### for sub-branches (4-6 per branch)
- Use #### for very specific details with exact examples

Example structure:
# Plan a Wedding Event
## Pre-Wedding Planning Phase
### Comprehensive Budgeting
#### Venue Costs: $5000 for Lakeside Pavilion, $3000 for Historic Church Hall, $8000 for Grand Hotel Ballroom
#### Catering Services: $50 per person for Italian buffet with pasta station, $2000 for three-tier cake from Sweet Dreams Bakery
#### Photography: Jane Doe Photography $1500 for 6 hours plus 200 edited photos, videographer upgrade $800
### Detailed Venue Selection
#### Outdoor Options: Lakeside Park (June-Sept availability), Botanical Gardens with rose arch, Beach venue requires $600 tent rental
#### Indoor Alternatives: Grand Hotel Ballroom seats 150 with chandelier lighting, Historic Church includes organ music
### Complete Guest Management
#### Family Invitations: 50 immediate family members, create RSVP tracking in Google Sheets, mail save-the-dates 4 months prior
#### Friends and Colleagues: 30 college friends, 20 work colleagues, use Paperless Post digital invites to save $200

Be extremely specific with exact prices, company names, timeframes, and step-by-step instructions.`
  }
}

// Health check endpoint
app.get("/", (req, res) => {
  const apiKeyConfigured = !!process.env.CLAUDE_API_KEY;
  
  res.status(200).json({ 
    status: "ok", 
    message: "Mindmap Backend API is running with Claude",
    apiProvider: "Anthropic Claude",
    apiKeyConfigured: apiKeyConfigured,
    environment: process.env.NODE_ENV || 'development',
    availableDetailLevels: Object.keys(DETAIL_LEVELS).map(key => ({
      key,
      name: DETAIL_LEVELS[key].name,
      model: DETAIL_LEVELS[key].model,
      maxTokens: DETAIL_LEVELS[key].maxTokens,
      description: DETAIL_LEVELS[key].description
    })),
    endpoints: [
      "POST /generate-mindmap - With optional detailLevel parameter (normal, detailed, ultra)"
    ]
  });
});

// Main mindmap generation endpoint with Claude
app.post("/generate-mindmap", async (req, res) => {
  try {
    const { topic, detailLevel = "normal" } = req.body

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" })
    }

    if (!DETAIL_LEVELS[detailLevel]) {
      return res.status(400).json({ 
        error: "Invalid detail level", 
        validLevels: Object.keys(DETAIL_LEVELS)
      })
    }

    const config = DETAIL_LEVELS[detailLevel]
    console.log(`Generating ${config.name} mindmap for topic: ${topic} using model: ${config.model}`)

    const prompt = generatePrompt(topic, detailLevel)

    // Call Claude API
    const message = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: 0.2,
      system: config.systemMessage,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })

    // Extract the markdown from the response
    const markdown = message.content[0]?.text || ""

    if (!markdown) {
      throw new Error("Failed to generate mindmap content")
    }

    // Return the markdown to the frontend
    res.status(200).json({ 
      markdown,
      detailLevel,
      detailLevelName: config.name,
      model: config.model,
      tokensUsed: message.usage?.input_tokens + message.usage?.output_tokens || "unknown",
      inputTokens: message.usage?.input_tokens || 0,
      outputTokens: message.usage?.output_tokens || 0,
      maxTokensAllowed: config.maxTokens
    })
  } catch (error) {
    console.error(`Error generating ${req.body.detailLevel || 'normal'} mindmap:`, error)
    res.status(500).json({
      error: "Failed to generate mindmap",
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    })
  }
})

// Handle OPTIONS requests explicitly
app.options("*", cors(corsOptions))

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log('Using Anthropic Claude API')
  console.log('Available detail levels:')
  Object.entries(DETAIL_LEVELS).forEach(([key, config]) => {
    console.log(`- ${key}: ${config.name} (${config.model}, ${config.maxTokens} tokens)`)
  })
})
