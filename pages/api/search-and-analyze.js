const ANALYSIS_SYSTEM = `You are a food safety expert specializing in food additives and their health risks.

Given a product name and its ingredients list (which you will search for), analyze ALL food additives present.

Return ONLY a valid JSON object with this exact structure:
{
  "product_name": "full product name found",
  "ingredients_source": "where you found the ingredients (e.g. 'Official Spam website')",
  "ingredients_raw": "the full ingredients text you found",
  "scan_score": 0-100,
  "summary": "2 sentence summary of findings",
  "additives": [
    {
      "name": "Red 40",
      "code": "E129 or null",
      "risk_level": "high | moderate | low | safe",
      "concern": "one sentence main health concern",
      "banned_in": ["EU", "Norway"],
      "evidence": "one sentence about research",
      "alternatives": "cleaner alternative ingredient"
    }
  ]
}

scan_score: 100 = perfectly clean, 0 = very concerning.
Focus on: artificial dyes (Red 40, Yellow 5/6, Blue 1/2), preservatives (BHA, BHT, TBHQ, sodium nitrite), 
artificial sweeteners (aspartame, saccharin, acesulfame-K), emulsifiers (carrageenan, polysorbate 80), 
BVO, potassium bromate, propyl gallate, azodicarbonamide, titanium dioxide, HFCS, MSG.

If a common ingredient is NOT an additive (like sugar, salt, flour, water), do NOT include it.
Respond ONLY with valid JSON. No markdown, no backticks, no preamble.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { productName } = req.body;
  if (!productName) return res.status(400).json({ error: "No product name provided" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1500,
        system: ANALYSIS_SYSTEM,
        tools: [{
          type: "web_search_20250305",
          name: "web_search"
        }],
        messages: [{
          role: "user",
          content: `Search the web for the complete ingredients list of "${productName}". 
Look for the official brand website, or reliable sources like Open Food Facts, Eat This Much, or the USDA database.
Once you find the ingredients, analyze all food additives present and return the JSON analysis.`
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    // Extract the final text response (Claude may have used web_search tool first)
    const textBlocks = data.content?.filter(b => b.type === "text").map(b => b.text).join("").trim();

    if (!textBlocks) {
      return res.status(500).json({ error: "No analysis returned." });
    }

    // Strip any markdown code fences if present
    const clean = textBlocks.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Analysis failed. Product ingredients may not be available online." });
  }
}
