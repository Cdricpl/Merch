
-- 1) Seed : un groupe unique Ardenne Heavy avec ses produits par défaut
DO $$
DECLARE
  _band_id UUID;
BEGIN
  SELECT id INTO _band_id FROM public.bands WHERE name = 'Ardenne Heavy' LIMIT 1;
  IF _band_id IS NULL THEN
    INSERT INTO public.bands (id, name, join_code, created_by)
    VALUES (gen_random_uuid(), 'Ardenne Heavy', 'ARDENNE', '00000000-0000-0000-0000-000000000000')
    RETURNING id INTO _band_id;

    INSERT INTO public.products (band_id, name, variant, price_cents, sort_order) VALUES
      (_band_id, 'T-shirt Homme', 'S', 2000, 10),
      (_band_id, 'T-shirt Homme', 'M', 2000, 11),
      (_band_id, 'T-shirt Homme', 'L', 2000, 12),
      (_band_id, 'T-shirt Homme', 'XL', 2000, 13),
      (_band_id, 'T-shirt Femme', 'S', 2000, 20),
      (_band_id, 'T-shirt Femme', 'M', 2000, 21),
      (_band_id, 'T-shirt Femme', 'L', 2000, 22),
      (_band_id, 'Décapsuleur', NULL, 500, 30),
      (_band_id, 'Album', NULL, 1500, 40);
  END IF;
END $$;

-- 2) Rendre sold_by nullable (plus d'utilisateurs)
ALTER TABLE public.sales ALTER COLUMN sold_by DROP NOT NULL;

-- 3) Drop des anciennes policies basées sur l'authentification
DROP POLICY IF EXISTS "Members can view their bands" ON public.bands;
DROP POLICY IF EXISTS "Anyone authenticated can create a band" ON public.bands;
DROP POLICY IF EXISTS "Members can update their band" ON public.bands;

DROP POLICY IF EXISTS "Members can view co-members" ON public.band_members;
DROP POLICY IF EXISTS "Users can join via own user_id" ON public.band_members;
DROP POLICY IF EXISTS "Users can leave a band" ON public.band_members;

DROP POLICY IF EXISTS "Members view products" ON public.products;
DROP POLICY IF EXISTS "Members insert products" ON public.products;
DROP POLICY IF EXISTS "Members update products" ON public.products;
DROP POLICY IF EXISTS "Members delete products" ON public.products;

DROP POLICY IF EXISTS "Members view concerts" ON public.concerts;
DROP POLICY IF EXISTS "Members insert concerts" ON public.concerts;
DROP POLICY IF EXISTS "Members update concerts" ON public.concerts;
DROP POLICY IF EXISTS "Members delete concerts" ON public.concerts;

DROP POLICY IF EXISTS "Members view sales" ON public.sales;
DROP POLICY IF EXISTS "Members insert sales" ON public.sales;
DROP POLICY IF EXISTS "Members update sales" ON public.sales;
DROP POLICY IF EXISTS "Members delete sales" ON public.sales;

DROP POLICY IF EXISTS "Members view inventory" ON public.inventory;
DROP POLICY IF EXISTS "Members insert inventory" ON public.inventory;
DROP POLICY IF EXISTS "Members update inventory" ON public.inventory;
DROP POLICY IF EXISTS "Members delete inventory" ON public.inventory;

-- 4) Nouvelles policies : accès libre (lecture + écriture) pour anon et authenticated
-- L'app est privée à votre groupe par convention (URL non partagée publiquement).
CREATE POLICY "Open access" ON public.bands FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access" ON public.products FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access" ON public.concerts FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access" ON public.sales FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access" ON public.inventory FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
