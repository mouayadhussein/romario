-- Branch coordinates for map picker (keep map_url for legacy branches)
ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9, 6) NULL,
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9, 6) NULL;

ALTER TABLE branches
  DROP CONSTRAINT IF EXISTS branches_latitude_range;
ALTER TABLE branches
  ADD CONSTRAINT branches_latitude_range
  CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));

ALTER TABLE branches
  DROP CONSTRAINT IF EXISTS branches_longitude_range;
ALTER TABLE branches
  ADD CONSTRAINT branches_longitude_range
  CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));

ALTER TABLE branches
  DROP CONSTRAINT IF EXISTS branches_lat_lng_pair;
ALTER TABLE branches
  ADD CONSTRAINT branches_lat_lng_pair
  CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude IS NOT NULL AND longitude IS NOT NULL)
  );
