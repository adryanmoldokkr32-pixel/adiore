-- ================================================================
-- ADIORE — Pontaj Ore de Muncă
-- Schema Supabase — rulează în Supabase Dashboard > SQL Editor
-- ================================================================

-- Workers / Muncitori
CREATE TABLE IF NOT EXISTS workers (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT DEFAULT 'salahor' CHECK (role IN ('salahor','coordonator')),
  pin        TEXT NOT NULL,
  avatar     TEXT DEFAULT '🔨',
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Santiere / Sites
CREATE TABLE IF NOT EXISTS sites (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  address    TEXT DEFAULT '',
  lat        NUMERIC,
  lng        NUMERIC,
  active     BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pontaj / Work Logs
CREATE TABLE IF NOT EXISTS work_logs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id      UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  log_date       DATE NOT NULL,
  hours          NUMERIC(4,1) NOT NULL CHECK (hours > 0 AND hours <= 24),
  work_type      TEXT DEFAULT 'Metal T24',
  location_note  TEXT DEFAULT '',
  site_id        UUID REFERENCES sites(id),
  check_in_at    TIMESTAMPTZ,
  check_out_at   TIMESTAMPTZ,
  check_in_lat   NUMERIC,
  check_in_lng   NUMERIC,
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(worker_id, log_date)
);

-- Vacante
CREATE TABLE IF NOT EXISTS vacations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id   UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      TEXT DEFAULT '',
  approved    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Echipe
CREATE TABLE IF NOT EXISTS teams (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  team_id   UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  PRIMARY KEY(team_id, worker_id)
);

-- RLS — Allow anon access (internal app)
ALTER TABLE workers      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites        ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_workers"      ON workers      FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_sites"        ON sites        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_work_logs"    ON work_logs    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_vacations"    ON vacations    FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_teams"        ON teams        FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon_team_members" ON team_members FOR ALL TO anon USING (true) WITH CHECK (true);

-- SEED DATA — Modifica PIN-urile dupa import!
INSERT INTO workers (name, role, pin, avatar) VALUES
  ('BIBIKA', 'salahor', '1234', '🔨'),
  ('COORDONATOR', 'coordonator', '0000', '🔑')
ON CONFLICT DO NOTHING;

INSERT INTO sites (name, address) VALUES
  ('Birou BCR', 'Bucuresti, etaj 2'),
  ('Santier Nord', 'Bucuresti Sector 1'),
  ('Mall Plaza', 'Bucuresti Sector 3'),
  ('Santier Sud', 'Bucuresti Sector 4')
ON CONFLICT DO NOTHING;
