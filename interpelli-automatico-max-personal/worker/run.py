import os, time, re, hashlib, csv, io
import httpx, feedparser
from bs4 import BeautifulSoup
from dateparser import parse as parse_date
import psycopg
from datetime import datetime, timezone, date

DATABASE_URL = os.getenv("DATABASE_URL", "")
INTERVAL_SECONDS = int(os.getenv("INTERVAL_SECONDS", "900"))  # 15 min

CSV_LINK = "https://dati.istruzione.it/opendata/opendata/catalogo/elements1/leaf/SCUANAGRAFESTAT20252620250901.csv"

BASE_CATEGORIES = [
  ("interpello", r"\\binterpello\\b|chiamata|convocazione"),
  ("mad", r"messa a disposizione|\\bmad\\b"),
  ("supplenza", r"supplenz"),
  ("reclutamento", r"reclutamento|recluta"),
  ("bando", r"\\bbando\\b|\\bbandi\\b"),
  ("avviso", r"\\bavviso\\b|\\bavvisi\\b"),
  ("graduatoria", r"graduatori"),
  ("incarico", r"incaric"),
  ("concorso", r"\\bconcorso\\b|\\bconcorsi\\b"),
  ("esito", r"esito|esiti|finale"),
  ("docenti", r"docent|classe di concorso|c\\.?d\\.?c\\.?"),
  ("ata", r"\\bata\\b|assistente|collaboratore scolastico|\\baa\\b|\\bat\\b|\\bcs\\b"),
  ("assistente amministrativo", r"assistente amministrativ|\\baa\\b"),
  ("assistente tecnico", r"assistente tecnic|\\bat\\b"),
  ("collaboratore scolastico", r"collaboratore scolastic|\\bcs\\b"),
  ("educatore", r"educator|educativi"),
  ("dirigente", r"dirigente scolastic"),
]

CLOSE_WORDS = ["revoca","esito","chiuso","chiusura","non più disponibile","nomine effettuate","posti coperti","scadenz", "graduatoria definitiva"]

def get_conn():
    return psycopg.connect(DATABASE_URL, autocommit=True)

def upsert(conn, item):
    with conn.cursor() as cur:
        cur.execute("""
        INSERT INTO interpello (source_name, source_url, url, title, abstract, regione, provincia, comune, scuola, classe, categorie, is_open, scadenza, pubblicato_il, allegati)
        VALUES (%(source_name)s, %(source_url)s, %(url)s, %(title)s, %(abstract)s, %(regione)s, %(provincia)s, %(comune)s, %(scuola)s, %(classe)s, %(categorie)s, %(is_open)s, %(scadenza)s, %(pubblicato_il)s, %(allegati)s)
        ON CONFLICT (url) DO UPDATE SET
          title=EXCLUDED.title,
          abstract=EXCLUDED.abstract,
          categorie=EXCLUDED.categorie,
          scadenza=EXCLUDED.scadenza,
          pubblicato_il=EXCLUDED.pubblicato_il,
          is_open=EXCLUDED.is_open;
        """, item)

def extract_categories(text: str):
    t = text.lower()
    cats = set()
    for label, pattern in BASE_CATEGORIES:
        if re.search(pattern, t):
            cats.add(label)
    for m in re.findall(r"\\b(a-\\d{2}|b-\\d{2}|ad[s|m])\\b", t, flags=re.IGNORECASE):
        cats.add(f"cdc:{m.upper()}")
    if not cats:
        cats.add("varie")
    return sorted(cats)

def is_closed_from_text(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in CLOSE_WORDS)

def parse_feed_entry(entry, source):
    title = (entry.get("title") or "").strip()
    link = entry.get("link")
    summary = BeautifulSoup(entry.get("summary",""), "html.parser").get_text(" ").strip()
    published = entry.get("published") or entry.get("updated")
    dt = parse_date(published) if published else None
    cats = extract_categories((title + " " + summary))
    is_open = not is_closed_from_text(title + " " + summary)
    return {
        "source_name": source.get("name") or source.get("scuola") or source.get("base_url"),
        "source_url": source.get("base_url"),
        "url": link,
        "title": title[:500] or "Avviso",
        "abstract": summary[:3000],
        "regione": source.get("regione"),
        "provincia": source.get("provincia"),
        "comune": source.get("comune"),
        "scuola": source.get("name") or source.get("scuola"),
        "classe": None,
        "categorie": cats,
        "is_open": is_open,
        "scadenza": None,
        "pubblicato_il": dt,
        "allegati": "[]",
    }

def try_fetch_feed(client, base_url):
    for path in ["/feed", "/category/albo/feed", "/?feed=rss2", "/index.php/feed", "/rss"]:
        url = base_url.rstrip("/") + path
        try:
            r = client.get(url, timeout=15)
            if r.status_code==200 and ("xml" in r.headers.get("content-type","").lower() or "rss" in r.text[:200].lower()):
                return r.text
        except Exception:
            continue
    return None

def absolute(client, base, href):
    try:
        return client.build_request("GET", href).url.join(href).human_repr()
    except Exception:
        if href.startswith("/"):
            return base.rstrip("/") + href
        return href

