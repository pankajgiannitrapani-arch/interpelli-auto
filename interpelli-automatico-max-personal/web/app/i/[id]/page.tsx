"use client";
import { useEffect, useState } from "react";
import { API } from "../shared";
function formatDate(d?:string){ if(!d) return "—"; const dt = new Date(d); return dt.toLocaleDateString("it-IT"); }
export default function Detail({ params }: any){
  const [it, setIt] = useState<any>(null);
  useEffect(()=>{ fetch(API + `/interpelli/${params.id}`).then(r=>r.json()).then(setIt); },[params.id]);
  if(!it) return <main className="max-w-3xl mx-auto px-4 py-6">Carico…</main>;
  if(it.error) return <main className="max-w-3xl mx-auto px-4 py-6">Non trovato.</main>;
  return (
    <main className="max-w-3xl mx-auto px-4 py-6">
      <a href="/" className="text-sm underline">← Torna</a>
      <h1 className="text-2xl font-semibold mt-2 mb-2">{it.title}</h1>
      <div className="text-sm text-gray-600">{(it.categorie||[]).join(" · ")}</div>
      <div className="text-sm text-gray-600 mt-1">{it.regione} · {it.provincia} · {it.comune}</div>
      <p className="mt-4">{it.abstract}</p>
      <div className="mt-4 text-sm">Scadenza: {formatDate(it.scadenza)}</div>
      <a href={it.url} className="mt-6 inline-block underline" target="_blank" rel="noreferrer">Apri sito originale</a>
    </main>
  )
}
