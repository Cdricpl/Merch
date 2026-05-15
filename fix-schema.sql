-- =====================================================
-- Script COMPLET de création du schéma Supabase
-- À coller dans : Supabase → SQL Editor → New query
-- =====================================================

-- 1. Table bands
CREATE TABLE IF NOT EXISTS public.bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access" ON public.bands;
CREATE POLICY "Open access" ON public.bands
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 2. Insérer le groupe Ardenne Heavy avec le bon ID
INSERT INTO public.bands (id, name, join_code, created_by)
VALUES (
  'd87f9ff0-87ff-4b36-a060-498d5f822f0f',
  'Ardenne Heavy',
  'ARDENNE',
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Ajouter les colonnes manquantes dans concerts
ALTER TABLE public.concerts
  ADD COLUMN IF NOT EXISTS concert_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS band_id UUID;

-- Mettre à jour band_id si la colonne était nulle
UPDATE public.concerts
  SET band_id = 'd87f9ff0-87ff-4b36-a060-498d5f822f0f'
  WHERE band_id IS NULL;

ALTER TABLE public.concerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access" ON public.concerts;
CREATE POLICY "Open access" ON public.concerts
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. Table products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL,
  name TEXT NOT NULL,
  variant TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access" ON public.products;
CREATE POLICY "Open access" ON public.products
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 5. Table sales
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concert_id UUID NOT NULL,
  product_id UUID NOT NULL,
  band_id UUID NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  sold_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access" ON public.sales;
CREATE POLICY "Open access" ON public.sales
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. Table inventory
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concert_id UUID NOT NULL,
  product_id UUID NOT NULL,
  band_id UUID NOT NULL,
  initial_stock INTEGER NOT NULL DEFAULT 0,
  manual_remaining INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(concert_id, product_id)
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access" ON public.inventory;
CREATE POLICY "Open access" ON public.inventory
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
