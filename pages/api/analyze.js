export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { text, imageBase64 } = req.body;

  if (!text && !imageBase64) {
    return res.status(400).json({ error: "No input provided" });
  }

  const SYSTEM_PROMPT = `You are a food safety expert and nutritional scientist specializing in food additives.
When given an ingredient list (either typed or extracted from an image), analyze it and identify food additives.

For each additive found, return a JSON array with objects containing:
- name: the additive name
- code: E-number or common code if applicable (or null)
- risk_level: "high", "moderate", "low", or "safe"
- concern: one sentence describing the main health concern
- banned_in: array of regions/countries where it's banned or restricted (e.g., ["EU", "Norway", "Japan"])
- evidence: one sentence about the research evidence
- alternatives: one example of a cleaner alternative ingredient

Also include a top-level "summary" string (2 sentences max) and "scan_score" from 0-100 (100 = perfectly clean).

Focus especially on: artificial dyes (Red 40, Yellow 5/6, Blue 1/2), preservatives (BHA, BHT, TBHQ, sodium nitrite),
artificial sweeteners (aspartame, saccharin, acesulfame-K), emulsifiers (carrageenan, polysorbate 80),
brominated vegetable oil (BVO), potassium bromate, propyl gallate, azodicarbonamide.

Respond ONLY with valid JSON. No markdown, no backticks, no preamble.`;

  let messages;

  if (imageBase64) {
    messages = [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: imageBase64 }
        },
        {
          type: "text",
          text: "Extract the ingredients list from this food product label image, then analyze all food additives found. Return the JSON analysis."
        }
      ]
    }];
  } else {
    messages = [{
      role: "user",
      content: `Analyze these ingredients for food additives:\n\n${text}`
    }];
  }

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
        system: SYSTEM_PROMPT,
        messages
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const raw = data.content?.map(b => b.text || "").join("").trim();
    const parsed = JSON.parse(raw);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Analysis failed. Please try again." });
  }
}
