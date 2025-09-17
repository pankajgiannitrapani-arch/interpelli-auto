import os
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.getenv("DATABASE_URL", "")

app = FastAPI(title="API Interpelli – MAX Personal")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_conn():
    return psycopg.connect(DATABASE_URL, autocommit=True)

@app.get("/interpelli")
def list_interpelli(
    q: str = "",
    regione: Optional[str] = None,
    provincia: Optional[str] = None,
    comune: Optional[str] = None,
    categorie: Optional[str] = None,   # CSV
    open_only: bool = True,
    only_closed: bool = False,
    order: str = "recenti",
    limit: int = 50,
    offset: int = 0
):
    where = []
    params = {}
    if q.strip():
        where.append("(to_tsvector('italian', coalesce(title,'')||' '||coalesce(abstract,'')) @@ plainto_tsquery('italian', %(q)s))")
        params["q"] = q
    if regione:
        where.append("regione = %(regione)s")
        params["regione"] = regione
    if provincia:
        where.append("provincia = %(provincia)s")
        params["provincia"] = provincia
    if comune:
        where.append("comune = %(comune)s")
        params["comune"] = comune
    if categorie:
        cats = [c.strip() for c in categorie.split(",") if c.strip()]
        where.append("categorie && %(cats)s::text[]")
        params["cats"] = cats
    if only_closed:
        where.append("is_open = FALSE")
    elif open_only:
        where.append("is_open = TRUE")
    sql = "SELECT id,title,abstract,url,regione,provincia,comune,scadenza,pubblicato_il,categorie,is_open,scuola FROM interpello"
    if where:
        sql += " WHERE " + " AND ".join(where)
    if order == "scadenza":
        sql += " ORDER BY coalesce(scadenza, pubblicato_il) ASC NULLS LAST"
    else:
        sql += " ORDER BY pubblicato_il DESC"
    sql += " LIMIT %(limit)s OFFSET %(offset)s"
    params["limit"] = limit
    params["offset"] = offset
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        items = cur.fetchall()
        total_sql = "SELECT count(*) AS c FROM interpello"
        if where:
            total_sql += " WHERE " + " AND ".join(where)
        cur.execute(total_sql, params)
        total = cur.fetchone()["c"]
    return {"items": items, "total": total}

@app.get("/interpelli/{item_id}")
def get_interpello(item_id: int):
    with get_conn() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM interpello WHERE id=%s", (item_id,))
        row = cur.fetchone()
        if not row: return {"error":"not_found"}
        return row

@app.get("/meta/categorie")
def distinct_categories():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT unnest(categorie) AS cat, count(*) FROM interpello GROUP BY cat ORDER BY count(*) DESC")
        rows = cur.fetchall()
        return [{"categoria": r[0], "count": r[1]} for r in rows]

@app.get("/meta/regioni")
def regioni():
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute("SELECT regione, count(*) FROM interpello GROUP BY regione ORDER BY regione")
        return [{"regione": r[0], "count": r[1]} for r in cur.fetchall()]

@app.get("/meta/province")
def province(regione: Optional[str] = None):
    with get_conn() as conn, conn.cursor() as cur:
        if regione:
            cur.execute("SELECT provincia, count(*) FROM interpello WHERE regione=%s GROUP BY provincia ORDER BY provincia", (regione,))
        else:
            cur.execute("SELECT provincia, count(*) FROM interpello GROUP BY provincia ORDER BY provincia")
        return [{"provincia": r[0], "count": r[1]} for r in cur.fetchall()]

@app.get("/meta/comuni")
def comuni(regione: Optional[str] = None, provincia: Optional[str] = None):
    where = []; params = []
    if regione:
        where.append("regione=%s"); params.append(regione)
    if provincia:
        where.append("provincia=%s"); params.append(provincia)
    sql = "SELECT comune, count(*) FROM interpello"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " GROUP BY comune ORDER BY comune"
    with get_conn() as conn, conn.cursor() as cur:
        cur.execute(sql, params)
        return [{"comune": r[0], "count": r[1]} for r in cur.fetchall()]

@app.get("/healthz")
def healthz():
    return {"ok": True}
