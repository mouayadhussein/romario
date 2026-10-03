-- Homepage featured meals config (singleton key in site_settings)

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read site settings"
  ON site_settings FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin full access site settings"
  ON site_settings FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Default: show 4 featured meals; item_ids empty → app picks a stable random default
INSERT INTO site_settings (key, value)
VALUES (
  'homepage_featured',
  '{"display_count": 4, "item_ids": []}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
