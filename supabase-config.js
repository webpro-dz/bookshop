// Supabase connection (the anon key is public by design; security is enforced by RLS policies)
(function(){
  const SUPABASE_URL = "https://tbmwwmrpchmtokhkrbuq.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibXd3bXJwY2htdG9raGtyYnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzE1MDksImV4cCI6MjEwNjgwNzUwOX0.AjBY9W5GDC6cDkmQVx7Q80Janwy8A3AF9U2KS0UyX6I";

  window.dkaDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  window.dkaConfig = { url: SUPABASE_URL, key: SUPABASE_ANON_KEY };
  window.dkaUrl = SUPABASE_URL;
  window.dkaKey = SUPABASE_ANON_KEY;

  // Loads ALL books (paged, because the API returns max 1000 rows per request) + settings
  async function fetchAllBooks(){
    const PAGE = 1000;
    // keep the original order: oldest first, then by id. Falls back to id only if created_at does not exist.
    let orderCols = ['created_at', 'id'];
    let all = [];
    for (let from = 0; ; from += PAGE) {
      let q = window.dkaDb.from('books').select('*');
      orderCols.forEach(col => { q = q.order(col, { ascending: true }); });
      let res = await q.range(from, from + PAGE - 1);
      if (res.error && orderCols.length > 1 && from === 0) {
        orderCols = ['id'];
        let q2 = window.dkaDb.from('books').select('*').order('id', { ascending: true });
        res = await q2.range(from, from + PAGE - 1);
      }
      if (res.error) throw res.error;
      all = all.concat(res.data || []);
      if (!res.data || res.data.length < PAGE) break;
    }
    return all;
  }

  // Builds the image column(s) to write for a list of image URLs/paths
  window.dkaImageFields = function(arr){
    const c = window.dkaCols || { images: true, image_url: false };
    const o = {};
    if (c.images) o.images = arr;
    if (c.image_url) o.image_url = arr.join(', ');
    if (!c.images && !c.image_url) o.images = arr;
    return o;
  };

  // returns { data: [{name, books:[...]}], settings: {discountPercent} }
  window.dkaFetchCatalogue = async function(){
    const [rows, setRes] = await Promise.all([
      fetchAllBooks(),
      window.dkaDb.from('settings').select('discount_percent').eq('id', 1).maybeSingle()
    ]);
    // Detect which columns the table has. With rows we look at the first row; with an EMPTY table we ask the
    // database directly (selecting a column that does not exist returns an error even when there are no rows).
    if (rows.length) {
      window.dkaCols = { images: 'images' in rows[0], image_url: 'image_url' in rows[0], discount: 'discount' in rows[0] };
    } else {
      const has = async col => { const r = await window.dkaDb.from('books').select(col).limit(1); return !r.error; };
      const [im, iu, di] = await Promise.all([has('images'), has('image_url'), has('discount')]);
      window.dkaCols = { images: im, image_url: iu, discount: di };
    }
    const imgsFrom = r => {
      if (Array.isArray(r.images) && r.images.length) return r.images.filter(Boolean);
      if (typeof r.image_url === 'string' && r.image_url.trim()) return r.image_url.split(',').map(s => s.trim()).filter(Boolean);
      return [];
    };
    const cats = [], byName = {};
    rows.forEach(r => {
      const catName = (r.category && String(r.category).trim()) || 'غير مصنف';
      if (!byName[catName]) { byName[catName] = { name: catName, books: [] }; cats.push(byName[catName]); }
      byName[catName].books.push({
        id: String(r.id), isbn: r.isbn || '', author: r.author || '', title: r.title || '', year: r.year == null ? '' : String(r.year),
        price: r.price === null || r.price === undefined ? null : Number(r.price),
        discount: Number(r.discount) || 0,
        images: imgsFrom(r), description: r.description || ''
      });
    });
    const settings = { discountPercent: setRes && setRes.data ? Number(setRes.data.discount_percent) || 0 : 0 };
    return { data: cats, settings };
  };
})();
