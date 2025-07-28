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
Use a single # for the main topic (the title).  
Use ## for main branches (key categories).  
Use ### for sub-branches (subcategories).  
Use #### for details or examples under sub-branches.

 

For example, for "Plan a Wedding Event":

# Plan a Wedding Event
## Pre-Wedding Planning
### Budgeting
#### Venue Costs: $5000 for Lakeside Venue, $3000 for Indoor Hall
#### Catering: $50 per Person for Buffet, $2000 for Cake
### Venue Selection
#### Outdoor Options: Lakeside Park in June, Botanical Gardens
#### Indoor Options: Grand Hotel Ballroom, Historic Church Hall
### Guest List
#### Family: Invite 50 Relatives, Create RSVP System
#### Friends: Invite 30 Close Friends, Send Digital Invites
## Wedding Day Logistics
### Ceremony
#### Timing: 11 AM Start, 30-Minute Vows
#### Officiant: Hire Local Priest, Prepare Custom Vows
### Reception
#### Food: Italian Buffet with Pasta Station, Vegan Options
#### Entertainment: Live Band (The Harmony Strings), First Dance at 7 PM
### Photography
#### Photographer: Book Jane Doe Photography, $1500 Package
#### Videographer: Hire John Smith Films, Capture Drone Shots
## Post-Wedding
### Thank You Notes
#### Timing: Send Within 1 Month, Use Custom Stationery
#### Gifts: Include Small Tokens, Mention Specific Gifts in Notes
### Honeymoon Planning
#### Destination: Santorini for 7 Days, Paris for 5 Days
#### Activities: Sunset Cruise in Santorini, Eiffel Tower Dinner
### Memory Preservation
#### Album: Create Shutterfly Photo Book, Include 100 Photos
#### Video: Edit Highlight Reel, Share on Vimeo

Ensure the mindmap is hierarchical, well-organized, and covers the most critical and relevant aspects of the topic.  
Include up to four levels of markdown hierarchy (never use a fifth level, such as #####).  
At the fourth level (####), include as many specific examples or details as relevant to illustrate the sub-branch.  
The markdown must be clean, properly formatted, and compatible with rendering in the Markmap library (e.g., no extra spaces, comments, or non-markdown text).  
Do not include introductory or summary comments (e.g., "Here is a detailed mindmap on [Topic]"). Only output the structured markdown.  
Focus on creating a mindmap that enhances understanding by breaking down the topic into its core components and showing clear relationships between them.  
Mindmaps are visual tools for capturing, organizing, and visualizing ideas, often used for brainstorming, note-taking, problem-solving, decision-making, or as a study aid. Ensure the structure supports these purposes.`

    // Call the Grok API
    const completion = await openai.chat.completions.create({
      model: "grok-4-latest",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that creates well-structured mindmaps in markdown format.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 3000,
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
