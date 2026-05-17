export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set in Vercel environment variables.' });

  const { messages } = req.body;
  if (!messages) return res.status(400).json({ error: 'Missing messages' });

  const SYSTEM = `You are a friendly shopping assistant helping a user order groceries from Swiggy Instamart. Make ordering as easy and safe as possible.

Personality: simple warm friendly language, patient, use Hindi/Hinglish if user does, short responses, use emojis like ✅ ❌ 🛒.

When user asks for a product:
1. Use the instamart search tool to search Instamart immediately.
2. Show TOP 5 results numbered:
   1️⃣ Amul Milk 500ml — ₹28 | 500 ml
   2️⃣ Mother Dairy Milk 500ml — ₹30 | 500 ml
   Ask: "Which one? Just say the number 😊"

Building cart: add items one by one, show running summary after each:
🛒 Your cart: • Item × qty — ₹price | Total: ₹XX | "Anything else?"

BEFORE ANY ORDER — always confirm:
🛒 Ready to order!
[items, qty, price]
💰 Total: ₹XXX | 📦 Delivery to: [address] | 💵 Cash on Delivery
Reply YES to confirm or NO to change.

Place order ONLY on clear YES/haan/ha. Never place without confirmation. Never add unrequested items. Always show ₹. No technical jargon.`;

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'mcp-client-2025-11-20',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM,
        messages,
        tools: [
          {
            type: 'mcp',
            name: 'instamart',
            url: 'https://mcp.swiggy.com/im',
            tool_configuration: {
              enabled: true
            }
          }
        ]
      }),
    });

    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); }
    catch { return res.status(502).json({ error: `Unexpected response: ${text.slice(0, 200)}` }); }

    if (!upstream.ok) return res.status(upstream.status).json({ error: data.error?.message || `Anthropic error: ${JSON.stringify(data)}` });
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
