// Enhanced generatePrompt function with clearer differentiation
const generatePrompt = (topic, detailLevel) => {
  if (detailLevel === 'normal') {
    return `Create a BASIC mindmap in markdown format for the topic "${topic}".

STRICT REQUIREMENTS FOR NORMAL DETAIL LEVEL:
- Keep this EXTREMELY simple and minimal
- Use # for main topic
- Use ## for main branches (4 maximum)
- Use ### for sub-branches (2 maximum per branch)
- Use #### for brief points (1-2 words ONLY)
- NO descriptions, NO examples, NO explanations
- Total mindmap should be under 15 lines

Example:
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

Be extremely concise. ONE OR TWO WORDS ONLY for fourth level.`
  }
  
  if (detailLevel === 'detailed') {
    return `Create a DETAILED mindmap in markdown format for the topic "${topic}".

REQUIREMENTS FOR DETAILED LEVEL:
- Provide helpful examples and practical details
- Use # for main topic
- Use ## for main branches (6-8 branches)
- Use ### for sub-branches (3-4 per branch)
- Use #### for specific details (10-20 words each)
- Include practical examples, ranges, and helpful tips
- Total mindmap should be 40-60 lines

Example fourth-level format:
#### Budget planning: Set aside 10-15% of income, use apps like Mint or YNAB
#### Time management: Use Pomodoro technique (25 min work, 5 min break)
#### Tools needed: Hammer, screwdriver set, level, measuring tape

Include practical information, specific recommendations, and useful details.`
  }
  
  if (detailLevel === 'ultra') {
    return `Create an ULTRA-DETAILED, COMPREHENSIVE mindmap in markdown format for the topic "${topic}".

REQUIREMENTS FOR ULTRA DETAIL LEVEL:
- Be EXTREMELY comprehensive and exhaustive
- Use # for main topic
- Use ## for main branches (10-12 branches minimum)
- Use ### for sub-branches (4-6 per branch)
- Use #### for very detailed information (20-40 words each)
- Include:
  * Exact prices with multiple vendor options
  * Step-by-step instructions with timing
  * Specific company/product names with alternatives
  * Real-world examples with outcomes
  * Common pitfalls and how to avoid them
  * Expert tips and industry secrets
- Total mindmap should be 80-120+ lines

Example fourth-level format:
#### Professional photographers: Jane Smith Photography ($2500 for 8 hours), PhotoPro Studios ($1800 for 6 hours), budget option: college student photographers ($500-800)
#### Venue booking timeline: Book 12-18 months ahead for popular venues, 6-9 months for standard venues, negotiate 10-15% discount for off-season dates
#### DIY centerpiece tutorial: Buy wholesale flowers from Costco ($150 for 20 tables), arrange in mason jars ($40), add battery LED lights ($30), total time: 4 hours with 2 helpers

Be exhaustively detailed with multiple options, exact specifications, and comprehensive guidance.`
  }
}

// Also update the systemMessage in DETAIL_LEVELS for better differentiation:
const DETAIL_LEVELS = {
  normal: {
    name: "Normal",
    maxTokens: 1500,
    model: "claude-3-5-haiku-20241022",
    systemMessage: "You are creating a MINIMAL mindmap. Be EXTREMELY concise. Use only 1-2 words for fourth-level items. NO descriptions, NO examples, NO explanations. Keep the entire mindmap under 15 lines total.",
    description: "Bare minimum overview - keywords only"
  },
  detailed: {
    name: "Detailed", 
    maxTokens: 3000,
    model: "claude-3-7-sonnet-20250219",
    systemMessage: "You are creating a DETAILED mindmap. Provide practical examples, useful ranges, and helpful specifics. Fourth-level items should be 10-20 words with actionable information. Aim for 40-60 total lines.",
    description: "Comprehensive with practical examples and recommendations"
  },
  ultra: {
    name: "Ultra Detailed",
    maxTokens: 4000,
    model: "claude-sonnet-4-20250514",
    systemMessage: "You are creating an ULTRA-DETAILED mindmap. Be EXHAUSTIVE. Include exact prices from multiple vendors, step-by-step instructions, specific company names, real examples, common mistakes, and expert tips. Fourth-level items should be 20-40 words each. Create 80-120+ lines total.",
    description: "Exhaustive guide with everything you need to know"
  }
}
