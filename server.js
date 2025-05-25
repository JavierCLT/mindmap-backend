// Replace your generatePrompt function with this enhanced version
const generatePrompt = (topic, detailLevel) => {
  if (detailLevel === 'normal') {
    return `Create a MINIMAL mindmap for "${topic}". 

STRICT RULES:
- Use # for main topic
- Use ## for 4 main branches ONLY
- Use ### for 2 sub-branches per main branch ONLY
- Use #### for 2 bullet points per sub-branch ONLY
- Fourth level (####) must be 1-3 words maximum
- NO colons, NO descriptions, NO examples
- Total output must be under 20 lines

Example output format:
# Topic
## Category1
### Subcategory1
#### Word1
#### Word2
### Subcategory2
#### Word3
#### Word4
## Category2
### Subcategory3
#### Word5
#### Word6

BE EXTREMELY MINIMAL. Just keywords.`;
  }
  
  if (detailLevel === 'detailed') {
    return `Create a detailed mindmap for "${topic}".

REQUIREMENTS:
- Use # for main topic
- Use ## for 6-8 main branches
- Use ### for 3-4 sub-branches per main branch
- Use #### for 3-4 detailed points per sub-branch
- Fourth level (####) must include helpful details (10-20 words)
- Include practical examples, ranges, tips, and methods
- Total output should be 50-80 lines

Example fourth-level format:
#### Budget Planning: Track expenses with apps like Mint, save 20% of income
#### Study Techniques: Use spaced repetition, review notes within 24 hours
#### Exercise Options: Join gym for $30/month, run 3x weekly, yoga at home

Include practical information and actionable advice.`;
  }
  
  if (detailLevel === 'ultra') {
    return `Create an EXHAUSTIVE, ULTRA-DETAILED mindmap for "${topic}".

REQUIREMENTS:
- Use # for main topic
- Use ## for 10-12 main branches (comprehensive coverage)
- Use ### for 4-6 sub-branches per main branch
- Use #### for 4-6 extremely detailed points per sub-branch
- Fourth level (####) must be information-rich (20-40 words each)
- Include ALL of these in your details:
  * Specific names, brands, and companies
  * Exact prices and price ranges
  * Step-by-step instructions
  * Multiple options and alternatives
  * Time requirements and schedules
  * Common mistakes to avoid
  * Pro tips and insider knowledge
  * Real-world examples
  * Statistics and percentages
- Total output should be 100-150+ lines

Example fourth-level format:
#### Professional Services: Hire certified planner Jane Smith ($150/hour), budget consultant Tom Jones ($500 flat rate), or use free consultation at Wells Fargo branch on Main Street
#### DIY Approach: Download free templates from Vertex42.com, watch YouTube tutorials by "The Budget Mom", join r/personalfinance subreddit for community advice, expect 3-4 hours initial setup
#### Software Options: Quicken Premier ($35/year with bank sync), YNAB ($14/month with 34-day trial), Mint (free but limited), Personal Capital (free for basic, $89/year premium)

Be EXTREMELY comprehensive. This should be an exhaustive reference guide.`;
  }
}

// Update DETAIL_LEVELS configuration for even clearer differences
const DETAIL_LEVELS = {
  normal: {
    name: "Normal",
    maxTokens: 800, // Reduced for minimal output
    model: "claude-3-5-haiku-20241022",
    systemMessage: `You are creating a MINIMAL keyword-only mindmap. 
    Rules: 
    - Maximum 4 main branches (##)
    - Maximum 2 sub-branches per main branch (###)
    - Maximum 2 items per sub-branch (####)
    - Fourth level items must be 1-3 words ONLY
    - NO colons, NO descriptions, NO details
    - Total output under 20 lines
    - Just bare keywords`,
    description: "Minimal keyword outline"
  },
  detailed: {
    name: "Detailed", 
    maxTokens: 3000,
    model: "claude-3-7-sonnet-20250219",
    systemMessage: `You are creating a DETAILED practical mindmap.
    Requirements:
    - 6-8 main branches covering key aspects
    - 3-4 sub-branches per main branch
    - 3-4 detailed points per sub-branch
    - Fourth level items should be 10-20 words with practical info
    - Include examples, tips, methods, ranges
    - Make it actionable and useful
    - Total 50-80 lines`,
    description: "Comprehensive with practical details"
  },
  ultra: {
    name: "Ultra Detailed",
    maxTokens: 4000,
    model: "claude-sonnet-4-20250514",
    systemMessage: `You are creating an EXHAUSTIVE reference mindmap.
    Requirements:
    - 10-12 main branches for complete coverage
    - 4-6 sub-branches per main branch
    - 4-6 ultra-detailed points per sub-branch
    - Fourth level items must be 20-40 words each
    - Include: specific names, exact prices, step-by-step instructions, multiple options, schedules, mistakes to avoid, pro tips, real examples, statistics
    - This should be a complete reference guide
    - Total 100-150+ lines
    - Leave no stone unturned`,
    description: "Exhaustive reference guide with everything"
  }
}

