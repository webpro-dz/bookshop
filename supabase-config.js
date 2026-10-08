// Supabase connection (the anon key is public by design; security is enforced by RLS policies)
(function(){
  const SUPABASE_URL = "https://tbmwwmrpchmtokhkrbuq.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibXd3bXJwY2htdG9raGtyYnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzE1MDksImV4cCI6MjEwNjgwNzUwOX0.AjBY9W5GDC6cDkmQVx7Q80Janwy8A3AF9U2KS0UyX6I";

  window.dkaDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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

  // returns { data: [{name, books:[...]}], settings: {discountPercent} }
  window.dkaFetchCatalogue = async function(){
    const [rows, setRes] = await Promise.all([
      fetchAllBooks(),
      window.dkaDb.from('settings').select('discount_percent').eq('id', 1).maybeSingle()
    ]);
    const cats = [], byName = {};
    rows.forEach(r => {
      if (!byName[r.category]) { byName[r.category] = { name: r.category, books: [] }; cats.push(byName[r.category]); }
      byName[r.category].books.push({
        id: String(r.id), isbn: r.isbn || '', author: r.author || '', title: r.title, year: r.year || '',
        price: r.price === null || r.price === undefined ? null : Number(r.price),
        discount: Number(r.discount) || 0,
        images: Array.isArray(r.images) ? r.images : [], description: r.description || ''
      });
    });
    const settings = { discountPercent: setRes && setRes.data ? Number(setRes.data.discount_percent) || 0 : 0 };
    return { data: cats, settings };
  };
})();
