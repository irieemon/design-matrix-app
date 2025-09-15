-- Project Files Table Migration
-- Adds permanent file storage to replace localStorage-only file management

-- Create project_files table
CREATE TABLE public.project_files (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    original_name text NOT NULL,
    file_type text NOT NULL,
    file_size integer NOT NULL,
    storage_path text NOT NULL UNIQUE, -- Path in Supabase Storage
    content_preview text, -- Extracted text content for AI analysis
    mime_type text,
    uploaded_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- Add indexes for performance
CREATE INDEX idx_project_files_project_id ON public.project_files(project_id);
CREATE INDEX idx_project_files_uploaded_by ON public.project_files(uploaded_by);
CREATE INDEX idx_project_files_created_at ON public.project_files(created_at DESC);
CREATE INDEX idx_project_files_storage_path ON public.project_files(storage_path);

-- RLS Policies: Users can access files for projects they have access to
CREATE POLICY "Users can view project files they have access to" ON public.project_files
    FOR SELECT USING (
        auth.uid() IS NULL OR  -- Allow if no auth (development mode)
        project_id IN (
            SELECT id FROM public.projects 
            WHERE owner_id = auth.uid()::uuid OR
            owner_id IS NULL OR  -- Allow for projects without owner
            id IN (
                SELECT project_id FROM public.project_collaborators 
                WHERE user_id = auth.uid()::uuid
            ) OR
            (team_id IS NOT NULL AND team_id IN (
                SELECT team_id FROM public.team_members 
                WHERE user_id = auth.uid()::uuid
            ))
        )
    );

-- Users can upload files to projects they can edit
CREATE POLICY "Users can upload files to editable projects" ON public.project_files
    FOR INSERT WITH CHECK (
        auth.uid() IS NULL OR  -- Allow if no auth (development mode)
        project_id IN (
            SELECT id FROM public.projects 
            WHERE owner_id = auth.uid()::uuid OR
            owner_id IS NULL OR  -- Allow for projects without owner
            id IN (
                SELECT project_id FROM public.project_collaborators 
                WHERE user_id = auth.uid()::uuid AND role IN ('owner', 'editor')
            )
        )
    );

-- Users can delete files they uploaded or if they're project owners/editors
CREATE POLICY "Users can delete their own files or if project editor" ON public.project_files
    FOR DELETE USING (
        auth.uid() IS NULL OR  -- Allow if no auth (development mode)
        uploaded_by = auth.uid()::uuid OR
        project_id IN (
            SELECT id FROM public.projects 
            WHERE owner_id = auth.uid()::uuid OR
            id IN (
                SELECT project_id FROM public.project_collaborators 
                WHERE user_id = auth.uid()::uuid AND role IN ('owner', 'editor')
            )
        )
    );

-- Add trigger to automatically update updated_at timestamp
CREATE TRIGGER update_project_files_updated_at
    BEFORE UPDATE ON public.project_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Table comment
COMMENT ON TABLE public.project_files IS 'File uploads for projects with Supabase Storage integration';

-- Success message
SELECT 'Project files table created successfully! 📁' as result,
       'Files will now be stored in Supabase Storage with metadata in this table.' as note;