def crawl_source(client, source):
    base_url = source["base_url"].rstrip("/")
    feed_xml = None
    if source.get("rss_url"):
        try:
            r = client.get(source["rss_url"], timeout=15)
            if r.status_code==200: feed_xml = r.text
        except Exception: pass
    if not feed_xml:
        feed_xml = try_fetch_feed(client, base_url)
    items = []
    if feed_xml:
        feed = feedparser.parse(feed_xml)
        for e in feed.entries[:30]:
            it = parse_feed_entry(e, source)
            if it: items.append(it)
        return items
    try:
        r = client.get(base_url, timeout=20)
        if r.status_code==200:
            soup = BeautifulSoup(r.text, "html.parser")
            for a in soup.find_all("a"):
                href = a.get("href")
                if not href: continue
                txt = (a.get_text(" ") or "") + " " + href
                cats = extract_categories(txt)
                if cats:
                    items.append({
                        "source_name": source["name"],
                        "source_url": base_url,
                        "url": absolute(client, base_url, href),
                        "title": a.get_text(" ").strip()[:500] or "Avviso",
                        "abstract": "",
                        "regione": source.get("regione"),
                        "provincia": source.get("provincia"),
                        "comune": source.get("comune"),
                        "scuola": source["name"],
                        "classe": None,
                        "categorie": cats,
                        "is_open": not is_closed_from_text(txt),
                        "scadenza": None,
                        "pubblicato_il": None,
                        "allegati": "[]",
                    })
    except Exception:
        pass
    return items[:25]

def load_usr_sources():
    csv_text = """name,base_url,regione,provincia,comune,rss_url
USR Emilia-Romagna,https://www.istruzioneer.gov.it,Emilia Romagna,BO,Bologna,
USR Lombardia,https://www.miur.gov.it/web/lombardia,Lombardia,MI,Milano,
USR Lazio,https://www.miur.gov.it/web/lazio,Lazio,RM,Roma,
USR Toscana,https://www.mim.gov.it/web/miur-usr-toscana,Toscana,FI,Firenze,
USR Calabria,https://www.istruzione.calabria.it,Calabria,RC,Reggio Calabria,
"""
    out = []
    reader = csv.DictReader(io.StringIO(csv_text))
    for row in reader: out.append(row)
    return out

def discover_ust_from_usr(client, usr_source):
    out = []
    try:
        r = client.get(usr_source["base_url"], timeout=20)
        if r.status_code==200:
            soup = BeautifulSoup(r.text, "html.parser")
            for a in soup.find_all("a"):
                href = a.get("href") or ""
                txt = a.get_text(" ").lower()
                if any(k in txt for k in ["ufficio scolastico territoriale","ust","atp"]) and href.startswith("http"):
                    out.append({"name": a.get_text(" ").strip() or "UST", "base_url": href, "regione": usr_source.get("regione"), "provincia": "", "comune": ""})
    except Exception:
        pass
    return out

def load_schools(client):
    out = []
    r = client.get(CSV_LINK, timeout=120)
    r.raise_for_status()
    text = r.text
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        url = (row.get("SitoWebScuola") or row.get("SitoWeb") or "").strip()
        if not url or not url.startswith("http"): 
            continue
        regione = row.get("Regione") or row.get("DescrizioneRegione") or ""
        provincia = row.get("Provincia") or row.get("DescrizioneProvincia") or ""
        comune = row.get("DescrizioneComune") or row.get("Comune") or ""
        scuola = row.get("DenominazioneIstitutoRiferimento") or row.get("DenominazioneScuola") or "Istituto Scolastico"
        out.append({"name": scuola, "base_url": url, "regione": regione, "provincia": provincia, "comune": comune})
    return out

def refresh_status(conn, client):
    with conn.cursor() as cur:
        cur.execute("SELECT id,url,scadenza,is_open FROM interpello WHERE is_open = TRUE")
        rows = cur.fetchall()
        for (id_, url, scadenza, is_open) in rows:
            closed = False; reason = None
            if scadenza and scadenza < date.today():
                closed = True; reason = "scadenza"
            else:
                try:
                    r = client.head(url, timeout=10)
                    if r.status_code == 404:
                        closed = True; reason = "404"
                except Exception:
                    pass
            if closed:
                cur.execute("UPDATE interpello SET is_open=FALSE, closed_reason=%s, closed_at=NOW() WHERE id=%s", (reason, id_))

def main():
    while True:
        print("Worker tick...")
        with httpx.Client(follow_redirects=True) as client:
            sources = load_usr_sources()
            for usr in list(sources):
                sources.extend(discover_ust_from_usr(client, usr))
            sources.extend(load_schools(client))  # FULL coverage
            print("Totale fonti:", len(sources))
            with get_conn() as conn:
                for s in sources:
                    try:
                        items = crawl_source(client, s)
                        for it in items: upsert(conn, it)
                    except Exception as e:
                        print("ERR source", s.get("name"), e)
                refresh_status(conn, client)
        time.sleep(INTERVAL_SECONDS)

if __name__ == "__main__":
    main()
