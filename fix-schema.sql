-- =====================================================
-- Script de correction du schéma Supabase
-- À coller dans : Supabase → SQL Editor → New query
-- =====================================================

-- 1. Ajouter les colonnes manquantes dans concerts
ALTER TABLE public.concerts
  ADD COLUMN IF NOT EXISTS concert_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Créer la table products
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

-- 3. Créer la table sales
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

-- 4. Créer la table inventory
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

-- 5. Corriger RLS concerts (accès libre)
DROP POLICY IF EXISTS "Open access" ON public.concerts;
CREATE POLICY "Open access" ON public.concerts
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 6. S'assurer que le groupe Ardenne Heavy existe avec le bon ID
INSERT INTO public.bands (id, name, join_code, created_by)
VALUES (
  'd87f9ff0-87ff-4b36-a060-498d5f822f0f',
  'Ardenne Heavy',
  'ARDENNE',
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO NOTHING;
