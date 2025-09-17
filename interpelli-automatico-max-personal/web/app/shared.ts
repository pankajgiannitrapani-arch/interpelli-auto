export const API = process.env.NEXT_PUBLIC_API_URL || "";

export async function metaCategorie(){
  const r = await fetch(API + "/meta/categorie", { next: { revalidate: 30 }});
  return r.json();
}
export async function metaRegioni(){
  const r = await fetch(API + "/meta/regioni", { next: { revalidate: 300 }});
  return r.json();
}
export async function metaProvince(regione?:string){
  const u = new URL(API + "/meta/province");
  if(regione) u.searchParams.set("regione", regione);
  const r = await fetch(u.toString(), { next: { revalidate: 300 }});
  return r.json();
}
export async function metaComuni(regione?:string, provincia?:string){
  const u = new URL(API + "/meta/comuni");
  if(regione) u.searchParams.set("regione", regione);
  if(provincia) u.searchParams.set("provincia", provincia);
  const r = await fetch(u.toString(), { next: { revalidate: 300 }});
  return r.json();
}
