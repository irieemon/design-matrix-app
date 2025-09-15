-- Safe Project Files Table Migration
-- Handles type casting issues and existing schema variations

-- First, let's check if the table already exists and drop it if needed
DROP TABLE IF EXISTS public.project_files CASCADE;

-- Create storage bucket if it doesn't exist (ignore errors if it exists)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create project_files table with explicit types
CREATE TABLE public.project_files (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL,
    name text NOT NULL,
    original_name text NOT NULL,
    file_type text NOT NULL,
    file_size integer NOT NULL,
    storage_path text NOT NULL UNIQUE,
    content_preview text,
    mime_type text,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add foreign key constraints separately (more robust)
DO $$
BEGIN
    -- Add project_id foreign key if projects table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
        ALTER TABLE public.project_files 
        ADD CONSTRAINT fk_project_files_project_id 
        FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
    END IF;

    -- Add uploaded_by foreign key if user_profiles table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_profiles') THEN
        ALTER TABLE public.project_files 
        ADD CONSTRAINT fk_project_files_uploaded_by 
        FOREIGN KEY (uploaded_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- Add indexes for performance
CREATE INDEX idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX idx_project_files_uploaded_by ON public.project_files(uploaded_by);
CREATE INDEX idx_project_files_created_at ON public.project_files(created_at DESC);
CREATE INDEX idx_project_files_storage_path ON public.project_files(storage_path);

-- Simple RLS policies that avoid complex joins for now
CREATE POLICY "Allow all for development" ON public.project_files
    FOR ALL USING (true);

-- If you want more restrictive policies later, you can replace the above with:
-- CREATE POLICY "Users can view project files they have access to" ON public.project_files
--     FOR SELECT USING (
--         auth.uid() IS NULL OR  -- Allow if no auth (development mode)
--         EXISTS (
--             SELECT 1 FROM public.projects p
--             WHERE p.id = project_files.project_id 
--             AND (p.owner_id::text = auth.uid()::text OR p.owner_id IS NULL)
--         )
--     );

-- Add trigger to automatically update updated_at timestamp
DO $$
BEGIN
    -- Only create trigger if the function exists
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE TRIGGER update_project_files_updated_at
            BEFORE UPDATE ON public.project_files
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- Create the update function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Now create the trigger
DROP TRIGGER IF EXISTS update_project_files_updated_at ON public.project_files;
CREATE TRIGGER update_project_files_updated_at
    BEFORE UPDATE ON public.project_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Set up storage policies for the bucket
CREATE POLICY "Allow authenticated uploads" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'project-files' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated downloads" ON storage.objects
    FOR SELECT USING (bucket_id = 'project-files' AND auth.role() = 'authenticated');

CREATE POLICY "Allow authenticated deletes" ON storage.objects
    FOR DELETE USING (bucket_id = 'project-files' AND auth.role() = 'authenticated');

-- Table comment
COMMENT ON TABLE public.project_files IS 'File uploads for projects with Supabase Storage integration';

-- Success message
SELECT 'Project files table created successfully! 📁' as result,
       'Files will now be stored in Supabase Storage with metadata in this table.' as note;