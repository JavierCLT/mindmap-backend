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
  apiKey: process.env.CLAUDE_API_KEY,
})

// Configuration for different detail levels - UPDATED WITH BETTER DIFFERENTIATION
const DETAIL_LEVELS = {
  normal: {
    name: "Normal",
    maxTokens: 800,
    model: "claude-3-5-haiku-20241022",
    systemMessage: "You are creating a MINIMAL mindmap. Use only 1-3 words for EVERY fourth-level item (####). NO descriptions, NO colons, NO examples. Total output must be under 25 lines. Be extremely concise - just keywords only.",
    temperature: 0.1
  },
  detailed: {
    name: "Detailed", 
    maxTokens: 3000,
    model: "claude-3-5-sonnet-20241022",
    systemMessage: "You are creating a DETAILED mindmap. Every fourth-level item (####) MUST be 10-20 words with practical information, tips, examples, or methods. Include specific details, ranges, and actionable advice. Total output should be 60-80 lines.",
    temperature: 0.2
  },
  ultra: {
    name: "Ultra Detailed",
    maxTokens: 4000,
    model: "claude-3-5-sonnet-20241022",
    systemMessage: "You are creating an ULTRA-DETAILED mindmap. Every fourth-level item (####) MUST be 20-40 words. Include exact prices, company names, step-by-step instructions, multiple options, statistics, timeframes, and expert tips. Be exhaustive. Total output should be 100-150+ lines.",
    temperature: 0.3
  }
}

// CRITICAL: Updated generatePrompt function with VERY SPECIFIC requirements
const generatePrompt = (topic, detailLevel) => {
  if (detailLevel === 'normal') {
    return `Create a MINIMAL mindmap for "${topic}".

CRITICAL REQUIREMENTS:
- Use # for main topic
- Use ## for exactly 4 main branches
- Use ### for exactly 2 sub-branches per main branch
- Use #### for exactly 2-3 items per sub-branch
- EVERY #### item must be 1-3 words ONLY
- NO colons (:), NO descriptions, NO examples
- Total lines must be under 25

Example of correct format:
# Topic
## Branch1
### Sub1
#### Word1
#### Word2
### Sub2
#### Word3
## Branch2
### Sub3
#### Word4
#### Word5

REMEMBER: Maximum 3 words per #### item. Be extremely minimal.`;
  }
  
  if (detailLevel === 'detailed') {
    return `Create a DETAILED mindmap for "${topic}".

CRITICAL REQUIREMENTS:
- Use # for main topic
- Use ## for 6-8 main branches
- Use ### for 3-4 sub-branches per main branch
- Use #### for 3-4 items per sub-branch
- EVERY #### item MUST be 10-20 words
- Include practical tips, examples, methods, ranges, and specific advice
- Total output should be 60-80 lines

Example of correct format:
# Topic
## Category 1
### Subcategory 1
#### Detailed explanation with practical example, including specific tips and actionable advice for implementation
#### Another comprehensive point with methods, tools like Mint or YNAB, and expected outcomes
#### Specific technique with step-by-step approach, timeframes like 2-3 weeks, and success metrics

REMEMBER: Each #### must be 10-20 words with practical, actionable information.`;
  }
  
  if (detailLevel === 'ultra') {
    return `Create an ULTRA-DETAILED, EXHAUSTIVE mindmap for "${topic}".

CRITICAL REQUIREMENTS:
- Use # for main topic
- Use ## for 10-12 main branches (comprehensive coverage)
- Use ### for 4-6 sub-branches per main branch
- Use #### for 4-6 items per sub-branch
- EVERY #### item MUST be 20-40 words
- Include ALL of these: exact prices, company names, step-by-step instructions, statistics, timeframes, multiple options, common mistakes, pro tips
- Total output should be 100-150+ lines

Example of correct format:
# Topic
## Comprehensive Category 1
### Detailed Subcategory 1
#### Professional service options: ConsultantA charges $150/hour with 5-session minimum, ConsultantB offers $500 flat rate package, FirmC provides free initial consultation then $200/hour
#### DIY approach with tools: Use Excel template from Vertex42.com (free), watch YouTube channel "FinanceGuru" tutorials, expect 4-6 hours setup time, common mistake is overlooking recurring expenses
#### Software comparison: QuickenPremier $35/year with bank sync and investment tracking, YNAB $14/month with zero-based budgeting philosophy, Mint free but limited reporting capabilities

REMEMBER: Each #### must be 20-40 words with exhaustive detail, specific names, prices, and comprehensive information.`;
  }
}

