
// Serverless function for Vercel (Node 18 Runtime)

export default async function handler(req, res) {
  // Allow CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { contents } = req.body;

  if (!contents) {
    return res.status(400).json({ error: 'Body "contents" is required' });
  }

  const keysString =
    process.env.GEMINI_API_KEYS ||
    process.env.GENERATIVE_API_KEY ||
    "";

  const apiKeys = keysString
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  if (apiKeys.length === 0) {
    return res.status(500).json({
      error: "Server configuration error",
      message: "No API keys found in environment variables",
    });
  }

  let lastError = null;

  for (let i = 0; i < apiKeys.length; i++) {
    const currentKey = apiKeys[i];
    const externalApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${currentKey}`;

    try {
      const response = await fetch(externalApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      });

      if (response.ok) {
        const data = await response.json();
        return res.status(200).json(data);
      }

      if (response.status === 429) {
        lastError = { status: 429, message: "Rate limit exceeded" };
        continue;
      }

      const errorData = await response.json();
      lastError = { status: response.status, details: errorData };
      break;
    } catch (error) {
      lastError = { status: 500, message: "Network error" };
    }
  }

  return res.status(lastError?.status || 500).json({
    error: "Generation failed",
    details: lastError,
  });
}
