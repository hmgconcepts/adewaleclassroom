/* ============================================================================
   seo.js — Tutoring Connect V8 · search-engine visibility for every studio
   ----------------------------------------------------------------------------
   Goal (requirement 11): every site the generator produces must be findable on
   Google, Bing and other engines, must point searchers at the CLIENT studio,
   and must reinforce the HMG Concepts ecosystem.

   What this does on each page load:
     1. Injects a correct <title> and meta description if the page lacks one.
     2. Adds canonical, robots and language hints — with noindex on private
        pages so a parent's dashboard never lands in a search result.
     3. Adds Open Graph + Twitter cards so a WhatsApp/Facebook share of the
        studio link renders a proper preview card (a real acquisition channel
        for Nigerian tutoring studios).
     4. Emits schema.org JSON-LD: EducationalOrganization + WebSite +
        BreadcrumbList, with sameAs links to the studio's socials and
        parentOrganization pointing at HMG Concepts.

   Indexing policy is deliberate: public marketing pages are indexable; every
   authenticated page is noindex,nofollow. Being findable must never mean
   leaking a family's data into a search index.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var PUBLIC_INDEXABLE = [
    'index', '', 'about', 'contact', 'apply', 'feature-guide', 'install',
    'hmg-ecosystem', 'hmg-products', 'developer', 'flyer', 'exam-register',
    'public-book', 'login', 'site-index',
    /* V25/V27/V29 acquisition surfaces — must be indexable */
    'blog', 'blog-post', 'class-register', 'free-register'
  ];

  var SEO = {
    p: function () { return w.PRACTICE || {}; },
    page: function () {
      return (location.pathname.split('/').pop() || 'index.html')
        .replace(/\.html?$/i, '').split('?')[0].toLowerCase();
    },
    origin: function () {
      var s = this.p().siteUrl;
      if (s) return String(s).replace(/\/+$/, '');
      return location.origin;
    },
    url: function () {
      return this.origin() + '/' + (location.pathname.split('/').pop() || '');
    },
    guide: function () {
      var g = (w.TC && w.TC.PAGE_GUIDE) || {};
      return g[this.page()] || null;
    },
    indexable: function () { return PUBLIC_INDEXABLE.indexOf(this.page()) !== -1; },

    esc: function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    },
    meta: function (attr, key, content) {
      if (!content) return;
      var el = d.head.querySelector('meta[' + attr + '="' + key + '"]');
      if (!el) { el = d.createElement('meta'); el.setAttribute(attr, key); d.head.appendChild(el); }
      el.setAttribute('content', content);
    },
    link: function (rel, href) {
      if (!href) return;
      var el = d.head.querySelector('link[rel="' + rel + '"]');
      if (!el) { el = d.createElement('link'); el.setAttribute('rel', rel); d.head.appendChild(el); }
      el.setAttribute('href', href);
    },

    description: function () {
      var g = this.guide(), p = this.p();
      if (g && g.purpose) return String(g.purpose).replace(/<[^>]+>/g, '').slice(0, 300);
      return (p.motto || 'Independent 1:1 and group tutoring with progress a parent can see.');
    },

    apply: function () {
      var p = this.p(), g = this.guide();
      var name = p.name || 'HMG Tutoring Studio';
      var pageTitle = g ? g.title : d.title;

      // ---- title ----
      if (!d.title || /^\s*$/.test(d.title)) d.title = name;
      else if (g && d.title.indexOf(name) === -1) d.title = pageTitle + ' — ' + name;

      var desc = this.description();
      var img = p.logoUrl ? (/^https?:/.test(p.logoUrl) ? p.logoUrl : this.origin() + '/' + p.logoUrl.replace(/^\.?\//, '')) : '';

      // ---- core meta ----
      this.meta('name', 'description', desc);
      this.meta('name', 'author', name);
      this.meta('name', 'generator', 'Tutoring Connect by HMG Technologies');
      this.meta('name', 'application-name', name);
      this.meta('name', 'apple-mobile-web-app-title', p.shortName || name);
      this.meta('name', 'apple-mobile-web-app-capable', 'yes');
      this.meta('name', 'format-detection', 'telephone=no');
      d.documentElement.setAttribute('lang', p.lang || 'en');

      // ---- indexing policy ----
      if (this.indexable()) {
        this.meta('name', 'robots', 'index,follow,max-image-preview:large,max-snippet:-1');
        this.meta('name', 'googlebot', 'index,follow');
        this.meta('name', 'bingbot', 'index,follow');
        this.link('canonical', this.url());
      } else {
        // Private page: never index, never follow, never cache a snippet.
        this.meta('name', 'robots', 'noindex,nofollow,noarchive,nosnippet');
        this.meta('name', 'googlebot', 'noindex,nofollow');
      }

      // ---- Open Graph / Twitter (link previews on WhatsApp, FB, X) ----
      this.meta('property', 'og:site_name', name);
      this.meta('property', 'og:title', d.title);
      this.meta('property', 'og:description', desc);
      this.meta('property', 'og:type', this.page() === 'index' ? 'website' : 'article');
      this.meta('property', 'og:url', this.url());
      this.meta('property', 'og:locale', 'en_NG');
      if (img) this.meta('property', 'og:image', img);
      this.meta('name', 'twitter:card', img ? 'summary_large_image' : 'summary');
      this.meta('name', 'twitter:title', d.title);
      this.meta('name', 'twitter:description', desc);
      if (img) this.meta('name', 'twitter:image', img);

      if (this.indexable()) this.jsonLd();
    },

    /* Structured data: helps Google show the studio as an organisation with
       contact details, and links the client site into the HMG ecosystem. */
    jsonLd: function () {
      if (d.getElementById('tc-jsonld')) return;
      var p = this.p(), origin = this.origin();
      var name = p.name || 'HMG Tutoring Studio';
      var socials = [];
      if (p.socials) {
        ['facebook', 'instagram', 'x', 'twitter', 'linkedin', 'youtube', 'tiktok', 'whatsapp']
          .forEach(function (k) { if (p.socials[k]) socials.push(p.socials[k]); });
      }
      var hmg = p.hmg || {};
      var graph = [
        {
          '@type': 'EducationalOrganization',
          '@id': origin + '/#org',
          name: name,
          alternateName: p.shortName || undefined,
          url: origin + '/',
          logo: p.logoUrl ? (origin + '/' + String(p.logoUrl).replace(/^\.?\//, '')) : undefined,
          description: p.motto || undefined,
          email: p.email || undefined,
          telephone: p.phone || undefined,
          address: p.address ? { '@type': 'PostalAddress', addressLocality: p.address } : undefined,
          areaServed: ['NG', 'Worldwide'],
          sameAs: socials.length ? socials : undefined,
          parentOrganization: {
            '@type': 'Organization',
            name: 'HMG Concepts',
            url: hmg.concepts || 'https://hmgconcepts.pages.dev/'
          }
        },
        {
          '@type': 'WebSite',
          '@id': origin + '/#website',
          url: origin + '/',
          name: name,
          publisher: { '@id': origin + '/#org' },
          inLanguage: 'en',
          potentialAction: {
            '@type': 'SearchAction',
            target: origin + '/site-index.html?q={search_term_string}',
            'query-input': 'required name=search_term_string'
          }
        },
        {
          '@type': 'Service',
          name: 'Online tutoring — 1:1 and small group',
          provider: { '@id': origin + '/#org' },
          areaServed: 'Worldwide',
          serviceType: 'Tutoring',
          audience: { '@type': 'EducationalAudience', educationalRole: 'student' }
        }
      ];
      var g = this.guide();
      if (g && this.page() !== 'index') {
        graph.push({
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: origin + '/' },
            { '@type': 'ListItem', position: 2, name: g.title, item: this.url() }
          ]
        });
      }
      var s = d.createElement('script');
      s.type = 'application/ld+json';
      s.id = 'tc-jsonld';
      s.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph },
        function (k, v) { return v === undefined ? undefined : v; });
      d.head.appendChild(s);
    },

    init: function () { try { this.apply(); } catch (e) { console.warn('[SEO]', e); } }
  };

  w.SEO = SEO;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { SEO.init(); });
  else SEO.init();
})(window, document);
