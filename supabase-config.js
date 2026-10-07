// Supabase connection (the anon key is public by design; security is enforced by RLS policies)
(function(){
  const SUPABASE_URL = "https://tbmwwmrpchmtokhkrbuq.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRibXd3bXJwY2htdG9raGtyYnVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzE1MDksImV4cCI6MjEwNjgwNzUwOX0.AjBY9W5GDC6cDkmQVx7Q80Janwy8A3AF9U2KS0UyX6I";

  window.dkaDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Loads all books + settings, returns { data: [{name, books:[...]}], settings: {discountPercent} }
  window.dkaFetchCatalogue = async function(){
    const [booksRes, setRes] = await Promise.all([
      window.dkaDb.from('books').select('*').order('id', { ascending: true }).range(0, 4999),
      window.dkaDb.from('settings').select('discount_percent').eq('id', 1).maybeSingle()
    ]);
    if (booksRes.error) throw booksRes.error;
    const cats = [], byName = {};
    booksRes.data.forEach(r => {
      if (!byName[r.category]) { byName[r.category] = { name: r.category, books: [] }; cats.push(byName[r.category]); }
      byName[r.category].books.push({
        id: r.id, isbn: r.isbn || '', author: r.author || '', title: r.title, year: r.year || '',
        price: r.price === null ? null : Number(r.price),
        discount: Number(r.discount) || 0,
        images: r.images || [], description: r.description || ''
      });
    });
    const settings = { discountPercent: setRes.data ? Number(setRes.data.discount_percent) || 0 : 0 };
    return { data: cats, settings };
  };
})();
