-- Single-row site settings: homepage product card background images (editable via admin API).
CREATE TABLE IF NOT EXISTS public.site_settings (
  id text PRIMARY KEY DEFAULT 'default',
  homepage_product_card_join_image_url text,
  homepage_product_card_private_image_url text,
  homepage_product_card_bus_image_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.site_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_site_settings_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_settings_updated_at ON public.site_settings;
CREATE TRIGGER trg_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE PROCEDURE public.set_site_settings_updated_at();

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- No policies: only service_role (server API) accesses this table.

COMMENT ON TABLE public.site_settings IS 'Site-wide config; row id default is single-tenant homepage settings.';
