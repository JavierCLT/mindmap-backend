// server.ts (or server.js with "type": "module")
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

app.use(express.json({ limit: "1mb" }));
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight early

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
  process.env.CLAUDE_MODEL || "claude-opus-4-1-20250805";

// ---------- Utilities ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sanitizeText(s = "") {
  return s
    .replace(/\s+/g, " ")
    .replace(/\u0000/g, "")
    .trim();
}

async function fetchWithTimeout(url: string, ms = 6000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "MindmapMaker/1.0" } });
    return res;
  } finally {
    clearTimeout(id);
  }
}

type EnrichmentSnippet = { title: string; url: string; excerpt: string };

// Very conservative domain policy; add more if you want later.
const ALLOWED_HOSTS = new Set([
  "wikipedia.org",
  "en.wikipedia.org",
  "www.wikipedia.org",
  "developer.mozilla.org", // MDN
  "mdn.mozilla.org",
]);

function isAllowed(url: string) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return Array.from(ALLOWED_HOSTS).some((h) => host === h || host.endsWith("." + h));
  } catch {
    return false;
  }
}

// Heuristic: if topic smells like web tech, consider MDN landing page
function looksLikeWebTech(topic: string) {
  return /\b(html|css|javascript|js|web api|dom|fetch|http|service worker|websocket|canvas|svg)\b/i.test(
    topic
  );
}

