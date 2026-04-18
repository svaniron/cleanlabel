function extractJSON(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

// Search Open Food Facts for a product by name
async function searchOpenFoodFacts(productName) {
  try {
    const query = encodeURIComponent(productName);
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,brands,ingredients_text,ingredients_text_en`;
    const res = await fetch(url, {
      headers: { "User-Agent": "CleanLabel App - food additive scanner - contact@cleanlabel.app" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.products || data.products.length === 0) return null;

    // Find the best match - prefer products with ingredients text
    const withIngredients = data.products.filter(p =>
      (p.ingredients_text || p.ingredients_text_en) &&
      (p.ingredients_text || p.ingredients_text_en).length > 20
    );

    const best = withIngredients[0] || data.products[0];
    if (!best) return null;

    const ingredients = best.ingredients_text_en || best.ingredients_text || null;
    if (!ingredients) return null;

    return {
      product_name: `${best.brands ? best.brands + ' ' : ''}${best.product_name}`.trim(),
      ingredients_raw: ingredients,
      source: "Open Food Facts database"
    };
  } catch (err) {
    console.error("Open Food Facts error:", err);
    return null;
  }
}

// Use Claude + web search to find ingredients when OFF doesn't have it
async function searchWebForIngredients(productName, apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: `You are a food research assistant. Your ONLY job is to find the exact, complete, current ingredients list for a food product.

Search the web for the product's official ingredients. Look for:
1. The brand's official website
2. The USDA FoodData Central database
3. Reliable grocery retailer sites (Walmart, Target, Kroger)

Return ONLY a JSON object:
{"product_name":"exact name found","ingredients_raw":"FULL ingredients list exactly as written on the label","source":"where you found it"}

The ingredients_raw must be the complete, verbatim ingredients list — do not summarize or abbreviate.
If you cannot find the exact ingredients, return {"product_name":"${productName}","ingredients_raw":null,"source":null}
Output ONLY valid JSON, nothing else.`,
      tools: [{
        type: "web_search_20250305",
        name: "web_search"
      }],
      messages: [{
        role: "user",
        content: `Find the complete ingredients list for: "${productName}". Search the official brand website or USDA database. Return only JSON.`
      }]
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(`API error: ${data.error.message}`);

  const raw = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
  if (!raw) return null;

  return extractJSON(raw);
}

// Analyze ingredients with Claude
async function analyzeIngredients(productName, ingredientsRaw, source, apiKey) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: `You are a food safety expert analyzing food additives.

You will be given a real, verified ingredients list. Analyze it and identify ALL food additives present.

Return ONLY a valid JSON object:
{
  "product_name": "product name",
  "ingredients_source": "source of ingredients",
  "ingredients_raw": "the full ingredients text provided",
  "scan_score": 0-100,
  "summary": "2 sentence summary",
  "additives": [
    {
      "name": "additive name",
      "code": "E-number or null",
      "risk_level": "high | moderate | low | safe",
      "concern": "one sentence health concern",
      "banned_in": ["country or region"],
      "evidence": "one sentence about research",
      "alternatives": "cleaner alternative"
    }
  ]
}

scan_score: 100 = perfectly clean ingredients, 0 = very concerning.
Only flag actual additives — NOT natural ingredients like sugar, salt, flour, water, milk, eggs, spices, oils, fruits, vegetables.
Flag: artificial dyes (Red 40, Yellow 5/6, Blue 1/2), preservatives (BHA, BHT, TBHQ, sodium nitrite, sodium benzoate), artificial sweeteners (aspartame, sucralose, saccharin, acesulfame-K), emulsifiers (carrageenan, polysorbate 80, DATEM), BVO, potassium bromate, azodicarbonamide, titanium dioxide, propyl gallate, artificial flavors, HFCS (flag as low concern), MSG.
Output ONLY valid JSON. Nothing else.`,
      messages: [{
        role: "user",
        content: `Product: ${productName}
Ingredients source: ${source}
Full ingredients list:
${ingredientsRaw}

Analyze all additives in this ingredients list and return the JSON.`
      }]
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(`API error: ${data.error.message}`);

  const raw = (data.content || []).map(b => b.text || "").join("").trim();
  if (!raw) throw new Error("Empty response from analysis");

  const parsed = extractJSON(raw);
  if (!parsed) throw new Error(`Could not parse analysis response: ${raw.slice(0, 200)}`);

  return parsed;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { productName } = req.body;
  if (!productName) return res.status(400).json({ error: "No product name provided" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({
    error: "ANTHROPIC_API_KEY not set",
    hint: "Add it in Vercel → Settings → Environment Variables, then redeploy"
  });

  try {
    // Step 1: Try Open Food Facts first (free, no API key, very accurate)
    let ingredientsData = await searchOpenFoodFacts(productName);
    let usedWebSearch = false;

    // Step 2: Fall back to web search if OFF doesn't have it
    if (!ingredientsData || !ingredientsData.ingredients_raw) {
      console.log(`OFF miss for "${productName}", trying web search`);
      usedWebSearch = true;
      try {
        ingredientsData = await searchWebForIngredients(productName, apiKey);
      } catch (err) {
        console.error("Web search fallback failed:", err.message);
        ingredientsData = null;
      }
    }

    // Step 3: If we still have nothing, analyze from Claude's knowledge but flag it
    if (!ingredientsData || !ingredientsData.ingredients_raw) {
      console.log(`No ingredients found for "${productName}", using Claude knowledge`);
      const result = await analyzeIngredients(
        productName,
        `Unknown — ingredients not found in database. Analyzing based on typical known formulation for ${productName}.`,
        "Claude knowledge base (ingredients not verified — may not be current)",
        apiKey
      );
      result.ingredients_warning = "⚠️ Ingredients not found in live database. Results based on Claude's training data and may not reflect the current formula. For accuracy, check the physical label.";
      return res.status(200).json(result);
    }

    // Step 4: Analyze the real ingredients we found
    const result = await analyzeIngredients(
      ingredientsData.product_name || productName,
      ingredientsData.ingredients_raw,
      ingredientsData.source || (usedWebSearch ? "Web search" : "Open Food Facts"),
      apiKey
    );

    // Override with real data to ensure accuracy
    result.ingredients_raw = ingredientsData.ingredients_raw;
    result.ingredients_source = ingredientsData.source || result.ingredients_source;

    return res.status(200).json(result);

  } catch (err) {
    console.error("search-and-analyze error:", err);
    return res.status(500).json({
      error: err.message || "Analysis failed",
      hint: "Check your API key and credits at console.anthropic.com"
    });
  }
}
