// server.ts (Node 18+, "type": "module" or use .js)
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import Anthropic from "@anthropic-ai/sdk";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ---------- CORS ----------
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

app.use(express.json());
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

// ---------- Logs ----------
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log("Origin:", req.headers.origin);
  console.log("Referer:", req.headers.referer);
  next();
});

// ---------- Rate limit ----------
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again after 15 minutes",
});
app.use(limiter);

// ---------- Anthropic client ----------
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const DEFAULT_MODEL =
  process.env.CLAUDE_MODEL || "claude-opus-4-1-20250805"; // Set your preferred current Claude id

// ---------- Utility: robust JSON extraction ----------
function extractJson(text: string): any {
  if (!text) return null;
  // Try direct parse
  try { return JSON.parse(text); } catch {}
  // Fallback: extract first {...} block
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    const snippet = text.slice(start, end + 1);
    try { return JSON.parse(snippet); } catch {}
  }
  return null;
}

// ---------- Prompts ----------
const SYSTEM_JSON_ONLY =
  "You produce structured outputs only. Do not include explanations, notes, or reasoning. When asked for JSON, output strictly valid, minified JSON and nothing else.";

function outlinePrompt(topic: string, audience?: string, tone?: string, depth = 4, examplesPerLeaf = 3) {
  return `
You will propose a comprehensive outline for a Markmap mindmap as JSON. Do not include prose.

Schema:
{
  "title": string,
  "depth": 2|3|4,
  "branches": [
    {
      "name": string,
      "summary": string,
      "sub": [
        {
          "name": string,
          "summary": string,
          "sub": [
            {
              "name": string,
              "summary": string
            }
          ]
        }
      ]
    }
  ]
}

Requirements:
- Topic: "${topic}"
- Audience: ${JSON.stringify(audience || "general")}
- Tone: ${JSON.stringify(tone || "neutral, clear")}
- Max depth: ${Math.max(2, Math.min(4, depth))}
- Coverage should be broad first (breadth), then deep (depth) where relevant.
- Avoid brand-new statistics. If examples are used in summaries, keep them generic and non-fabricated.

Return only JSON that matches the schema.`;
}

function coveragePassPrompt(topic: string, currentJson: any) {
  return `
You will improve the outline JSON to maximize coverage.

Rubric to check:
- Foundations: definitions, history/context, key terms, core concepts
- Frameworks & models (where relevant)
- Processes/workflows/architecture
- Tools & techniques
- Data/metrics/benchmarks (generic descriptions only, no invented stats)
- Risks, limitations, ethics, compliance
- Use cases, scenarios, case-type examples
- Comparisons & decision criteria
- Implementation tips & best practices
- Maintenance/monitoring/improvement loops
- Common pitfalls & anti-patterns

Input JSON:
${JSON.stringify(currentJson)}

Task:
1) Add missing major categories or subtopics across the rubric (do not bloat with trivial items).
2) Keep depth ≤ the input "depth".
3) Keep summaries concise and useful.
4) Maintain valid schema and return JSON only.`;
}

function enrichLeavesPrompt(topic: string, currentJson: any, examplesPerLeaf: number) {
  return `
You will enrich leaf nodes by adding concrete examples/checklists where useful (generic, non-fabricated).

Input JSON:
${JSON.stringify(currentJson)}

Task:
- For nodes at maximum depth in the tree, enhance the "summary" with:
  • brief example(s) (e.g., "Example: ...")
  • succinct checklist bullets inline (e.g., "Checklist: ...; ...; ...")
- Use ${Math.max(1, Math.min(5, examplesPerLeaf))} example(s) max per leaf.
- Keep writing concise and practical.
- Return JSON only, same schema.`;
}

function renderMarkdownPrompt(currentJson: any, includeFAQ: boolean, includeGlossary: boolean) {
  return `
Convert the following outline JSON to Markmap-compatible Markdown.

Rules:
- Use exactly # for title, ## for level 2, ### for level 3, #### for level 4.
- No level 5 headings.
- No preamble, no comments, Markdown only.
- Include summaries on the same line after the heading name using "—" (em dash).
- After rendering the main tree, ${includeFAQ ? "append a '## FAQ' section with 6–10 **succinct** Q&A (### question, #### short answer)." : "do not add FAQ."}
- ${includeGlossary ? "Append a '## Glossary' (### term, #### 1-line definition) with 10–20 key terms." : "Do not add a Glossary."}

Input JSON:
${JSON.stringify(currentJson)}

Output:
Clean Markdown only.`;
}

