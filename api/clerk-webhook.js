import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  const svixId = req.headers['svix-id'];
  const svixTimestamp = req.headers['svix-timestamp'];
  const svixSignature = req.headers['svix-signature'];

  if (!svixId || !svixTimestamp || !svixSignature) {
    return res.status(400).json({ error: 'Missing svix headers' });
  }

  if (!webhookSecret) {
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  try {
    const payload = req.body;
    const eventType = payload.type;
    const userData = payload.data;

    if (eventType === 'user.created' || eventType === 'user.updated') {
      const clerkId = userData.id;
      const email = userData.email_addresses?.[0]?.email_address || '';
      const firstName = userData.first_name || '';
      const lastName = userData.last_name || '';
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];
      const avatar = userData.image_url || '';

      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: clerkId,
          email,
          first_name: firstName,
          last_name: lastName,
          name: fullName,
          avatar: avatar.charAt(0).toUpperCase(),
          tier: 'free',
          experience_level: 'fresher',
          target_role: '',
          location: '',
          usage_resume: 0,
          usage_chat: 0,
          usage_build: 0,
          usage_interview: 0,
          last_reset: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }, { onConflict: 'id' });

      if (error) {
        console.error('Supabase upsert error:', error);
        return res.status(500).json({ error: 'Failed to sync user' });
      }
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
