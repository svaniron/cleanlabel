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
        model: "claude-opus-4-5",
        max_tokens: 300,
        system: `You are a product recognition assistant. When shown a food product image, identify the brand name and product name as precisely as possible.

Respond ONLY with a JSON object like:
{
  "brand": "Spam",
  "product": "Classic",
  "full_name": "Spam Classic",
  "confidence": "high"
}

If you cannot identify the product clearly, set confidence to "low" and do your best guess.
Respond ONLY with valid JSON. No markdown, no backticks, no explanation.`,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: imageBase64 }
            },
            { type: "text", text: "What food product is this? Identify the brand and product name." }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const raw = data.content?.map(b => b.text || "").join("").trim();
    const parsed = JSON.parse(raw);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Could not identify product." });
  }
}
