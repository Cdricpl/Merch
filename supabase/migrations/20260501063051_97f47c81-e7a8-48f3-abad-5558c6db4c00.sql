
-- Bands (groupes de musique)
CREATE TABLE public.bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Band members
CREATE TABLE public.band_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(band_id, user_id)
);

CREATE INDEX idx_band_members_user ON public.band_members(user_id);
CREATE INDEX idx_band_members_band ON public.band_members(band_id);

-- Products (articles de merch)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variant TEXT,
  price_cents INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_band ON public.products(band_id);

-- Concerts
CREATE TABLE public.concerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  concert_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_concerts_band ON public.concerts(band_id);

-- Sales (chaque vente = 1 ligne, simple à incrémenter/décrémenter)
CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concert_id UUID NOT NULL REFERENCES public.concerts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL DEFAULT 0,
  sold_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sales_concert ON public.sales(concert_id);
CREATE INDEX idx_sales_product ON public.sales(product_id);
CREATE INDEX idx_sales_band ON public.sales(band_id);

-- Inventory (stock initial par concert+produit)
CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concert_id UUID NOT NULL REFERENCES public.concerts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  band_id UUID NOT NULL REFERENCES public.bands(id) ON DELETE CASCADE,
  initial_stock INTEGER NOT NULL DEFAULT 0,
  manual_remaining INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(concert_id, product_id)
);

CREATE INDEX idx_inventory_concert ON public.inventory(concert_id);

-- Enable RLS
ALTER TABLE public.bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.band_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- Security definer function to check membership without recursion
CREATE OR REPLACE FUNCTION public.is_band_member(_user_id UUID, _band_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.band_members
    WHERE user_id = _user_id AND band_id = _band_id
  )
$$;

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
-- Users can see all members of bands they belong to
CREATE POLICY "Members can view co-members" ON public.band_members
  FOR SELECT TO authenticated
  USING (public.is_band_member(auth.uid(), band_id));

-- Users can insert themselves into a band (the join flow validates the code via server function)
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

-- Realtime support
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.concerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
