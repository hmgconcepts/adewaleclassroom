# SEO guide — getting a generated studio found

Every studio produced by Tutoring Connect ships search-ready. This guide explains
what is automatic, what you must do once, and how to verify it worked.

---

## 1. What the platform does automatically

| Signal | Where it comes from | Notes |
|---|---|---|
| `<title>` per page | `assets/js/seo.js` + `page-guide.js` | Falls back to "Page — Studio Name" |
| Meta description | `page-guide.js` purpose text | Unique per page, never duplicated |
| Canonical URL | `seo.js` | Built from `PRACTICE.siteUrl` |
| `robots` meta | `seo.js` | `index,follow` on public pages; **`noindex,nofollow`** on every authenticated page |
| Open Graph + Twitter cards | `seo.js` | Makes WhatsApp/Facebook shares render a preview card |
| schema.org JSON-LD | `seo.js` | `EducationalOrganization`, `WebSite`, `Service`, `BreadcrumbList` |
| `sitemap.xml` | generator | Public pages only, with `lastmod` and priorities |
| `robots.txt` | generator | Explicit rules for Googlebot, Bingbot, DuckDuckBot, Slurp |
| HMG ecosystem links | `brand.js` footer + JSON-LD `parentOrganization` | Reciprocal linking |

### Indexing policy (deliberate)

Being findable must never mean leaking family data. The split is:

* **Indexed** — `index`, `about`, `contact`, `apply`, `feature-guide`, `install`,
  `exam-register`, `public-book`, `login`, `site-index`, `hmg-*`, `developer`, `flyer`.
* **`noindex,nofollow,noarchive,nosnippet`** — every dashboard, scoresheet, learner,
  parent, invoice, message, safeguarding and settings page.

`robots.txt` blocks them *and* each page emits a `noindex` meta tag, because
`robots.txt` alone does not prevent indexing of a URL someone links to.

---

## 2. The one thing you must do: set your real domain

Open `assets/js/config.js` and set `siteUrl`:

```js
siteUrl: 'https://yourstudio.vercel.app',   // no trailing slash
```

Canonical tags, Open Graph URLs, JSON-LD and the sitemap all derive from it.
Leaving it blank makes the site fall back to `location.origin`, which works but
produces weaker canonical signals. **Redeploy after changing it.**

---

## 3. Submit to Google (10 minutes)

1. Open <https://search.google.com/search-console>.
2. **Add property → URL prefix** → paste your full site URL.
3. Choose **HTML tag** verification. Copy the `<meta name="google-site-verification" ...>`
   tag and paste it into the `<head>` of `index.html`. Redeploy, then click Verify.
4. Left menu → **Sitemaps** → enter `sitemap.xml` → **Submit**.
5. **URL Inspection** → paste your homepage → **Request indexing**.

Google typically shows the site within 2–7 days.

## 4. Submit to Bing / Microsoft (5 minutes)

1. Open <https://www.bing.com/webmasters>.
2. **Add site**. The fastest route is **Import from Google Search Console** — one click.
3. Otherwise verify with the meta tag, then submit `sitemap.xml`.

Bing also powers **DuckDuckGo**, **Yahoo** and **Ecosia**, so this one submission
covers several engines.

---

## 5. Rank for the studio's own name

Most tutoring enquiries search the business name or "maths tutor + city". To win those:

* Put the exact studio name in `PRACTICE.name` — it flows into every title and the JSON-LD.
* Write a real `motto` and a real `address` in `config.js`; both feed structured data.
* Fill in the social links. They become `sameAs` entries, which is how Google connects
  your Instagram/Facebook/WhatsApp presence to the site.
* Add the site link to your WhatsApp Business profile, Instagram bio and Facebook page.
* Create a free **Google Business Profile** if you have a physical or service area, and
  point it at the site.
* Ask your first three families for a review.

---

## 6. The HMG ecosystem effect

Every generated studio footer links to HMG Concepts, HMG Technologies, HMG Academy,
HMG Media, HMG Gospel and the founder site, and the JSON-LD names HMG Concepts as the
`parentOrganization`. The ecosystem sites link back. This reciprocal graph helps both
the individual studio and the network — it is why the footer links should not be removed.

---

## 7. Verify it worked

| Check | Where |
|---|---|
| Structured data valid | <https://search.google.com/test/rich-results> |
| Preview card renders | Paste the link into a WhatsApp chat with yourself |
| Mobile friendly | <https://pagespeed.web.dev/> |
| Pages indexed | Search `site:yourstudio.vercel.app` after ~1 week |
| Private pages hidden | Confirm `site:yourstudio.vercel.app/dashboard.html` returns nothing |

If a private page ever appears in results, use Search Console →
**Removals** for the emergency takedown, then confirm `seo.js` is loading on that page.

---

## 8. Troubleshooting

**"Discovered – currently not indexed"** — normal for a new small site. Request
indexing manually for your 3–4 most important pages and be patient.

**Wrong title in results** — Google sometimes rewrites titles. Make sure the studio
name appears early in `PRACTICE.name`.

**No preview card on WhatsApp** — `logoUrl` must be an absolute, publicly reachable
URL once deployed. Check it loads in a private browser window.

**Sitemap says "Couldn't fetch"** — you almost certainly still have a placeholder in
`siteUrl`. Fix it, redeploy, resubmit.
