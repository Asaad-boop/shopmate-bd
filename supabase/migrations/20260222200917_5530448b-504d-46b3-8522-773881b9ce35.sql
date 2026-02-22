ALTER TABLE public.agents 
ADD COLUMN contact_person character varying DEFAULT NULL,
ADD COLUMN profile_image_url text DEFAULT NULL;