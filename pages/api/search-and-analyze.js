function extractJSON(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

const SYSTEM = `You are a food safety expert with comprehensive knowledge of food product ingredients.

When given a product name, do the following:
1. Recall the known ingredients for that product from your training knowledge
2. Identify all food additives in those ingredients
3. Return ONLY a valid JSON object — no text before or after, no markdown fences

JSON format:
{
  "product_name": "exact product name",
  "ingredients_source": "Claude knowledge base",
  "ingredients_raw": "full ingredients list as text",
  "scan_score": 0-100,
  "summary": "2 sentence summary",
  "additives": [
    {
      "name": "Red 40",
      "code": "E129",
      "risk_level": "high",
      "concern": "one sentence",
      "banned_in": ["EU","Norway"],
      "evidence": "one sentence",
      "alternatives": "cleaner option"
    }
  ]
}

risk_level must be one of: "high", "moderate", "low", "safe"
scan_score: 100 = perfectly clean, 0 = very concerning
Only flag actual additives — not natural ingredients like sugar, salt, flour, water, spices.
Focus on: artificial dyes (Red 40, Yellow 5/6, Blue 1/2), preservatives (BHA, BHT, TBHQ, sodium nitrite), artificial sweeteners (aspartame, saccharin, acesulfame-K), emulsifiers (carrageenan, polysorbate 80), BVO, potassium bromate, azodicarbonamide, titanium dioxide, HFCS, MSG, natural flavors if concerning.
If you don't know the exact ingredients, state that in ingredients_raw and provide your best analysis based on typical formulations.
Output ONLY the JSON object. Nothing else.`;

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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: SYSTEM,
        messages: [{
          role: "user",
          content: `Analyze this product for food additives: "${productName}". Return only the JSON object.`
        }]
      })
    });

    const data = await response.json();

    // Surface Anthropic errors clearly
    if (data.error) {
      return res.status(500).json({
        error: `Anthropic API error: ${data.error.message}`,
        hint: "Check that ANTHROPIC_API_KEY is set correctly in Vercel → Settings → Environment Variables"
      });
    }

    const raw = (data.content || []).map(b => b.text || "").join("").trim();

    if (!raw) {
      return res.status(500).json({
        error: "Empty response from API.",
        hint: "Your API key may be missing or invalid. Check Vercel → Settings → Environment Variables."
      });
    }

    const parsed = extractJSON(raw);
    if (!parsed) {
      return res.status(500).json({
        error: `Could not parse API response.`,
        raw: raw.slice(0, 300)
      });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("search-and-analyze error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
