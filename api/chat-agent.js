import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://rbhqvginjduyjzyfzxbq.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const MODEL = 'z-ai/glm-4.5-air:free';

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

  const { message, petId } = req.body;
  if (!message || !petId) return res.status(400).json({ error: 'Missing message or petId' });

  const { data: pet } = await supabase
    .from('pets')
    .select('id, name, breed, user_id')
    .eq('id', petId)
    .single();

  if (!pet || pet.user_id !== user.id) return res.status(403).json({ error: 'Pet not found' });

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single();

  const tier = profile?.tier || 'starter';
  if (tier === 'starter') {
    return res.status(403).json({ error: 'Upgrade to Basic or higher to use the AI Assistant.' });
  }
  const canLog = ['family', 'pro'].includes(tier);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [recentLogsRes, foodLogsRes] = await Promise.all([
    supabase
      .from('pet_logs')
      .select('log_type, title, notes, created_at')
      .eq('pet_id', petId)
      .gte('created_at', sevenDaysAgo)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('food_logs')
      .select('food_type, brand_name, product_name, portion_size, portion_unit, notes, fed_at')
      .eq('pet_id', petId)
      .gte('fed_at', sevenDaysAgo)
      .order('fed_at', { ascending: false })
      .limit(30),
  ]);

  const recentLogs = recentLogsRes.data || [];
  const foodLogs = foodLogsRes.data || [];
  const todayLogs = recentLogs.filter(l => l.created_at >= todayStart);
  const medications = recentLogs.filter(l => l.log_type === 'medication');

  const formatTime = (d) => new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const formatDate = (d) => new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  const systemPrompt = `You are Pup File Assistant, a helpful pet care AI for ${user.email?.split('@')[0] || 'the pet owner'}. You help manage care for ${pet.name}, a ${pet.breed || 'dog'}.

Today's logs for ${pet.name} so far:
${todayLogs.length === 0 ? 'No activity logged today yet.' : todayLogs.map(l => `[${formatTime(l.created_at)}] ${l.log_type}: ${l.title}${l.notes ? ' — ' + l.notes : ''}`).join('\n')}

Recent logs (last 7 days):
${recentLogs.length === 0 ? 'No recent activity.' : recentLogs.map(l => `[${formatDate(l.created_at)}] ${l.log_type}: ${l.title}${l.notes ? ' — ' + l.notes : ''}`).join('\n')}

${foodLogs.length > 0 ? `Recent meals:\n${foodLogs.map(l => `[${formatDate(l.fed_at)}] ${l.food_type}: ${l.brand_name || ''} ${l.product_name || ''} (${l.portion_size} ${l.portion_unit})`).join('\n')}` : ''}

${medications.length > 0 ? `Known medications: ${[...new Set(medications.map(m => m.title))].join(', ')}` : 'No known medications on file.'}

${!canLog ? 'NOTE: You are in read-only mode. You can answer questions about the pet\'s logs but CANNOT create new entries.' : ''}

You must respond with ONLY valid JSON — no additional text, no markdown formatting, no code fences. The JSON must have this structure:
{
  "reply": "Your conversational response to the user",
  "actions": []
}

For logging actions, use:
{
  "type": "log_timeline",
  "data": {
    "log_type": "meal|medication|bathroom|custom",
    "title": "Brief title of the event",
    "notes": "Optional details the user provided"
  }
}

RULES:
1. NEVER invent log data. If unsure, say so.
2. If ambiguous, ask for clarification before logging.
3. Always confirm what you logged.
4. Use "title" for the event name, "notes" for details.
5. Use the current date/time unless the user specifies otherwise (e.g. "yesterday").
6. Keep replies friendly and conversational.
7. ${!canLog ? 'You are in READ-ONLY mode. Never include actions.' : 'You may include log_timeline actions when the user asks you to log something.'}
8. For food queries, use the provided meal data. Don't log food entries — just timeline entries with log_type "meal".
9. For summary requests, describe the recent patterns in plain English.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pupfile.com',
        'X-Title': 'Pup File',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message },
        ],
      }),
    });

    const result = await response.json();
    if (!response.ok || result.error) {
      return res.status(400).json({ error: result.error?.message || `HTTP ${response.status}` });
    }

    let content = result.choices[0].message.content;

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      const match = content.match(/```(?:json)?\s*({[\s\S]*?})\s*```/);
      if (match) {
        try { parsed = JSON.parse(match[1]); } catch { parsed = null; }
      } else {
        parsed = null;
      }
    }

    if (!parsed || !parsed.reply) {
      return res.status(200).json({ reply: content, actions: [] });
    }

    const executed = [];
    if (canLog && parsed.actions && Array.isArray(parsed.actions)) {
      for (const action of parsed.actions) {
        if (action.type === 'log_timeline' && action.data) {
          const LOG_TYPE_MAP = { feed: 'meal', walk: 'bathroom', symptom: 'custom' };
          const logType = LOG_TYPE_MAP[action.data.log_type] || action.data.log_type || 'custom';
          const { data: log, error } = await supabase
            .from('pet_logs')
            .insert({
              pet_id: petId,
              user_id: user.id,
              log_type: logType,
              title: action.data.title || 'Logged via Assistant',
              notes: action.data.notes || '',
              created_at: action.data.created_at || new Date().toISOString(),
            })
            .select()
            .single();

          if (!error) {
            executed.push({ type: 'log_timeline', id: log.id, log_type: logType });
          } else {
            console.error('Chat agent insert error:', error);
          }
        }
      }
    }

    return res.status(200).json({
      reply: parsed.reply,
      actions: executed,
    });

  } catch (error) {
    console.error('Chat agent error:', error);
    return res.status(500).json({ error: 'Failed to process message' });
  }
}