// ---------- Orchestrator ----------
async function generateComprehensiveMindmap({
  topic,
  model = DEFAULT_MODEL,
  depth = 4,
  examplesPerLeaf = 3,
  includeFAQ = true,
  includeGlossary = true,
  audience,
  tone,
  maxTokens = 3000,
  temperature = 0.2,
}: {
  topic: string;
  model?: string;
  depth?: 2 | 3 | 4;
  examplesPerLeaf?: number;
  includeFAQ?: boolean;
  includeGlossary?: boolean;
  audience?: string;
  tone?: string;
  maxTokens?: number;
  temperature?: number;
}) {
  // 1) Initial outline
  const outlineResp = await anthropic.messages.create({
    model,
    system: SYSTEM_JSON_ONLY,
    messages: [{ role: "user", content: outlinePrompt(topic, audience, tone, depth, examplesPerLeaf) }],
    temperature,
    max_tokens: 1500,
  });
  let outline = extractJson(outlineResp.content?.[0]?.type === "text" ? outlineResp.content?.[0]?.text : (outlineResp.content || []).map(b => b.type === "text" ? b.text : "").join("\n"));
  if (!outline) throw new Error("Could not parse outline JSON from Claude.");

  // 2) Coverage pass
  const coverageResp = await anthropic.messages.create({
    model,
    system: SYSTEM_JSON_ONLY,
    messages: [{ role: "user", content: coveragePassPrompt(topic, outline) }],
    temperature,
    max_tokens: 1600,
  });
  let improved = extractJson(coverageResp.content?.[0]?.type === "text" ? coverageResp.content?.[0]?.text : (coverageResp.content || []).map(b => b.type === "text" ? b.text : "").join("\n"));
  if (!improved) improved = outline;

  // 3) Enrich leaves
  const enrichResp = await anthropic.messages.create({
    model,
    system: SYSTEM_JSON_ONLY,
    messages: [{ role: "user", content: enrichLeavesPrompt(topic, improved, examplesPerLeaf) }],
    temperature,
    max_tokens: 1600,
  });
  let enriched = extractJson(enrichResp.content?.[0]?.type === "text" ? enrichResp.content?.[0]?.text : (enrichResp.content || []).map(b => b.type === "text" ? b.text : "").join("\n"));
  if (!enriched) enriched = improved;

  // 4) Render to Markdown
  const renderResp = await anthropic.messages.create({
    model,
    messages: [{ role: "user", content: renderMarkdownPrompt(enriched, includeFAQ, includeGlossary) }],
    temperature,
    max_tokens: maxTokens,
  });

  const markdown =
    (renderResp.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n")
      .trim();

  const usage = {
    outline: outlineResp.usage,
    coverage: coverageResp.usage,
    enrich: enrichResp.usage,
    render: renderResp.usage,
  };

  if (!markdown) throw new Error("Claude returned no Markdown content.");

  return { markdown, usage };
}

// ---------- Health check ----------
app.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "Mindmap Backend API is running",
    apiKeyConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    model: DEFAULT_MODEL,
    environment: process.env.NODE_ENV || "development",
  });
});

// ---------- Mindmap endpoint ----------
app.post("/generate-mindmap", async (req, res) => {
  try {
    const {
      topic,
      model,
      depth = 4,
      examplesPerLeaf = 3,
      includeFAQ = true,
      includeGlossary = true,
      audience,
      tone,
      maxTokens = 3000,
      temperature = 0.2,
    } = req.body || {};

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({ error: "Topic is required" });
    }

    console.log(`Generating comprehensive mindmap for topic: ${topic}`);

    const { markdown, usage } = await generateComprehensiveMindmap({
      topic: topic.trim(),
      model,
      depth,
      examplesPerLeaf,
      includeFAQ,
      includeGlossary,
      audience,
      tone,
      maxTokens,
      temperature,
    });

    res.status(200).json({ markdown, usage });
  } catch (error: any) {
    console.error("Error generating mindmap:", error);
    const status = error?.status || 500;
    const message =
      error?.error?.message || error?.message || "Failed to generate mindmap";
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: "Failed to generate mindmap",
      message,
      details: error?.error || undefined,
      stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
    });
  }
});

// ---------- OPTIONS ----------
app.options("/generate-mindmap", cors(corsOptions), (_req, res) => {
  res.status(204).send();
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
