// EksporIn | Supabase client bootstrap
// Publishable key is safe to expose in client-side code.
(function () {
  const SUPABASE_URL = 'https://dbdzmhrofgcmkdszjxxq.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_--qPH56dWsGCxUzm7Mc_Aw_2P53hp3r';
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_KEY = SUPABASE_KEY;
  if (window.supabase && window.supabase.createClient) {
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'eksporin_sb_auth',
        detectSessionInUrl: false,
      },
    });
  } else {
    console.warn('[eksporin] Supabase SDK not loaded — auth will use local fallback only.');
    window.sb = null;
  }
})();