// Pull neutral, short extracts (budget-limited)
async function buildEnrichmentContext(topic: string, charBudget = 4000): Promise<{ snippets: EnrichmentSnippet[]; contextBlock: string; }> {
  const snippets: EnrichmentSnippet[] = [];
  const q = encodeURIComponent(topic.trim());
  const wikipediaSummary = `https://en.wikipedia.org/api/rest_v1/page/summary/${q}`;
  const wikipediaRelated = `https://en.wikipedia.org/api/rest_v1/page/related/${q}`;

  // 1) Main summary
  try {
    const r = await fetchWithTimeout(wikipediaSummary, 6500);
    if (r.ok && r.headers.get("content-type")?.includes("application/json")) {
      const j = await r.json();
      const title = j?.title || topic;
      const url = j?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${q}`;
      const excerpt = sanitizeText(j?.extract || "");
      if (excerpt && isAllowed(url)) {
        snippets.push({ title, url, excerpt });
      }
    }
  } catch {}

  // 2) Related pages (up to 3)
  try {
    const r = await fetchWithTimeout(wikipediaRelated, 6500);
    if (r.ok && r.headers.get("content-type")?.includes("application/json")) {
      const j = await r.json();
      const pages = (j?.pages || []).slice(0, 3);
      for (const p of pages) {
        const title = p?.title;
        const url = p?.content_urls?.desktop?.page;
        const excerpt = sanitizeText(p?.extract || "");
        if (title && url && excerpt && isAllowed(url)) {
          snippets.push({ title, url, excerpt });
        }
      }
    }
  } catch {}

  // 3) MDN if relevant
  if (looksLikeWebTech(topic)) {
    const mdnUrl = `https://developer.mozilla.org/api/v1/search?q=${q}&locale=en-US`;
    try {
      const r = await fetchWithTimeout(mdnUrl, 6500);
      if (r.ok) {
        const j: any = await r.json();
        const hits = (j?.documents || []).slice(0, 2);
        for (const h of hits) {
          const url = h?.mdn_url ? `https://developer.mozilla.org${h.mdn_url}` : undefined;
          const title = h?.title || "MDN Reference";
          const excerpt = sanitizeText(h?.summary || h?.popularity?.toString() || "");
          if (url && isAllowed(url) && excerpt) {
            snippets.push({ title, url, excerpt });
          }
        }
      }
    } catch {}
  }

  // Budget & dedupe
  const seen = new Set<string>();
  const final: EnrichmentSnippet[] = [];
  let count = 0;
  for (const s of snippets) {
    const key = s.url;
    if (seen.has(key)) continue;
    seen.add(key);
    const candidateLen = s.excerpt.length + s.title.length + s.url.length + 20;
    if (count + candidateLen > charBudget) break;
    final.push(s);
    count += candidateLen;
    if (final.length >= 5) break;
  }

  // Build context block (quoted snippets)
  const contextBlock = final
    .map(
      (s, i) =>
        `Source ${i + 1}: ${s.title}\nURL: ${s.url}\nExcerpt: "${s.excerpt}"`
    )
    .join("\n\n");

  return { snippets: final, contextBlock };
}

// ---------- Prompts (same as previous multi-pass, with enrichment injection) ----------
const SYSTEM_JSON_ONLY =
  "You produce structured outputs only. Do not include explanations, notes, or reasoning. When asked for JSON, output strictly valid, minified JSON and nothing else.";

function outlinePrompt(topic: string, audience?: string, tone?: string, depth = 4) {
  return `
You will propose a comprehensive outline for a Markmap mindmap as JSON. Do not include prose.

Schema:
{"title":string,"depth":2|3|4,"branches":[{"name":string,"summary":string,"sub":[{"name":string,"summary":string,"sub":[{"name":string,"summary":string}]}]}]}

Requirements:
- Topic: "${topic}"
- Audience: ${JSON.stringify(audience || "general")}
- Tone: ${JSON.stringify(tone || "neutral, clear")}
- Max depth: ${Math.max(2, Math.min(4, depth))}
- Coverage should be broad first, then deep where relevant.
- Avoid brand-new statistics. If examples are used in summaries, keep them generic and non-fabricated.

Return only JSON that matches the schema.`;
}

function coveragePassPrompt(topic: string, currentJson: any, enrichment?: string) {
  const enrichmentNote = enrichment
    ? `Use the following source excerpts as factual grounding where directly relevant (do not copy long passages, do not invent stats):

${enrichment}`
    : `No web enrichment is provided. Keep content generally factual and generic.`;
  return `
You will improve the outline JSON to maximize coverage.

${enrichmentNote}

Rubric to check:
- Foundations (definitions, history/context, key terms, core concepts)
- Frameworks & models
- Processes/workflows/architecture
- Tools & techniques
- Data/metrics (generic descriptions only)
- Risks, ethics, compliance
- Use cases & scenarios
- Comparisons & decision criteria
- Implementation tips & best practices
- Maintenance/monitoring
- Common pitfalls & anti-patterns

Input JSON:
${JSON.stringify(currentJson)}

Task:
1) Add missing major categories or subtopics across the rubric (avoid trivial bloat).
2) Keep depth ≤ the input "depth".
3) Keep summaries concise and useful.
4) Maintain valid schema and return JSON only.`;
}

function enrichLeavesPrompt(currentJson: any, examplesPerLeaf: number) {
  return `
You will enrich leaf nodes by adding concrete examples/checklists where useful (generic, non-fabricated).

Input JSON:
${JSON.stringify(currentJson)}

Task:
- For nodes at max depth, enhance "summary" with:
  • brief example(s) (e.g., "Example: ...")
  • concise checklist inline (e.g., "Checklist: ...; ...; ...")
- Use ${Math.max(1, Math.min(5, examplesPerLeaf))} example(s) max per leaf.
- Keep writing practical and concise.
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
- After the main tree, ${includeFAQ ? "append a '## FAQ' section with 6–10 succinct Q&A (### question, #### short answer)." : "do not add FAQ."}
- ${includeGlossary ? "Append a '## Glossary' (### term, #### 1-line definition) with 10–20 key terms." : "Do not add a Glossary."}

Input JSON:
${JSON.stringify(currentJson)}

Output:
Clean Markdown only.`;
}

// ---------- Orchestrator with enrichment ----------
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
  web_enrichment = false,
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
  web_enrichment?: boolean;
}) {
  // Optional enrichment
  let enrichment: { snippets: EnrichmentSnippet[]; contextBlock: string } | null = null;
  if (web_enrichment) {
    enrichment = await buildEnrichmentContext(topic, 4000);
  }

  // 1) Initial outline
  const outlineResp = await anthropic.messages.create({
    model,
    system: SYSTEM_JSON_ONLY,
    messages: [{ role: "user", content: outlinePrompt(topic, audience, tone, depth) }],
    temperature,
    max_tokens: 1500,
  });
  const outlineText =
    (outlineResp.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("\n");
  let outline;
  try {
    outline = JSON.parse(outlineText);
  } catch {
    const start = outlineText.indexOf("{");
    const end = outlineText.lastIndexOf("}");
    outline = start >= 0 && end > start ? JSON.parse(outlineText.slice(start, end + 1)) : null;
  }
  if (!outline) throw new Error("Could not parse outline JSON from Claude.");

  // 2) Coverage pass (inject enrichment)
  const coverageResp = await anthropic.messages.create({
    model,
    system: SYSTEM_JSON_ONLY,
    messages: [
      {
        role: "user",
        content: coveragePassPrompt(topic, outline, enrichment?.contextBlock),
      },
    ],
    temperature,
    max_tokens: 1600,
  });
  const coverageText =
    (coverageResp.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("\n");
  let improved = outline;
  try {
    improved = JSON.parse(coverageText);
  } catch {
    const s = coverageText.indexOf("{");
    const e = coverageText.lastIndexOf("}");
    if (s >= 0 && e > s) improved = JSON.parse(coverageText.slice(s, e + 1));
  }

  // 3) Enrich leaves
  const enrichResp = await anthropic.messages.create({
    model,
    system: SYSTEM_JSON_ONLY,
    messages: [{ role: "user", content: enrichLeavesPrompt(improved, examplesPerLeaf) }],
    temperature,
    max_tokens: 1600,
  });
  const enrichText =
    (enrichResp.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("\n");
  let enriched = improved;
  try {
    enriched = JSON.parse(enrichText);
  } catch {
    const s = enrichText.indexOf("{");
    const e = enrichText.lastIndexOf("}");
    if (s >= 0 && e > s) enriched = JSON.parse(enrichText.slice(s, e + 1));
  }

  // 4) Render Markdown
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

  if (!markdown) throw new Error("Claude returned no Markdown content.");

  // Append Sources (outside LLM for fidelity)
  let sourcesAppendix = "";
  if (enrichment?.snippets?.length) {
    const bullets = enrichment.snippets
      .map((s) => `- [${s.title}](${s.url}) — ${s.excerpt.slice(0, 160)}…`)
      .join("\n");
    sourcesAppendix = `\n\n## Sources\n${bullets}\n`;
  }

  const usage = {
    outline: outlineResp.usage,
    coverage: coverageResp.usage,
    enrich: enrichResp.usage,
    render: renderResp.usage,
  };

  return { markdown: markdown + sourcesAppendix, usage, sources: enrichment?.snippets || [] };
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

// ---------- Non-streaming endpoint ----------
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
      web_enrichment = false,
    } = req.body || {};

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return res.status(400).json({ error: "Topic is required" });
    }

    console.log(`Generating comprehensive mindmap for topic: ${topic} (enrichment=${!!web_enrichment})`);

    const result = await generateComprehensiveMindmap({
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
      web_enrichment,
    });

    res.status(200).json(result);
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

// ---------- Streaming SSE endpoint ----------
app.post("/generate-mindmap/stream", async (req, res) => {
  // Same body as non-streaming, plus `web_enrichment`
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
    web_enrichment = false,
  } = req.body || {};

  if (!topic || typeof topic !== "string" || !topic.trim()) {
    return res.status(400).json({ error: "Topic is required" });
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: string, data: any) => {
    res.write(`data: ${JSON.stringify({ event, ...data })}\n\n`);
  };

  // Keep-alive ping
  const ping = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 15000);

  let closed = false;
  req.on("close", () => {
    closed = true;
    clearInterval(ping);
  });

  try {
    // Optional enrichment before streaming
    let enrichment: { snippets: EnrichmentSnippet[]; contextBlock: string } | null = null;
    if (web_enrichment) {
      send("status", { message: "Fetching sources…" });
      enrichment = await buildEnrichmentContext(topic, 4000);
      send("sources", { sources: enrichment.snippets });
    }

    // We'll stream only the final render step; the earlier JSON passes are relatively small.
    send("status", { message: "Drafting outline…" });
    const outlineResp = await anthropic.messages.create({
      model: model || DEFAULT_MODEL,
      system: SYSTEM_JSON_ONLY,
      messages: [{ role: "user", content: outlinePrompt(topic, audience, tone, depth) }],
      temperature,
      max_tokens: 1500,
    });
    const outlineText =
      (outlineResp.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("\n");
    let outline;
    try {
      outline = JSON.parse(outlineText);
    } catch {
      const s = outlineText.indexOf("{");
      const e = outlineText.lastIndexOf("}");
      outline = s >= 0 && e > s ? JSON.parse(outlineText.slice(s, e + 1)) : null;
    }
    if (!outline) throw new Error("Could not parse outline JSON from Claude.");

    send("status", { message: "Improving coverage…" });
    const coverageResp = await anthropic.messages.create({
      model: model || DEFAULT_MODEL,
      system: SYSTEM_JSON_ONLY,
      messages: [
        { role: "user", content: coveragePassPrompt(topic, outline, enrichment?.contextBlock) },
      ],
      temperature,
      max_tokens: 1600,
    });
    const coverageText =
      (coverageResp.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("\n");
    let improved = outline;
    try {
      improved = JSON.parse(coverageText);
    } catch {
      const s = coverageText.indexOf("{");
      const e = coverageText.lastIndexOf("}");
      if (s >= 0 && e > s) improved = JSON.parse(coverageText.slice(s, e + 1));
    }

    send("status", { message: "Enriching leaves…" });
    const enrichResp = await anthropic.messages.create({
      model: model || DEFAULT_MODEL,
      system: SYSTEM_JSON_ONLY,
      messages: [{ role: "user", content: enrichLeavesPrompt(improved, examplesPerLeaf) }],
      temperature,
      max_tokens: 1600,
    });
    const enrichText =
      (enrichResp.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("\n");
    let enriched = improved;
    try {
      enriched = JSON.parse(enrichText);
    } catch {
      const s = enrichText.indexOf("{");
      const e = enrichText.lastIndexOf("}");
      if (s >= 0 && e > s) enriched = JSON.parse(enrichText.slice(s, e + 1));
    }

    // STREAM the final Markdown
    send("status", { message: "Rendering Markdown…" });
    const stream = await anthropic.messages.stream({
      model: model || DEFAULT_MODEL,
      messages: [{ role: "user", content: renderMarkdownPrompt(enriched, includeFAQ, includeGlossary) }],
      temperature,
      max_tokens: maxTokens,
    });

    let collected = "";
    stream.on("text", (chunk: string) => {
      if (closed) return;
      collected += chunk;
      send("text", { chunk });
    });

    stream.on("error", (err: any) => {
      if (closed) return;
      send("error", { message: err?.message || "Stream error" });
      try { res.end(); } catch {}
    });

    const finalMsg = await stream.finalMessage(); // waits for completion
    if (closed) return;

    // Append sources on the server side for fidelity
    if (enrichment?.snippets?.length) {
      const bullets = enrichment.snippets
        .map((s) => `- [${s.title}](${s.url}) — ${s.excerpt.slice(0, 160)}…`)
        .join("\n");
      collected += `\n\n## Sources\n${bullets}\n`;
      send("text", { chunk: `\n\n## Sources\n${bullets}\n` });
    }

    send("done", { usage: finalMsg.usage || null });
    res.end();
  } catch (error: any) {
    if (!closed) {
      res.write(`data: ${JSON.stringify({ event: "error", message: error?.message || "Failed" })}\n\n`);
      res.end();
    }
  } finally {
    clearInterval(ping);
  }
});

// ---------- OPTIONS for the endpoints ----------
app.options("/generate-mindmap", cors(corsOptions), (_req, res) => res.status(204).send());
app.options("/generate-mindmap/stream", cors(corsOptions), (_req, res) => res.status(204).send());

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
