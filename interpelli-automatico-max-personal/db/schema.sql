-- Schema Postgres (MAX personal) con categorie multiple e anagrafiche complete
CREATE TABLE IF NOT EXISTS interpello (
  id BIGSERIAL PRIMARY KEY,
  source_name TEXT,
  source_url TEXT,
  url TEXT UNIQUE,
  title TEXT NOT NULL,
  abstract TEXT,
  regione TEXT,
  provincia TEXT,
  comune TEXT,
  scuola TEXT,
  classe TEXT,
  categorie TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_open BOOLEAN DEFAULT TRUE,
  closed_reason TEXT,
  closed_at TIMESTAMPTZ,
  scadenza DATE,
  pubblicato_il TIMESTAMPTZ DEFAULT now(),
  allegati JSONB DEFAULT '[]'
);
CREATE INDEX IF NOT EXISTS idx_interpello_fts ON interpello USING GIN (to_tsvector('italian', coalesce(title,'')||' '||coalesce(abstract,'')));
CREATE INDEX IF NOT EXISTS idx_interpello_scadenza ON interpello (scadenza);
CREATE INDEX IF NOT EXISTS idx_interpello_open ON interpello (is_open);
CREATE INDEX IF NOT EXISTS idx_interpello_categorie ON interpello USING GIN (categorie);
CREATE INDEX IF NOT EXISTS idx_interpello_geo ON interpello (regione, provincia, comune);
