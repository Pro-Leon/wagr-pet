-- Add chat_queries_used column for free-tier assistant limit
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chat_queries_used INTEGER DEFAULT 0;
