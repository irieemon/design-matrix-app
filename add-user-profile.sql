-- Add User Profile Manually
-- Replace 'YOUR_USER_ID_HERE' with the actual UUID from the console logs

-- Insert user profile manually (replace the UUID with the one from console logs)
INSERT INTO public.user_profiles (id, email, full_name, created_at, updated_at)
VALUES (
    'e5aa576d-18bf-417a-86a9-1de0518f4f0e'::uuid,  -- UUID from console logs
    'sean@lakehouse.net',
    'sean@lakehouse.net',
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

-- Verify the user profile was created
SELECT * FROM public.user_profiles WHERE email = 'sean@lakehouse.net';