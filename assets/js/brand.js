/* HMG Concepts Ecosystem identity — injected on every page. */
const Brand = {
  ECO: {
    parent: 'HMG Concepts',
    parentUrl: 'https://hmgconcepts.pages.dev/',
    tech: 'HMG Technologies',
    techUrl: 'https://hmgtechnologies.pages.dev/',
    academy: 'HMG Academy',
    academyUrl: 'https://hmgacademy.pages.dev/',
    media: 'HMG Media',
    mediaUrl: 'https://hmgmedia.pages.dev/',
    gospel: 'HMG Gospel',
    gospelUrl: 'https://hmggospel.pages.dev/',
    founder: 'Adewale Samson Adeagbo',
    founderUrl: 'https://cssadewale.pages.dev/',
    wa: 'https://wa.me/2348100866322',
    product: 'Tutoring Connect',
    generatedName: 'ADEWALE CLASSROOM',
    motto: 'His Marvellous Grace — recurring fees should not keep tutors from a real studio.'
  },
  practice() { return window.PRACTICE || {}; },
  socials() {
    const s = this.practice().socials || {};
    return [
      ['Facebook', s.facebook], ['Instagram', s.instagram], ['X', s.x || s.twitter],
      ['LinkedIn', s.linkedin], ['YouTube', s.youtube], ['TikTok', s.tiktok],
      ['WhatsApp', s.whatsapp]
    ].filter(x => x[1]);
  },
  footerHTML() {
    const p = this.practice();
    const social = this.socials().map(([n,u]) => `<a href="${TC.esc(u)}" rel="noopener" target="_blank">${n}</a>`).join(' · ');
    return `<footer class="footer tc-hmg-footer">
      <div class="container">
        <p><strong data-practice-name>${TC.esc(p.name || this.ECO.generatedName)}</strong>
          ${p.motto ? ' — ' + TC.esc(p.motto) : ''}</p>
        ${social ? '<p>' + social + '</p>' : ''}
        <p>This tutoring studio is a product of
          <a href="${this.ECO.techUrl}" target="_blank" rel="noopener">HMG Technologies</a>,
          a subsidiary of
          <a href="${this.ECO.parentUrl}" target="_blank" rel="noopener">HMG Concepts</a>
          (<em>His Marvellous Grace</em>).</p>
        <p>
          <a href="${this.ECO.parentUrl}">HMG Concepts</a> ·
          <a href="${this.ECO.techUrl}">HMG Technologies</a> ·
          <a href="${this.ECO.academyUrl}">HMG Academy</a> ·
          <a href="${this.ECO.mediaUrl}">HMG Media</a> ·
          <a href="${this.ECO.gospelUrl}">HMG Gospel</a> ·
          <a href="${this.ECO.founderUrl}">${this.ECO.founder}</a> ·
          <a href="hmg-ecosystem.html">Ecosystem</a> ·
          <a href="developer.html">Developer</a>
        </p>
        <p class="muted">™ HMG Concepts Ecosystem · Built with Tutoring Connect · No paid AI API · Links not uploads</p>
      </div>
    </footer>`;
  },
  injectFooter() {
    if (document.querySelector('.tc-hmg-footer')) return;
    const host = document.querySelector('.app-content') || document.querySelector('main') || document.body;
    host.insertAdjacentHTML('beforeend', this.footerHTML());
  },
  jsonLd() {
    const p = this.practice();
    const url = p.siteUrl || (location.origin + location.pathname);
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'EducationalOrganization',
          name: p.name || this.ECO.generatedName,
          alternateName: p.shortName || '',
          url,
          description: p.motto || 'Independent 1:1 and group tutoring studio.',
          email: p.email || undefined,
          telephone: p.phone || undefined,
          address: p.address || undefined,
          sameAs: this.socials().map(x => x[1]),
          parentOrganization: { '@type': 'Organization', name: 'HMG Concepts', url: this.ECO.parentUrl }
        },
        {
          '@type': 'SoftwareApplication',
          name: 'Tutoring Connect / ADEWALE CLASSROOM',
          applicationCategory: 'EducationalApplication',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'NGN' },
          provider: { '@type': 'Organization', name: 'HMG Technologies', url: this.ECO.techUrl, parentOrganization: { name: 'HMG Concepts', url: this.ECO.parentUrl } }
        }
      ]
    };
  },
  injectSeo() {
    if (document.getElementById('tc-jsonld')) return;
    const s = document.createElement('script');
    s.id = 'tc-jsonld'; s.type = 'application/ld+json';
    s.textContent = JSON.stringify(this.jsonLd());
    document.head.appendChild(s);
    const p = this.practice();
    const set = (n, v, attr) => {
      if (!v) return;
      let el = document.querySelector(`meta[${attr}="${n}"]`);
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, n); document.head.appendChild(el); }
      el.setAttribute('content', v);
    };
    set('description', (p.name || 'ADEWALE CLASSROOM') + ' — ' + (p.motto || 'Independent tutoring by HMG Technologies / HMG Concepts.'), 'name');
    set('og:title', p.name || 'ADEWALE CLASSROOM', 'property');
    set('og:description', p.motto || 'A product of HMG Technologies, subsidiary of HMG Concepts.', 'property');
    set('og:type', 'website', 'property');
    if (p.siteUrl) set('og:url', p.siteUrl, 'property');
    const logo = p.logoUrl || 'assets/img/logo.png';
    set('og:image', logo, 'property');
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) { robots = document.createElement('meta'); robots.name = 'robots'; document.head.appendChild(robots); }
    robots.content = 'index, follow, max-image-preview:large';
  }
};
window.Brand = Brand;
document.addEventListener('DOMContentLoaded', () => { Brand.injectSeo(); Brand.injectFooter(); });
