"use client";
import { useEffect, useState } from "react";
import { API, metaCategorie, metaRegioni, metaProvince, metaComuni } from "./shared";

type Item = { id:number; title:string; abstract:string; url:string; regione:string; provincia:string; comune:string; scadenza?:string; pubblicato_il:string; categorie?:string[]; is_open?:boolean; scuola?:string; }

function formatDate(d?:string){ if(!d) return "—"; const dt = new Date(d); return dt.toLocaleDateString("it-IT"); }

function usePrefs(){
  const [regione,setRegione] = useState<string>("");
  const [provincia,setProvincia] = useState<string>("");
  const [comune,setComune] = useState<string>("");
  useEffect(()=>{
    const p = JSON.parse(localStorage.getItem("prefs") || "{}");
    setRegione(p.regione||""); setProvincia(p.provincia||""); setComune(p.comune||"");
  },[]);
  useEffect(()=>{
    localStorage.setItem("prefs", JSON.stringify({ regione, provincia, comune }))
  },[regione, provincia, comune]);
  return { regione, setRegione, provincia, setProvincia, comune, setComune };
}

export default function AttiviPage(){
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [cats, setCats] = useState<string[]>([]);
  const [selCats, setSelCats] = useState<string[]>([]);
  const prefs = usePrefs();
  const [province, setProvince] = useState<string[]>([]);
  const [comuni, setComuni] = useState<string[]>([]);

  const loadCats = ()=> metaCategorie().then((rows:any[])=> setCats(rows.map(r=>r.categoria)));
  const loadProvince = ()=> metaProvince(prefs.regione).then((rows:any[])=> setProvince(rows.map(r=>r.provincia)));
  const loadComuni = ()=> metaComuni(prefs.regione, prefs.provincia).then((rows:any[])=> setComuni(rows.map(r=>r.comune)));

  const reload = ()=>{
    setLoading(true);
    const u = new URL(API + "/interpelli");
    if(query) u.searchParams.set("q", query);
    if(prefs.regione) u.searchParams.set("regione", prefs.regione);
    if(prefs.provincia) u.searchParams.set("provincia", prefs.provincia);
    if(prefs.comune) u.searchParams.set("comune", prefs.comune);
    if(selCats.length) u.searchParams.set("categorie", selCats.join(","));
    u.searchParams.set("open_only","true");
    fetch(u.toString()).then(r=>r.json()).then(d=>{ setItems(d.items||[]); setTotal(d.total||0); }).finally(()=> setLoading(false));
  };

  useEffect(()=>{ loadCats(); reload(); },[]);
  useEffect(()=>{ loadProvince(); },[prefs.regione]);
  useEffect(()=>{ loadComuni(); },[prefs.provincia]);

  return (
    <main className="max-w-7xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-2">Annunci attivi</h1>
      <div className="bg-white rounded-2xl p-4 shadow-sm border mb-4 grid gap-3">
        <div className="grid gap-2 md:grid-cols-4">
          <input className="px-3 py-2 rounded-xl border" placeholder="Cerca parole..." value={query} onChange={e=>setQuery(e.target.value)} />
          <select className="px-3 py-2 rounded-xl border" value={prefs.regione} onChange={e=>{ prefs.setRegione(e.target.value); prefs.setProvincia(""); prefs.setComune(""); }}>
            <option value="">Tutte le regioni</option>
            {/* regioni via server-side meta endpoint lazy: populate when user types? we use province list only; region list can be free text or dynamic but keep simple */}
            {/* For simplicity region list will fill when user types province; we keep free text? In this build, user types province? Simplify: keep region input text? */}
          </select>
          <input className="px-3 py-2 rounded-xl border" placeholder="Provincia (sigla o nome)" value={prefs.provincia} onChange={e=>prefs.setProvincia(e.target.value)} />
          <input className="px-3 py-2 rounded-xl border" placeholder="Comune" value={prefs.comune} onChange={e=>prefs.setComune(e.target.value)} />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
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
          <div className="text-xs text-gray-600">Selezionate: {selCats.join(", ")||"—"}</div>
          <div className="flex gap-2 justify-end">
            <button className="px-4 py-2 rounded-xl border" onClick={()=>{ setSelCats([]); }}>Azzera categorie</button>
            <button className="px-4 py-2 rounded-xl border" onClick={reload}>{loading? "Carico..." : "Applica filtri"}</button>
          </div>
        </div>
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
