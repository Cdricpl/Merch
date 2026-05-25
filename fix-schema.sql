-- =====================================================
-- Script COMPLET du schéma + stock global Ardenne Heavy
-- À coller dans : Supabase → SQL Editor → Run
-- Idempotent : peut être exécuté plusieurs fois sans danger.
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

INSERT INTO public.bands (id, name, join_code, created_by)
VALUES (
  'd87f9ff0-87ff-4b36-a060-498d5f822f0f',
  'Ardenne Heavy',
  'ARDENNE',
  '00000000-0000-0000-0000-000000000000'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Concerts
ALTER TABLE public.concerts
  ADD COLUMN IF NOT EXISTS concert_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS band_id UUID;

UPDATE public.concerts
  SET band_id = 'd87f9ff0-87ff-4b36-a060-498d5f822f0f'
  WHERE band_id IS NULL;

ALTER TABLE public.concerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access" ON public.concerts;
CREATE POLICY "Open access" ON public.concerts
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 3. Products avec STOCK GLOBAL
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL,
  name TEXT NOT NULL,
  variant TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Ajouter la colonne stock si la table existait déjà
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 0;
-- Unicité pour permettre l'upsert
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_band_name_variant
  ON public.products (band_id, name, COALESCE(variant, ''));

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Open access" ON public.products;
CREATE POLICY "Open access" ON public.products
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 4. Sales
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

-- 5. Inventory (obsolete maintenant mais on la garde pour compat)
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

-- 6. TRIGGER : décrémente / réincrémente automatiquement le stock à chaque vente
CREATE OR REPLACE FUNCTION public.adjust_stock_on_sale()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.products SET stock = stock - NEW.quantity WHERE id = NEW.product_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.products SET stock = stock + OLD.quantity WHERE id = OLD.product_id;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.products SET stock = stock - (NEW.quantity - OLD.quantity) WHERE id = NEW.product_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sales_adjust_stock ON public.sales;
CREATE TRIGGER sales_adjust_stock
AFTER INSERT OR UPDATE OR DELETE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.adjust_stock_on_sale();

-- 7. Insertion / mise à jour des articles avec leur stock réel
INSERT INTO public.products (band_id, name, variant, price_cents, stock, sort_order) VALUES
  -- CDs (10€)
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'CD', 'No Nut''s no Glory',     1000, 45,  10),
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'CD', 'The EP with no names',   1000, 71,  20),
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'CD', '20th Anniversaire',      1000, 22,  30),

  -- Décapsuleur (5€)
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'Décapsuleur', NULL,             500, 59,  40),

  -- Negan Homme (15€)
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'Negan H',   '2XL',             1500,  3, 110),

  -- AH Femme (15€)
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'AH Femme',  'S',               1500,  8, 120),
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'AH Femme',  'M',               1500,  4, 121),
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'AH Femme',  'L',               1500,  4, 122),
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'AH Femme',  'XL',              1500,  1, 123),

  -- AH Homme (15€)
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'AH Homme',  'S',               1500,  9, 130),
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'AH Homme',  'M',               1500,  4, 131),
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'AH Homme',  'L',               1500,  8, 132),
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'AH Homme',  'XL',              1500,  1, 133),

  -- Boris Femme (15€)
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'Boris F',   'S',               1500,  7, 140),
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'Boris F',   'M',               1500,  4, 141),
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'Boris F',   'L',               1500,  2, 142),

  -- Boris Homme (15€)
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'Boris H',   'S',               1500, 12, 150),
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'Boris H',   'M',               1500,  9, 151),
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'Boris H',   'L',               1500, 10, 152),
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'Boris H',   'XL',              1500,  6, 153),
  ('d87f9ff0-87ff-4b36-a060-498d5f822f0f', 'Boris H',   '2XL',             1500,  3, 154)
ON CONFLICT (band_id, name, COALESCE(variant, '')) DO UPDATE
  SET price_cents = EXCLUDED.price_cents,
      stock = EXCLUDED.stock,
      sort_order = EXCLUDED.sort_order;
