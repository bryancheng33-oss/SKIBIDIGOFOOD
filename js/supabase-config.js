(function () {
  var baseConfig = {
    url: 'https://ilnctlymtefmxhyetofy.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlsbmN0bHltdGVmbXhoeWV0b2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxMDU3OTgsImV4cCI6MjA5MDY4MTc5OH0.Vm2trkmD4lZuLn8_R-3I0vPijwlYpvmK0VqbcKytjOA',
    schema: 'public',
    pollMs: 8000,
    debug: false,
    tables: {
      users: 'sgf_users',
      orders: 'sgf_orders',
      messages: 'sgf_messages',
      reviews: 'sgf_reviews',
      appMeta: 'sgf_app_meta'
    },
    appMetaKeys: {
      brands: 'catalog_brands',
      foods: 'catalog_foods',
      settings: 'site_settings'
    }
  };

  var override = window.__SGF_SUPABASE_OVERRIDE__ || {};
  var merged = {
    url: override.url || baseConfig.url,
    anonKey: override.anonKey || baseConfig.anonKey,
    schema: override.schema || baseConfig.schema,
    pollMs: Number(override.pollMs || baseConfig.pollMs) || 8000,
    debug: !!(override.debug || baseConfig.debug),
    tables: Object.assign({}, baseConfig.tables, override.tables || {}),
    appMetaKeys: Object.assign({}, baseConfig.appMetaKeys, override.appMetaKeys || {})
  };

  window.SGF_SUPABASE_CONFIG = merged;
})();
