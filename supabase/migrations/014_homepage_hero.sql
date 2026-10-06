-- Homepage hero banner image (singleton in site_settings)

INSERT INTO site_settings (key, value)
VALUES (
  'homepage_hero',
  '{"image_url": null}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
