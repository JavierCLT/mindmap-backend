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

// Initialize OpenAI client for Grok API
const openai = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
})

// Configuration for different detail levels
const DETAIL_LEVELS = {
  normal: {
    name: "Normal",
    maxTokens: 1200,
    systemMessage: "You are a helpful assistant that creates BASIC, SIMPLE mindmaps. Keep the fourth level to 1-3 words maximum. Be concise and minimal.",
    description: "Minimal detail, 1-3 words at lowest level"
  },
  detailed: {
    name: "Detailed", 
    maxTokens: 2500,
    systemMessage: "You are a helpful assistant that creates DETAILED mindmaps with good examples and specifics. Provide helpful ranges, examples, and moderate detail at the fourth level.",
    description: "Good examples with specific ranges and details"
  },
  ultra: {
    name: "Ultra Detailed",
    maxTokens: 4000,
    systemMessage: "You are a helpful assistant that creates ULTRA-DETAILED, COMPREHENSIVE mindmaps. Be extremely specific with names, prices, companies, step-by-step instructions, and extensive details at the fourth level.",
    description: "Extremely comprehensive with specific names, prices, and step-by-step details"
  }
}

// Function to generate prompt based on detail level
const generatePrompt = (topic, detailLevel) => {
  const config = DETAIL_LEVELS[detailLevel] || DETAIL_LEVELS.normal
  
  if (detailLevel === 'normal') {
    return `Create a BASIC mindmap in markdown format for the topic "${topic}".

IMPORTANT: Keep this SIMPLE and CONCISE. This is the "normal" version - use minimal detail.

Format requirements:
- Use # for main topic
- Use ## for main branches (4-6 branches maximum)
- Use ### for sub-branches (2-3 per branch maximum)  
- Use #### for brief points only (1-2 words or very short phrases)

Example for "Plan a Wedding Event":
# Plan a Wedding Event
## Planning
### Budget
#### Venue costs
#### Food costs
### Guest List
#### Family
#### Friends
## Event Day
### Ceremony
#### Timing
#### Officiant
### Reception  
#### Food
#### Music

Keep all fourth-level items to 1-3 words maximum. Be concise and basic.`
  }
  
  if (detailLevel === 'detailed') {
    return `Create a DETAILED mindmap in markdown format for the topic "${topic}".

This is the "detailed" version - provide good examples and specifics.

Format requirements:
- Use # for main topic
- Use ## for main branches (6-8 branches)
- Use ### for sub-branches (3-4 per branch)
- Use #### for specific examples with some detail

Example for "Plan a Wedding Event":
# Plan a Wedding Event
## Pre-Wedding Planning
### Budgeting
#### Venue: $3000-8000 depending on location
#### Catering: $40-60 per person for dinner
#### Photography: $1000-3000 professional package
### Venue Selection
#### Outdoor: Parks, gardens, beaches
#### Indoor: Hotels, churches, event halls
### Guest Management
#### Create guest list of 50-150 people
#### Send invitations 6-8 weeks early
## Wedding Day Logistics
### Ceremony Setup
#### 30-60 minute ceremony duration
#### Hire officiant (religious or civil)
#### Arrange seating for guests
### Reception Planning
#### Choose buffet or plated dinner service
#### Book DJ or live band entertainment
#### Plan first dance and special moments

Provide helpful specifics and ranges at the fourth level.`
  }
  
  if (detailLevel === 'ultra') {
    return `Create an ULTRA-DETAILED comprehensive mindmap in markdown format for the topic "${topic}".

This is the "ultra" version - be extremely comprehensive with specific examples, prices, names, and detailed steps.

Format requirements:
- Use # for main topic
- Use ## for main branches (8-12 branches)
- Use ### for sub-branches (4-6 per branch)
- Use #### for very specific details, examples, prices, company names, step-by-step instructions

Example for "Plan a Wedding Event":
# Plan a Wedding Event
## Pre-Wedding Planning Phase
### Comprehensive Budgeting
#### Venue Costs: $5000 for Lakeside Pavilion, $3000 for Historic Church Hall, $8000 for Grand Hotel Ballroom
#### Catering Services: $50 per person for Italian buffet with pasta station, $2000 for three-tier wedding cake from Sweet Dreams Bakery
#### Photography Package: Jane Doe Photography $1500 includes 6 hours coverage and 200 edited photos, videographer add-on $800
#### Floral Arrangements: $1200 for bridal bouquet, bridesmaids bouquets, and centerpieces from Bloom & Blossom Florists
### Detailed Venue Selection Process
#### Outdoor Venue Options: Lakeside Park available June-September, Botanical Gardens with rose ceremony arch, Beach venue requires tent rental $600
#### Indoor Venue Alternatives: Grand Hotel Ballroom seats 150 guests with chandelier lighting, Historic Church with organ music included
#### Venue Booking Timeline: Reserve 12 months ahead for popular venues, pay 50% deposit to secure date, final payment due 30 days before event
### Complete Guest Management System
#### Family Guest List: Invite 50 immediate family members, create RSVP tracking spreadsheet, send save-the-dates 4 months early
#### Friends and Colleagues: 30 close friends from college, 20 work colleagues, use digital invitations through Paperless Post to save costs
#### Guest Accommodation: Block 20 hotel rooms at nearby Marriott, provide welcome bags with local treats and wedding timeline

Be extremely specific with names, prices, timeframes, and step-by-step details at the fourth level.`
  }
}

// Health check endpoint
app.get("/", (req, res) => {
  const apiKeyConfigured = !!process.env.GROK_API_KEY;
  
  res.status(200).json({ 
    status: "ok", 
    message: "Mindmap Backend API is running",
    apiKeyConfigured: apiKeyConfigured,
    environment: process.env.NODE_ENV || 'development',
    availableDetailLevels: Object.keys(DETAIL_LEVELS).map(key => ({
      key,
      name: DETAIL_LEVELS[key].name,
      maxTokens: DETAIL_LEVELS[key].maxTokens
    })),
    endpoints: [
      "POST /generate-mindmap - With optional detailLevel parameter (normal, detailed, ultra)"
    ]
  });
});

// Main mindmap generation endpoint with detail level support
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
    console.log(`Generating ${config.name} mindmap for topic: ${topic}`)

    const prompt = generatePrompt(topic, detailLevel)

    // Call the Grok API
    const completion = await openai.chat.completions.create({
      model: "grok-beta",
      messages: [
        {
          role: "system",
          content: config.systemMessage,
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: config.maxTokens,
    })

    // Extract the markdown from the response
    const markdown = completion.choices[0]?.message?.content || ""

    if (!markdown) {
      throw new Error("Failed to generate mindmap content")
    }

    // Return the markdown to the frontend
    res.status(200).json({ 
      markdown,
      detailLevel,
      detailLevelName: config.name,
      tokensUsed: completion.usage?.total_tokens || "unknown",
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

// Legacy endpoints for backward compatibility
app.post("/generate-mindmap-ultra", async (req, res) => {
  req.body.detailLevel = "ultra"
  return app._router.handle({ ...req, url: "/generate-mindmap", method: "POST" }, res)
})

// Handle OPTIONS requests explicitly
app.options("*", cors(corsOptions))

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
  console.log('Available detail levels:')
  Object.entries(DETAIL_LEVELS).forEach(([key, config]) => {
    console.log(`- ${key}: ${config.name} (${config.maxTokens} tokens)`)
  })
})
