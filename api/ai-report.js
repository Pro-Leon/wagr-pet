// Vercel API route for AI Vet Reports
// Hides OpenRouter API key from client

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const OPENROUTER_KEY = process.env.OPENROUTER_KEY;
  
  if (!OPENROUTER_KEY) {
    return res.status(500).json({ error: 'AI service not configured' });
  }

  try {
    const { logSummary } = req.body;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://houndos.app',
        'X-Title': 'Wagr'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          {
            role: 'system',
            content: 'You are a veterinary assistant. Analyze the pet\'s recent logs and generate a concise clinical summary report. Include: 1) Overview of eating/medication/bathroom patterns, 2) Any notable changes or concerns, 3) Recommendations for the next vet visit. Keep it brief and clinical. Use markdown formatting.'
          },
          {
            role: 'user',
            content: `Here are the last 30 days of logs for this pet:\n\n${logSummary}`
          }
        ]
      })
    });

    const result = await response.json();
    
    if (result.error) {
      return res.status(400).json({ error: result.error.message });
    }

    return res.status(200).json({ 
      report: result.choices[0].message.content 
    });
  } catch (error) {
    console.error('AI Report Error:', error);
    return res.status(500).json({ error: 'Failed to generate report' });
  }
}