-- Add AI analysis columns to project_files table
-- Run this in your Supabase SQL editor

ALTER TABLE project_files 
ADD COLUMN IF NOT EXISTS ai_analysis JSONB,
ADD COLUMN IF NOT EXISTS analysis_status TEXT CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed', 'skipped'));

-- Add index for faster queries on analysis status
CREATE INDEX IF NOT EXISTS idx_project_files_analysis_status ON project_files(analysis_status);

-- Add comment for documentation
COMMENT ON COLUMN project_files.ai_analysis IS 'Cached AI analysis results in JSON format containing summary, key_insights, extracted_text, etc.';
COMMENT ON COLUMN project_files.analysis_status IS 'Status of AI analysis: pending, analyzing, completed, failed, or skipped';