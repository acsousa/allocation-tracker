const logo = `<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true" class="marketing-logo"><g fill="none" stroke-width="5"><path d="M 24.17 8.64 A 11 11 0 0 1 24.17 23.36" stroke="#1b6f9b"/><path d="M 23.36 24.17 A 11 11 0 0 1 8.64 24.17" stroke="#1e8175"/><path d="M 7.83 23.36 A 11 11 0 0 1 7.83 8.64" stroke="#6c5aa8"/><path d="M 8.64 7.83 A 11 11 0 0 1 23.36 7.83" stroke="#c08a2e"/><path d="M 22.4 22.4 L 27.4 27.4" stroke="#151823" stroke-width="4.5"/></g></svg>`;

const navigation = [
  ['allocation', '/#lp-features', 'Asset allocation'],
  ['simulators', '/#lp-simulations', 'Simulators'],
  ['pricing', '/pricing.html', 'Pricing'],
];

function marketingHeader(current = '') {
  const links = navigation.map(([id, href, label]) =>
    `<a class="marketing-link" href="${href}"${current === id ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('');
  return `<header class="marketing-header">
    <a class="marketing-brand" href="/">${logo}<span>QUARTERMASTER</span></a>
    <nav class="marketing-nav" aria-label="Main navigation">
      ${links}
      <a class="marketing-open" data-analytics-event="start_here_click" href="/#start">Start here</a>
    </nav>
  </header>`;
}

function marketingFooter(current = '') {
  return `<footer class="marketing-footer">
    <a class="marketing-footer-home" href="/">realallocation.com</a>
    <span>Informational only—no trade instructions and not investment, tax, or legal advice.</span>
    <a href="/privacy.html"${current === 'privacy' ? ' aria-current="page"' : ''}>Privacy</a>
    <a href="mailto:hello@realallocation.com">hello@realallocation.com</a>
  </footer>`;
}

function applyMarketingShell(html, current = '') {
  let output = html
    .replace('<!-- MARKETING_HEADER -->', marketingHeader(current))
    .replace('<!-- MARKETING_FOOTER -->', marketingFooter(current));
  // Older source pages retain their self-contained content, while the deployed
  // build replaces only their shared chrome. This keeps one canonical header
  // and footer without requiring runtime JavaScript or network-loaded markup.
  output = output
    .replace(/<header class="marketing-header">[\s\S]*?<\/header>/, marketingHeader(current))
    .replace(/<footer>[\s\S]*?<\/footer>/, marketingFooter(current))
    .replaceAll('href="index.html#start"', 'href="/#start"')
    .replaceAll('href="index.html#', 'href="/#');
  if (!output.includes('href="assets/marketing.css"')) {
    output = output.replace('</head>', '<link rel="stylesheet" href="assets/marketing.css">\n</head>');
  }
  return output;
}

module.exports = { applyMarketingShell, marketingHeader, marketingFooter };
