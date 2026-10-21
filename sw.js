/* Ao mudar qualquer arquivo do app: suba o número em V, em APP_V (index.html) e nos ?v= dos scripts.
   tests/versao.test.js confere que os números batem. */
const V='marmofacil-v15';
const CORE=['./','index.html','calc.js?v=15','catalogo.js?v=15','model3d.js?v=15','viewer3d.js?v=15','vendor/three.module.min.js','manifest.webmanifest','icon-192.png','icon-512.png','vendor/jspdf.umd.min.js'];
const MEUS=/^(marmofacil|pedra-facil)-/;

/* Instala tudo de uma vez (sem usar o cache HTTP): uma versão nunca fica pela metade. */
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()))});
/* Só apaga caches antigos do Marmofácil: o endereço github.io é compartilhado com outros projetos. */
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>MEUS.test(x)&&x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});

self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  const fonte=u.host==='fonts.googleapis.com'||u.host==='fonts.gstatic.com';
  if(u.origin!==location.origin&&!fonte)return;
  e.respondWith(r.mode==='navigate'?pagina(r):arquivo(r));
});

/* Página: rede primeiro (pega a versão nova na hora), com cópia guardada se estiver sem sinal ou lento. */
async function pagina(r){
  const c=await caches.open(V);
  try{
    const rede=await Promise.race([fetch(r,{cache:'no-cache'}),new Promise((_,no)=>setTimeout(()=>no(new Error('lento')),3000))]);
    if(rede.ok){c.put('index.html',rede.clone());return rede}
    return (await c.match('index.html'))||rede;
  }catch(err){return (await c.match('index.html'))||Response.error()}
}
/* Demais arquivos: cópia guardada que combina EXATAMENTE com o endereço (inclui ?v=), senão rede. */
async function arquivo(r){
  const c=await caches.open(V);
  const hit=await c.match(r);
  if(hit)return hit;
  try{const rede=await fetch(r);if(rede.ok)c.put(r,rede.clone());return rede}
  catch(err){return Response.error()}
}
