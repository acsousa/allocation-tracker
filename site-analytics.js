/* Hosted analytics: fixed labels only. Never pass portfolio data or DOM text. */
(() => {
  if (location.protocol !== 'https:' || !['realallocation.com', 'www.realallocation.com'].includes(location.hostname)) return;
  const id = 'G-MM26T8RTHV';
  const views = ['welcome', 'setup', 'dashboard', 'review', 'allocation', 'positions', 'checkin', 'history', 'goal', 'tax', 'retire', 'college', 'plan', 'report', 'accounts', 'household', 'taxprofile', 'retirement', 'data', 'pricing', 'privacy'];
  const events = new Set(['start_here_click', 'demo_start', 'setup_step_view', 'setup_complete', 'portfolio_open_click', 'portfolio_open_success', 'portfolio_save_click', 'portfolio_save_success', 'checkin_complete', 'report_download', 'report_print_click', 'paid_interest_click']);
  const allowed = { portfolio_mode: ['demo', 'personal', 'visitor'], step_name: ['accounts', 'goals', 'holdings'], save_method: ['file_write', 'download_initiated'], report_format: ['csv'], feature: ['cloud_saving', 'reminders', 'reports', 'general'] };
  let lastView = '', current = {};
  const send = (name, props) => { try { window.gtag('event', name, { ...current, ...props, send_to: id }); } catch (_) { /* Analytics never blocks the app. */ } };
  window.quartermasterAnalytics = {
    event(name, props = {}) {
      if (!events.has(name)) return;
      const safe = {};
      for (const [key, values] of Object.entries(allowed)) if (values.includes(props[key])) safe[key] = props[key];
      send(name, safe);
    },
    view(name, mode = 'visitor', step = 0) {
      if (!views.includes(name)) return;
      mode = allowed.portfolio_mode.includes(mode) ? mode : 'visitor';
      const stepName = name === 'setup' ? allowed.step_name[step - 1] : '';
      const key = [name, mode, stepName || ''].join(':');
      if (key === lastView) return;
      lastView = key;
      const path = name === 'welcome' ? '/' : ['pricing', 'privacy'].includes(name) ? '/' + name + '.html' : '/app/' + name + (stepName ? '/' + stepName : '');
      const previous = current.page_location;
      current = { page_location: location.origin + path, page_title: 'Quartermaster — ' + name, view_name: name, portfolio_mode: mode };
      if (previous) current.page_referrer = previous;
      // Keep automatically collected engagement events associated with this view too.
      try { window.gtag('set', current); } catch (_) {}
      send('page_view', {});
      if (stepName) this.event('setup_step_view', { step_name: stepName, portfolio_mode: mode });
    }
  };
  window.gtag('config', id, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  document.addEventListener('DOMContentLoaded', () => {
    const page = location.pathname.split('/').pop().replace(/\.html$/, '');
    if (['pricing', 'privacy'].includes(page)) window.quartermasterAnalytics.view(page);
  });
  document.addEventListener('click', e => {
    const link = e.target.closest && e.target.closest('a[data-analytics-event]');
    if (!link) return;
    window.quartermasterAnalytics.event(link.dataset.analyticsEvent, { feature: link.dataset.analyticsFeature });
  });
})();
