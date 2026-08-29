// Service worker mínimo, só para satisfazer o critério de instalabilidade do
// Chrome (exige um SW registrado com um listener de "fetch", mesmo vazio).
//
// De propósito, NÃO fazemos cache de nada: o app depende de dados em tempo
// real via Supabase Realtime, e um cache agressivo de rede serviria respostas
// stale. Se no futuro quisermos offline-first, isso precisa ser desenhado com
// cuidado (cache só de bundle JS/CSS estático, nunca de respostas da
// API/Supabase) — fora do escopo desta fase.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intencionalmente no-op — sem event.respondWith(), o browser cai no
  // comportamento de rede padrão. Isso já satisfaz o critério de
  // instalabilidade do Chrome.
});
