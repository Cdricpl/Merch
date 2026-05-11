
-- Restore proper RLS policies (replaces the overly permissive "Open access" policies)

-- Drop open-access policies
DROP POLICY IF EXISTS "Open access" ON public.bands;
DROP POLICY IF EXISTS "Open access" ON public.products;
DROP POLICY IF EXISTS "Open access" ON public.concerts;
DROP POLICY IF EXISTS "Open access" ON public.sales;
DROP POLICY IF EXISTS "Open access" ON public.inventory;
DROP POLICY IF EXISTS "Open access" ON public.band_members;

-- RLS: bands
CREATE POLICY "Members can view their bands" ON public.bands
  FOR SELECT TO authenticated
  USING (public.is_band_member(auth.uid(), id));

CREATE POLICY "Anyone authenticated can create a band" ON public.bands
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Members can update their band" ON public.bands
  FOR UPDATE TO authenticated
  USING (public.is_band_member(auth.uid(), id));

-- RLS: band_members
CREATE POLICY "Members can view co-members" ON public.band_members
  FOR SELECT TO authenticated
  USING (public.is_band_member(auth.uid(), band_id));

CREATE POLICY "Users can join via own user_id" ON public.band_members
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave a band" ON public.band_members
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- RLS: products
CREATE POLICY "Members view products" ON public.products
  FOR SELECT TO authenticated USING (public.is_band_member(auth.uid(), band_id));
CREATE POLICY "Members insert products" ON public.products
  FOR INSERT TO authenticated WITH CHECK (public.is_band_member(auth.uid(), band_id));
CREATE POLICY "Members update products" ON public.products
  FOR UPDATE TO authenticated USING (public.is_band_member(auth.uid(), band_id));
CREATE POLICY "Members delete products" ON public.products
  FOR DELETE TO authenticated USING (public.is_band_member(auth.uid(), band_id));

-- RLS: concerts
CREATE POLICY "Members view concerts" ON public.concerts
  FOR SELECT TO authenticated USING (public.is_band_member(auth.uid(), band_id));
CREATE POLICY "Members insert concerts" ON public.concerts
  FOR INSERT TO authenticated WITH CHECK (public.is_band_member(auth.uid(), band_id));
CREATE POLICY "Members update concerts" ON public.concerts
  FOR UPDATE TO authenticated USING (public.is_band_member(auth.uid(), band_id));
CREATE POLICY "Members delete concerts" ON public.concerts
  FOR DELETE TO authenticated USING (public.is_band_member(auth.uid(), band_id));

-- RLS: sales
CREATE POLICY "Members view sales" ON public.sales
  FOR SELECT TO authenticated USING (public.is_band_member(auth.uid(), band_id));
CREATE POLICY "Members insert sales" ON public.sales
  FOR INSERT TO authenticated WITH CHECK (public.is_band_member(auth.uid(), band_id));
CREATE POLICY "Members update sales" ON public.sales
  FOR UPDATE TO authenticated USING (public.is_band_member(auth.uid(), band_id));
CREATE POLICY "Members delete sales" ON public.sales
  FOR DELETE TO authenticated USING (public.is_band_member(auth.uid(), band_id));

-- RLS: inventory
CREATE POLICY "Members view inventory" ON public.inventory
  FOR SELECT TO authenticated USING (public.is_band_member(auth.uid(), band_id));
CREATE POLICY "Members insert inventory" ON public.inventory
  FOR INSERT TO authenticated WITH CHECK (public.is_band_member(auth.uid(), band_id));
CREATE POLICY "Members update inventory" ON public.inventory
  FOR UPDATE TO authenticated USING (public.is_band_member(auth.uid(), band_id));
CREATE POLICY "Members delete inventory" ON public.inventory
  FOR DELETE TO authenticated USING (public.is_band_member(auth.uid(), band_id));

-- Add missing indexes for performance and RLS evaluation
CREATE INDEX IF NOT EXISTS idx_inventory_band ON public.inventory(band_id);
CREATE INDEX IF NOT EXISTS idx_sales_concert_product ON public.sales(concert_id, product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_concert_product ON public.inventory(concert_id, product_id);
