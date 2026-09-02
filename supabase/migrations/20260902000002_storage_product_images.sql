-- =========================================================
-- STORAGE BUCKET: product-images
-- =========================================================

-- Create the product-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, owner, created_at, updated_at)
VALUES ('product-images', 'product-images', true, 'postgres', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects for product-images bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Public read access to product-images bucket
CREATE POLICY "Public read product images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

-- Authenticated admins can upload to product-images
CREATE POLICY "Admins upload product images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin')
);

-- Authenticated admins can update their own uploads
CREATE POLICY "Admins update own product images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin')
);

-- Authenticated admins can delete their own uploads
CREATE POLICY "Admins delete own product images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'product-images'
    AND public.has_role(auth.uid(), 'admin')
);

-- =========================================================
-- PRODUCT IMAGES: Update RLS for admin management via product_images table
-- =========================================================
-- Admins can manage product_images entries (which reference storage objects)
CREATE POLICY "Admins manage product images entries"
ON public.product_images FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));