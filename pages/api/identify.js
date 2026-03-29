function extractJSON(text) {
  // Try direct parse first
  try { return JSON.parse(text); } catch {}
  // Try extracting JSON block from markdown or mixed text
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { imageBase64 } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "No image provided" });

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
        max_tokens: 300,
        system: `You identify food products from photos. Always respond with ONLY a JSON object — no other text, no markdown fences, no explanation before or after.

Format:
{"brand":"Spam","product":"Classic","full_name":"Spam Classic","confidence":"high"}

If unsure, use confidence "low". Always output valid JSON and nothing else.`,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data: imageBase64 } },
            { type: "text", text: "Identify this food product. Output only JSON." }
          ]
        }]
      })
    });

    const data = await response.json();

    // Surface Anthropic errors clearly
    if (data.error) {
      return res.status(500).json({ error: `Anthropic API error: ${data.error.message}` });
    }

    const raw = (data.content || []).map(b => b.text || "").join("").trim();

    if (!raw) {
      return res.status(500).json({ error: "Empty response from API. Check your API key in Vercel environment variables." });
    }

    const parsed = extractJSON(raw);
    if (!parsed) {
      return res.status(500).json({ error: `Could not parse response: ${raw.slice(0, 200)}` });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error("identify error:", err);
    return res.status(500).json({ error: err.message || "Server error in identify route" });
  }
}
