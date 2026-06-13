/** Executado antes dos módulos — remove apenas dados demo fictícios. */
(function () {
  window.__AFS_BUILD__ = window.__AFS_BUILD__ || 'purge-fict-v10';

  ['afs_prospect_enrichment', 'afs_prospect_segmentacoes', 'afs_prospect_catalog'].forEach(function (k) {
    try { localStorage.removeItem(k); } catch (_) {}
  });

  try {
    var raw = localStorage.getItem('afs_market_v2');
    if (!raw) return;
    var db = JSON.parse(raw);
    if (!db.collections) return;
    var demoName = /restaurante sabor|seguros protege|agro norte|techflow|indústria modelo|industria modelo|supermercados central|construtora horizonte|logtrans|hospital vida|banco regional|hotel praia|energia sul|mineração vale|consultoria alpha|metalúrgica forte|distribuidora abc|farmácia popular|clínica saúde|usina agro|autopeças|holding patrimonial/i;
    function demoCnpj(c) {
      var n = parseInt(String(c || '').replace(/\D/g, '').slice(0, 8), 10);
      return n >= 10000001 && n <= 10000200;
    }
    ['leads', 'companies'].forEach(function (col) {
      if (!Array.isArray(db.collections[col])) return;
      db.collections[col] = db.collections[col].filter(function (r) {
        return !demoCnpj(r.cnpj_basico || r.cnpj) && !demoName.test(String(r.razao_social || r.nome || ''));
      });
    });
    localStorage.setItem('afs_market_v2', JSON.stringify(db));
  } catch (_) {}
})();
