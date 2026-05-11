CREATE OR REPLACE FUNCTION public.join_band_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _band_id UUID;
  _uid UUID := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO _band_id FROM public.bands WHERE join_code = upper(_code);
  IF _band_id IS NULL THEN
    RAISE EXCEPTION 'Code introuvable';
  END IF;

  INSERT INTO public.band_members (band_id, user_id)
  VALUES (_band_id, _uid)
  ON CONFLICT (band_id, user_id) DO NOTHING;

  RETURN _band_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.join_band_by_code(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_band_by_code(TEXT) TO authenticated;