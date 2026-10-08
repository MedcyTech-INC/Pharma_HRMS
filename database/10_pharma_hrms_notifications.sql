-- Create Notifications Table
CREATE TABLE IF NOT EXISTS public.pharma_hrms_notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    recipient_id VARCHAR(50) NOT NULL REFERENCES public.pharma_hrms_employees(id) ON DELETE CASCADE,
    sender_id VARCHAR(50) REFERENCES public.pharma_hrms_employees(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'visit_submitted', -- e.g., 'visit_submitted', 'leave_request'
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    reference_id UUID -- Could be the ID of the visit, leave request, etc.
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.pharma_hrms_notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own notifications"
    ON public.pharma_hrms_notifications
    FOR SELECT
    USING (recipient_id = current_user_id() OR recipient_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can insert notifications"
    ON public.pharma_hrms_notifications
    FOR INSERT
    WITH CHECK (true); -- Allow any authenticated user to create a notification (e.g. BE sending to RSM)

CREATE POLICY "Users can update their own notifications (e.g. mark as read)"
    ON public.pharma_hrms_notifications
    FOR UPDATE
    USING (recipient_id = current_user_id() OR recipient_id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "Users can delete their own notifications"
    ON public.pharma_hrms_notifications
    FOR DELETE
    USING (recipient_id = current_user_id() OR recipient_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- Enable Realtime
alter publication supabase_realtime add table public.pharma_hrms_notifications;