// Health check endpoint - UPDATED to show detail levels
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
      description: DETAIL_LEVELS[key].name === "Normal" ? "Minimal keywords only (1-3 words)" :
                   DETAIL_LEVELS[key].name === "Detailed" ? "Practical information (10-20 words)" :
                   "Exhaustive reference (20-40 words)"
    })),
    endpoints: [
      "POST /generate-mindmap - With detailLevel parameter (normal, detailed, ultra)"
    ]
  });
});

// Main mindmap generation endpoint - UPDATED WITH STRICTER VALIDATION
app.post("/generate-mindmap", async (req, res) => {
  try {
    const { topic, detailLevel = "normal" } = req.body

    console.log("=== REQUEST RECEIVED ===")
    console.log("Topic:", topic)
    console.log("Detail Level:", detailLevel)
    console.log("=======================")

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" })
    }

    // STRICT validation - only accept exact parameter
    if (!DETAIL_LEVELS[detailLevel]) {
      console.log("Invalid detail level:", detailLevel)
      return res.status(400).json({ 
        error: "Invalid detail level. Must be exactly: normal, detailed, or ultra", 
        received: detailLevel,
        validLevels: Object.keys(DETAIL_LEVELS)
      })
    }

    const config = DETAIL_LEVELS[detailLevel]
    console.log(`Generating ${config.name} mindmap using ${config.model}`)

    const prompt = generatePrompt(topic, detailLevel)
    
    // Add extra emphasis based on level
    let finalPrompt = prompt;
    if (detailLevel === 'normal') {
      finalPrompt += '\n\nCRITICAL: Use ONLY 1-3 words per #### item. NO EXCEPTIONS. Be EXTREMELY minimal.';
    } else if (detailLevel === 'detailed') {
      finalPrompt += '\n\nCRITICAL: EVERY #### item MUST be 10-20 words. Include practical details and examples.';
    } else if (detailLevel === 'ultra') {
      finalPrompt += '\n\nCRITICAL: EVERY #### item MUST be 20-40 words. Be EXHAUSTIVE with specific details, prices, names, and instructions.';
    }

    // Call Claude API with specific temperature
    const message = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: config.systemMessage,
      messages: [
        {
          role: "user",
          content: finalPrompt
        }
      ]
    })

    const markdown = message.content[0]?.text || ""

    if (!markdown) {
      throw new Error("Failed to generate mindmap content")
    }

    // Analyze output for validation
    const lines = markdown.split('\n').filter(l => l.trim());
    const details = lines.filter(l => l.trim().startsWith('#### '));
    const avgWords = details.length > 0 ? 
      details.reduce((acc, d) => acc + d.replace('#### ', '').trim().split(' ').length, 0) / details.length : 0;

    console.log(`Generated: ${lines.length} lines, ${details.length} details, ${avgWords.toFixed(1)} avg words/detail`)

    // Warn if output doesn't meet expectations
    if (detailLevel === 'normal' && avgWords > 4) {
      console.warn(`WARNING: Normal level too detailed (${avgWords.toFixed(1)} words/detail)`);
    } else if (detailLevel === 'detailed' && (avgWords < 8 || avgWords > 22)) {
      console.warn(`WARNING: Detailed level out of range (${avgWords.toFixed(1)} words/detail)`);
    } else if (detailLevel === 'ultra' && avgWords < 15) {
      console.warn(`WARNING: Ultra level not detailed enough (${avgWords.toFixed(1)} words/detail)`);
    }

    // Return enhanced response
    res.status(200).json({ 
      markdown,
      detailLevel,
      detailLevelName: config.name,
      model: config.model,
      tokensUsed: (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0),
      inputTokens: message.usage?.input_tokens || 0,
      outputTokens: message.usage?.output_tokens || 0,
      maxTokensAllowed: config.maxTokens,
      stats: {
        totalLines: lines.length,
        detailItems: details.length,
        avgWordsPerDetail: avgWords.toFixed(1),
        meetsExpectations: (detailLevel === 'normal' && avgWords <= 4) ||
                          (detailLevel === 'detailed' && avgWords >= 8 && avgWords <= 22) ||
                          (detailLevel === 'ultra' && avgWords >= 15)
      }
    })
  } catch (error) {
    console.error(`Error generating mindmap:`, error)
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
  console.log('Anthropic Claude API configured:', !!process.env.CLAUDE_API_KEY)
  console.log('Available detail levels:')
  Object.entries(DETAIL_LEVELS).forEach(([key, config]) => {
    console.log(`- ${key}: ${config.name} (${config.model}, ${config.maxTokens} tokens)`)
  })
})
