// EksporIn | Supabase client bootstrap
// Publishable key is safe to expose in client-side code.
(function () {
  const SUPABASE_URL = 'https://dbdzmhrofgcmkdszjxxq.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_--qPH56dWsGCxUzm7Mc_Aw_2P53hp3r';
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_KEY = SUPABASE_KEY;

  if (!(window.supabase && window.supabase.createClient)) {
    console.warn('[eksporin] Supabase SDK not loaded — auth will use local fallback only.');
    window.sb = null;
    return;
  }

  // Email-confirmation callbacks come back as https://site/#access_token=…&type=signup.
  // This conflicts with our SPA hash router. If we see auth tokens in the hash,
  // hoist them off `location.hash` so both Supabase (via URL detection) and our
  // router can proceed cleanly. Supabase reads from the URL string, so we
  // move the hash to a query fragment it can still parse via getSessionFromUrl.
  const rawHash = window.location.hash || '';
  const isSupabaseCallback = /^#(?:.*&)?(access_token|refresh_token|error|error_description|type=recovery|type=signup)=/i.test(rawHash);

  window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'eksporin_sb_auth',
      // Let Supabase automatically pick up tokens from the URL after email
      // confirmation, magic-link, or OAuth redirects.
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
  });

  // After Supabase processes the callback hash, our router would still see it.
  // Wipe the hash back to landing so the app boots at /.
  if (isSupabaseCallback) {
    window.sb.auth.getSessionFromUrl && window.sb.auth.getSessionFromUrl({ storeSession: true }).catch(() => {});
    // Fallback: also let onAuthStateChange settle, then clear.
    setTimeout(() => {
      if (/access_token|refresh_token|type=/i.test(window.location.hash)) {
        history.replaceState(null, '', window.location.pathname);
      }
    }, 300);
  }
})();
