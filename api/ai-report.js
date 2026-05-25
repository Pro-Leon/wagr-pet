// Vercel API route for AI Vet Reports
// Hides OpenRouter API key from client

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MODELS = [
  'deepseek/deepseek-v4-flash:free',
  'z-ai/glm-4.5-air:free',
  'google/gemma-4-31b-it:free',
];

const SYSTEM_PROMPT = 'You are a veterinary assistant. Analyze the pet\'s recent logs and generate a concise clinical summary report. Include: 1) Overview of eating/medication/bathroom patterns, 2) Any notable changes or concerns, 3) Recommendations for the next vet visit. Keep it brief and clinical. Use markdown formatting.';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', 'https://pupfile.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }

  const token = authHeader.split('Bearer ')[1];
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single();

  const tier = profile?.tier || 'starter';
  if (tier !== 'family') {
    return res.status(403).json({ error: 'AI Vet Reports are available on the Pro plan.' });
  }

  const OPENROUTER_KEY = process.env.OPENROUTER_KEY;

  if (!OPENROUTER_KEY) {
    return res.status(500).json({ error: 'AI service not configured' });
  }

  const { logSummary } = req.body;
  let lastError = null;

  for (const model of MODELS) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://pupfile.com',
          'X-Title': 'PupFile',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Here are the last 30 days of logs for this pet:\n\n${logSummary}` },
          ],
        }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        const msg = result.error?.message || result.error || `HTTP ${response.status}`;
        console.error(`Model ${model} failed:`, msg);
        lastError = msg;
        continue;
      }

      console.log(`AI report generated with model: ${model}`);
      return res.status(200).json({
        report: result.choices[0].message.content,
      });
    } catch (error) {
      console.error(`Model ${model} threw:`, error.message);
      lastError = error.message;
    }
  }

  return res.status(500).json({ error: `All models failed. Last error: ${lastError}` });
}