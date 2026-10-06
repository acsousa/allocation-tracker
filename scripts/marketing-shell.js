const logo = `<span class="marketing-brand-art" aria-hidden="true"><img class="marketing-brand-lockup" src="assets/quartermaster-lockup.png" alt=""><img class="marketing-brand-mark" src="assets/quartermaster-mark.png" alt=""></span>`;

const navigation = [
  ['whole', '/#lp-whole', 'Whole portfolio'],
  ['tax', '/#lp-tax', 'Tax drag'],
  ['goals', '/#lp-goals', 'Goals'],
  ['decisions', '/#lp-decisions', 'Decisions'],
  ['privacy-section', '/#lp-privacy', 'Privacy'],
  ['pricing', '/pricing.html', 'Pricing'],
];

function marketingHeader(current = '') {
  const links = navigation.map(([id, href, label]) =>
    `<a class="marketing-link" href="${href}"${current === id ? ' aria-current="page"' : ''}>${label}</a>`
  ).join('');
  return `<header class="marketing-header">
    <a class="marketing-brand" href="/" aria-label="Quartermaster home">${logo}</a>
    <nav class="marketing-nav" aria-label="Main navigation">
      ${links}
      <a class="marketing-open" data-analytics-event="start_here_click" href="/#start">Start here <span aria-hidden="true">→</span></a>
    </nav>
  </header>`;
}

function marketingFooter(current = '') {
  return `<footer class="marketing-footer">
    <a class="marketing-footer-home" href="/">realallocation.com</a>
    <div class="marketing-disclaimer"><strong>Disclaimer</strong><p style="margin:4px 0 0;">All content and tools on this platform are for educational and informational purposes only. They do not constitute financial, investment, or tax advice. Please consult with a qualified, licensed professional before making any major financial decisions.</p></div>
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