// Add validation to ensure the model really follows the constraints
const validateMindmapOutput = (markdown, detailLevel) => {
  const lines = markdown.split('\n').filter(line => line.trim());
  const fourthLevelLines = lines.filter(line => line.trim().startsWith('####'));
  
  console.log(`Validation for ${detailLevel}:`);
  console.log(`- Total lines: ${lines.length}`);
  console.log(`- Fourth level items: ${fourthLevelLines.length}`);
  
  if (detailLevel === 'normal') {
    if (lines.length > 25) {
      console.warn('Normal level output too long!');
    }
    // Check if fourth level items are short
    const longItems = fourthLevelLines.filter(line => {
      const content = line.replace('####', '').trim();
      return content.split(' ').length > 3;
    });
    if (longItems.length > 0) {
      console.warn(`Normal level has ${longItems.length} items that are too detailed`);
    }
  } else if (detailLevel === 'ultra') {
    if (lines.length < 80) {
      console.warn('Ultra level output too short!');
    }
    // Check if fourth level items are detailed
    const shortItems = fourthLevelLines.filter(line => {
      const content = line.replace('####', '').trim();
      return content.split(' ').length < 10;
    });
    if (shortItems.length > fourthLevelLines.length * 0.3) {
      console.warn(`Ultra level has too many brief items (${shortItems.length}/${fourthLevelLines.length})`);
    }
  }
  
  return markdown;
}

// Update your endpoint to include validation
app.post("/generate-mindmap", async (req, res) => {
  try {
    const { topic, detailLevel = "normal" } = req.body

    console.log("=== REQUEST DEBUGGING ===")
    console.log("Topic:", topic)
    console.log("Detail Level:", detailLevel)
    console.log("=========================")

    if (!topic) {
      return res.status(400).json({ error: "Topic is required" })
    }

    if (!DETAIL_LEVELS[detailLevel]) {
      return res.status(400).json({ 
        error: "Invalid detail level", 
        received: detailLevel,
        validLevels: Object.keys(DETAIL_LEVELS)
      })
    }

    const config = DETAIL_LEVELS[detailLevel]
    console.log(`Generating ${config.name} mindmap for topic: ${topic}`)

    const prompt = generatePrompt(topic, detailLevel)
    
    // Add emphasis to the prompt based on level
    let enhancedPrompt = prompt;
    if (detailLevel === 'normal') {
      enhancedPrompt += '\n\nREMEMBER: BE EXTREMELY MINIMAL. NO DETAILS. JUST KEYWORDS.';
    } else if (detailLevel === 'ultra') {
      enhancedPrompt += '\n\nREMEMBER: BE EXHAUSTIVE. INCLUDE EVERYTHING. MAXIMUM DETAIL.';
    }

    // Call Claude API
    const message = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: detailLevel === 'ultra' ? 0.3 : 0.2, // Slightly higher temp for ultra
      system: config.systemMessage,
      messages: [
        {
          role: "user",
          content: enhancedPrompt
        }
      ]
    })

    // Extract and validate the markdown
    let markdown = message.content[0]?.text || ""
    markdown = validateMindmapOutput(markdown, detailLevel);

    if (!markdown) {
      throw new Error("Failed to generate mindmap content")
    }

    console.log("Generated markdown length:", markdown.length)
    console.log("Lines count:", markdown.split('\n').filter(l => l.trim()).length)

    res.status(200).json({ 
      markdown,
      detailLevel,
      detailLevelName: config.name,
      model: config.model,
      tokensUsed: message.usage?.input_tokens + message.usage?.output_tokens || "unknown",
      stats: {
        totalLines: markdown.split('\n').filter(l => l.trim()).length,
        characterCount: markdown.length,
        fourthLevelItems: markdown.split('\n').filter(l => l.trim().startsWith('####')).length
      }
    })
  } catch (error) {
    console.error(`Error generating ${req.body.detailLevel || 'normal'} mindmap:`, error)
    res.status(500).json({
      error: "Failed to generate mindmap",
      message: error.message
    })
  }
})
