"use client";
import { useEffect, useState } from "react";
import { API, metaCategorie } from "../shared";

type Item = { id:number; title:string; abstract:string; url:string; regione:string; provincia:string; comune:string; scadenza?:string; pubblicato_il:string; categorie?:string[]; is_open?:boolean; scuola?:string; }
function formatDate(d?:string){ if(!d) return "—"; const dt = new Date(d); return dt.toLocaleDateString("it-IT"); }

export default function ChiusiPage(){
  const [query, setQuery] = useState("");
  const [regione, setRegione] = useState("");
  const [provincia, setProvincia] = useState("");
  const [comune, setComune] = useState("");
  const [selCats, setSelCats] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ metaCategorie().then((rows:any[])=> setCats(rows.map(r=>r.categoria))) },[]);

  const reload = ()=>{
    setLoading(true);
    const u = new URL(API + "/interpelli");
    if(query) u.searchParams.set("q", query);
    if(regione) u.searchParams.set("regione", regione);
    if(provincia) u.searchParams.set("provincia", provincia);
    if(comune) u.searchParams.set("comune", comune);
    if(selCats.length) u.searchParams.set("categorie", selCats.join(","));
    u.searchParams.set("only_closed","true");
    fetch(u.toString()).then(r=>r.json()).then(d=> setItems(d.items||[])).finally(()=> setLoading(false));
  };

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-2">Annunci chiusi</h1>
      <div className="bg-white rounded-2xl p-4 shadow-sm border mb-4 grid gap-3">
        <div className="grid gap-2 md:grid-cols-4">
          <input className="px-3 py-2 rounded-xl border" placeholder="Cerca parole..." value={query} onChange={e=>setQuery(e.target.value)} />
          <input className="px-3 py-2 rounded-xl border" placeholder="Regione" value={regione} onChange={e=>setRegione(e.target.value)} />
          <input className="px-3 py-2 rounded-xl border" placeholder="Provincia" value={provincia} onChange={e=>setProvincia(e.target.value)} />
          <input className="px-3 py-2 rounded-xl border" placeholder="Comune" value={comune} onChange={e=>setComune(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          {cats.slice(0,24).map(c=> (
            <label key={c} className="text-xs flex items-center gap-1 border rounded-lg px-2 py-1">
              <input type="checkbox" checked={selCats.includes(c)} onChange={()=>{
                setSelCats(prev=> prev.includes(c)? prev.filter(x=>x!==c) : [...prev, c])
              }}/>
              {c}
            </label>
          ))}
        </div>
        <div className="flex justify-end"><button className="px-4 py-2 rounded-xl border" onClick={reload}>{loading? "Carico..." : "Applica filtri"}</button></div>
      </div>

      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(it=> (
          <li key={it.id} className="bg-white rounded-2xl p-4 shadow-sm border">
            <div className="flex items-start justify-between gap-3">
              <a className="text-lg font-medium leading-tight underline" href={`/i/${it.id}`}>{it.title}</a>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 border">{formatDate(it.pubblicato_il)}</span>
            </div>
            <div className="mt-1 text-sm text-gray-600">{it.regione} · {it.provincia} · {it.comune}</div>
            <div className="mt-1 text-sm text-gray-600">{(it.categorie||[]).slice(0,6).join(" · ")}</div>
            <p className="mt-2 text-sm line-clamp-3">{it.abstract}</p>
            <div className="mt-3 flex items-center justify-between">
              <a href={it.url} className="text-sm underline" target="_blank" rel="noreferrer">Sito originale</a>
              <div className="text-xs">Scadenza: {formatDate(it.scadenza)}</div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  )
}
