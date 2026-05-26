// Vercel API route for Paystack subscriptions
// Hides Paystack secret key from client

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const origin = req.headers.origin;
  if (origin && origin !== 'https://pupfile.com' && !origin.startsWith('http://localhost:')) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }
  res.setHeader('Access-Control-Allow-Origin', origin || 'https://pupfile.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
  
  console.log('Environment check - Paystack secret:', PAYSTACK_SECRET ? 'SET' : 'NOT SET');
  
  if (!PAYSTACK_SECRET) {
    return res.status(500).json({ 
      error: 'Payment service not configured',
      hint: 'Make sure PAYSTACK_SECRET_KEY is set in Vercel project settings'
    });
  }

  try {
    const { email, plan, userId } = req.body;

    // Validate inputs
    if (!email || !plan) {
      return res.status(400).json({ error: 'Email and plan are required' });
    }

    const planCodes = {
      basic_monthly: 'PLN_x7yn9h54irimq96',
      basic_yearly: 'PLN_omjluu4cllyzgyd',
      family_monthly: 'PLN_38n01fa6kxbk9vn',
      family_yearly: 'PLN_3r0edwfqim3uixw'
    };

    const planCode = planCodes[plan];
    
    if (!planCode) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // Initialize a subscription checkout session
    // Using Paystack's checkout API
    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        plan: planCode,
        currency: 'USD',
        callback_url: process.env.APP_URL || 'https://pupfile.com/dashboard',
        metadata: {
          user_id: userId,
          plan_type: plan
        }
      })
    });

    const result = await response.json();

    if (!result.status) {
      return res.status(400).json({ error: result.message });
    }

    return res.status(200).json({
      authorization_url: result.data.authorization_url,
      reference: result.data.reference
    });
  } catch (error) {
    console.error('Paystack Error:', error);
    return res.status(500).json({ error: 'Payment initialization failed' });
  }
}