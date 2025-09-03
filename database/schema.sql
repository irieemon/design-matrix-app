-- Create the ideas table
CREATE TABLE IF NOT EXISTS ideas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  content TEXT NOT NULL,
  x INTEGER NOT NULL DEFAULT 260,
  y INTEGER NOT NULL DEFAULT 260,
  priority TEXT NOT NULL DEFAULT 'moderate' CHECK (priority IN ('low', 'moderate', 'high', 'strategic', 'innovation')),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Add RLS (Row Level Security) - for now allow all operations
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

-- Policy to allow all operations for authenticated and anonymous users
CREATE POLICY "Allow all operations on ideas" ON ideas
  FOR ALL USING (true);

-- Add an index for performance
CREATE INDEX IF NOT EXISTS ideas_created_at_idx ON ideas(created_at DESC);

-- Add trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_ideas_updated_at 
  BEFORE UPDATE ON ideas 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();