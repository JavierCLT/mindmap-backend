import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(express.json());

// CORS (allow specific origins + any *.vercel.app)
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = [
      "https://javierclt.github.io",
      "http://localhost:5173",
      "http://localhost:3000",
      "https://www.mind-map-maker.com",
      "https://mind-map-maker.com",
      "http://www.mind-map-maker.com",
      "http://mind-map-maker.com",
    ];
    if (allowedOrigins.includes(origin) || origin.endsWith("vercel.app")) {
      callback(null, true);
    } else {
      console.log("CORS blocked for origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
  optionsSuccessStatus: 204,
};

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log("Origin:", req.headers.origin);
  console.log("Referer:", req.headers.referer);
  next();
});

// Preflight
app.options("*", cors(corsOptions));

// Apply CORS
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again after 15 minutes",
});
app.use(limiter);

// --- Anthropic (Claude) client ---
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Health check
app.get("/", (req, res) => {
  const apiKeyConfigured = !!process.env.ANTHROPIC_API_KEY;
  res.status(200).json({
    status: "ok",
    message: "Mindmap Backend API is running",
    apiKeyConfigured,
    environment: process.env.NODE_ENV || "development",
    model: process.env.CLAUDE_MODEL || "claude-opus-4-1-20250805",
  });
});

// Mindmap generation
app.post("/generate-mindmap", async (req, res) => {
  try {
    const { topic } = req.body;
    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({ error: "Topic is required" });
    }

    console.log(`Generating mindmap for topic: ${topic}`);

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
At the fourth level (####), include as many specific examples or details as relevant to illustrate the sub-branch. Do not necessarily limit them to 2 examples.
The markdown must be clean, properly formatted, and compatible with rendering in the Markmap library (e.g., no extra spaces, comments, or non-markdown text).
Do not include introductory or summary comments. Only output the structured markdown.
Focus on creating a mindmap that enhances understanding by breaking down the topic into its core components and showing clear relationships between them.`;

    const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514"; // see docs model list. :contentReference[oaicite:2]{index=2}

    const message = await anthropic.messages.create({
      model,
      max_tokens: 3000, // Anthropic param name is max_tokens. :contentReference[oaicite:3]{index=3}
      temperature: 0.2,
      system:
        "You create well-structured mindmaps in clean markdown compatible with Markmap. Output only the markdown, no preface or commentary.",
      messages: [
        {
          role: "user",
          content: [{ type: "text", text: prompt }],
        },
      ],
    });

    // Extract text blocks
    const markdown =
      (message.content || [])
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text)
        .join("")
        .trim() || "";

    if (!markdown) {
      throw new Error("Failed to generate mindmap content");
    }

    res.status(200).json({ markdown });
  } catch (error) {
    console.error("Error generating mindmap:", error);

    // Normalize Anthropic errors
    const status = error?.status || 500;
    const apiMsg =
      error?.error?.message ||
      error?.message ||
      "Unknown error from Claude API";

    res.status(status).json({
      error: "Failed to generate mindmap",
      message: apiMsg,
      // Only expose stack in dev
      stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
    });
  }
});

// OPTIONS for the endpoint
app.options("/generate-mindmap", cors(corsOptions), (_req, res) => {
  res.status(204).send();
});

// Start
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
