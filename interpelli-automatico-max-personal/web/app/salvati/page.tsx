"use client";
import { useEffect, useState } from "react";
import { API } from "../shared";
function formatDate(d?:string){ if(!d) return "—"; const dt = new Date(d); return dt.toLocaleDateString("it-IT"); }
export default function Salvati(){
  const [ids, setIds] = useState<string[]>([]);
  const [items, setItems] = useState<any[]>([]);
  useEffect(()=>{
    const raw = localStorage.getItem("preferiti"); const list = raw ? JSON.parse(raw) : [];
    setIds(list);
    Promise.all(list.map((id:string)=> fetch(API + `/interpelli/${id}`).then(r=>r.json()))).then(setItems);
  },[]);
  if(ids.length===0) return <main className="max-w-6xl mx-auto px-4 py-6">Non hai ancora salvato annunci.</main>;
  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-semibold mb-4">Salvati ⭐</h1>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((it:any)=>(
          <li key={it.id} className="bg-white rounded-2xl p-4 shadow-sm border">
            <div className="flex items-start justify-between gap-3">
              <a className="text-lg font-medium leading-tight underline" href={`/i/${it.id}`}>{it.title}</a>
              <span className="text-xs px-2 py-1 rounded-full bg-gray-100 border">{formatDate(it.pubblicato_il)}</span>
            </div>
            <div className="mt-1 text-sm text-gray-600">{(it.categorie||[]).slice(0,6).join(" · ")}</div>
            <div className="mt-1 text-sm text-gray-600">{it.regione} · {it.provincia} · {it.comune}</div>
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
