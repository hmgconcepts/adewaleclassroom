/* ============================================================================
   blog.js — the public blog engine (V27, report item 40)
   ----------------------------------------------------------------------------
   Three mounts, one module:
     #blog-root        blog.html       — public listing: search + category
     #blog-post-root   blog-post.html  — public reader (?slug=…)
     #blog-admin-root  blog-manage.html— staff editor: create, edit, publish,
                                         archive, delete, categories
   Data lives in tc_blog_posts / tc_blog_categories. Staff write through the
   table (RLS staff policy); the public reads through tc_blog_list /
   tc_blog_get (security definer, published rows only). Cover art and media
   are DRIVE / WEB LINKS only — nothing is uploaded, so the free-tier storage
   quota is untouched. No AI API: the body is plain text with light markdown
   (paragraphs, ## headings, - lists, **bold**, [text](url)).
   ========================================================================== */
(function (w, d) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(dt) {
    if (!dt) return '';
    try { return new Date(dt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch (_) { return String(dt).slice(0, 10); }
  }
  /* Light, safe markdown: escape first, then apply structural rules.
     V44 (Ghost/dev.to parity): fenced ``` code blocks get a copy button,
     > blockquotes render as real quotes (the CSS existed but nothing ever
     produced a blockquote), and every h2/h3 gets a stable id so the table
     of contents can link to it. */
  var __hIds = {};   /* heading-text -> occurrence count, for unique ids */
  function hId(text) {
    var base = 's-' + String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);
    __hIds[base] = (__hIds[base] || 0) + 1;
    return __hIds[base] > 1 ? base + '-' + __hIds[base] : base;
  }
  function md(t, collect) {
    __hIds = {};
    var s = esc(t || '');
    var paras = s.split(/\n{2,}/);
    return paras.map(function (p) {
      p = p.trim();
      if (!p) return '';
      if (/^`{3,}/.test(p)) {
        /* fenced code block: ``` lang? \n … \n ``` */
        var lines = p.split('\n');
        var lang = (lines[0].replace(/`/g, '').trim() || '').toLowerCase();
        var code = lines.slice(1, /`{3,}\s*$/.test(lines[lines.length - 1]) ? -1 : undefined).join('\n');
        return '<div class="blog-code" style="position:relative;margin:1.6em 0">' +
          '<button type="button" class="blog-code-copy" data-code="' + esc(code) + '" style="position:absolute;top:8px;right:8px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:8px;padding:4px 10px;font:600 .72rem var(--font);cursor:pointer">⧉ Copy</button>' +
          '<pre style="background:#0f172a;color:#e2e8f0;border-radius:14px;padding:18px;overflow:auto;font-size:.88rem;line-height:1.6"><code>' + code + '</code></pre>' +
          (lang && lang !== 'text' ? '<span style="position:absolute;bottom:8px;right:10px;color:#64748b;font:600 .68rem var(--font);text-transform:uppercase;letter-spacing:.08em">' + esc(lang) + '</span>' : '') +
        '</div>';
      }
      if (/^&gt;/.test(p)) {
        return '<blockquote>' + p.split('\n').map(function (l) {
          return l.replace(/^&gt;\s?/, '');
        }).join('<br>') + '</blockquote>';
      }
      if (/^#{1,3}\s/.test(p)) {
        var lvl = p.match(/^(#{1,3})\s/)[1].length;
        var text = p.replace(/^#{1,3}\s/, '');
        var id = hId(text);
        if (collect && lvl <= 2) collect.push({ id: id, text: text, lvl: lvl + 1 });
        return '<h' + (lvl + 1) + ' id="' + id + '" style="scroll-margin-top:24px">' + text + '</h' + (lvl + 1) + '>';
      }
      if (/^[-*]\s/.test(p)) {
        var items = p.split(/\n(?=[-*]\s)/).map(function (i) {
          return '<li>' + i.replace(/^[-*]\s/, '').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') + '</li>';
        }).join('');
        return '<ul>' + items + '</ul>';
      }
      p = p.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
           .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      return '<p>' + p + '</p>';
    }).join('');
  }

  /* ---------------- V44 enterprise helpers ---------------- */
  function readerId() {
    /* stable anonymous id for reaction dedup (localStorage, never sent anywhere else) */
    try {
      var v = w.localStorage.getItem('tc-blog-visitor');
      if (!v) { v = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); w.localStorage.setItem('tc-blog-visitor', v); }
      return v;
    } catch (e) { return 'anon'; }
  }
  function readMin(body) {
    var words = String(body || '').split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }
  function shareRow(url, title) {
    var u = encodeURIComponent(url), t = encodeURIComponent(title);
    var native = (navigator.share ? '<button type="button" class="btn btn-sm btn-primary" style="border-radius:99px;padding:8px 16px;font-weight:600" onclick="navigator.share({title:document.title,url:location.href}).catch(function(){})">📤 Share…</button>' : '');
    return '<div style="display:flex;gap:8px;align-items:center;margin:20px 0;flex-wrap:wrap">' + native +
      '<a href="https://wa.me/?text=' + t + '%20' + u + '" target="_blank" rel="noopener" class="btn btn-sm" style="border-radius:99px;padding:8px 16px;font-weight:600;background:#dcfce7;color:#166534;border:1px solid #86efac">💬 WhatsApp</a>' +
      '<a href="https://t.me/share/url?url=' + u + '&text=' + t + '" target="_blank" rel="noopener" class="btn btn-sm btn-outline" style="border-radius:99px;padding:8px 16px;font-weight:600">✈️ Telegram</a>' +
      '<a href="https://twitter.com/intent/tweet?url=' + u + '&text=' + t + '" target="_blank" rel="noopener" class="btn btn-sm btn-outline" style="border-radius:99px;padding:8px 16px;font-weight:600">𝕏 Post</a>' +
      '<a href="https://www.facebook.com/sharer/sharer.php?u=' + u + '" target="_blank" rel="noopener" class="btn btn-sm btn-outline" style="border-radius:99px;padding:8px 16px;font-weight:600">📘 Facebook</a>' +
      '<button type="button" class="btn btn-sm btn-outline" style="border-radius:99px;padding:8px 16px;font-weight:600" onclick="navigator.clipboard.writeText(location.href).then(function(){toast(\'Link copied!\',\'success\')})">🔗 Copy link</button>' +
    '</div>';
  }
  /* White-label: the author card brands itself from the page's
     [data-practice-name] (set per deployment), not a hardcoded string. */
  function practiceName() {
    try {
      var el = d.querySelector('[data-practice-name]');
      var n = el && el.textContent && el.textContent.trim();
      if (n) return n;
    } catch (e) {}
    return 'ADEWALE CLASSROOM';
  }
  function subscribeBox(compact) {
    return '<div id="blog-sub-box" style="max-width:720px;margin:44px auto;background:linear-gradient(135deg,#0506ae,#964eec);border-radius:24px;padding:' + (compact ? '22px' : '34px') + ';color:#fff;font-family:var(--font);box-shadow:0 14px 40px rgba(5,6,174,.25)">' +
      '<div style="font-size:1.35rem;font-weight:800;margin-bottom:6px">📬 Never miss a post</div>' +
      '<div style="opacity:.85;font-size:.95rem;margin-bottom:14px">Get new articles in your inbox — study tips, exam prep and class news. No spam, unsubscribe anytime.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<input id="blog-sub-email" type="email" placeholder="you@email.com" style="flex:1;min-width:220px;padding:12px 16px;border-radius:12px;border:0;font:inherit">' +
        '<button id="blog-sub-btn" type="button" style="padding:12px 22px;border-radius:12px;border:0;background:#fff;color:#0506ae;font:800 .95rem var(--font);cursor:pointer">Subscribe</button>' +
      '</div><div id="blog-sub-msg" style="font-size:.85rem;margin-top:8px;opacity:.9"></div></div>';
  }
  function wireSubscribe() {
    var btn = d.getElementById('blog-sub-btn');
    if (!btn) return;
    btn.onclick = async function () {
      var email = (d.getElementById('blog-sub-email').value || '').trim();
      var msg = d.getElementById('blog-sub-msg');
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) { msg.textContent = 'Please enter a valid email address.'; return; }
      btn.disabled = true; btn.textContent = '…';
      try {
        var res = w.sb
          ? await w.sb.rpc('tc_blog_subscribe', { p_email: email })
          : { data: { ok: true } };
        var data = res && res.data;
        if (res.error || !data || data.ok === false) throw new Error((data && data.reason) || (res.error && res.error.message) || 'failed');
        msg.textContent = '✅ Subscribed — welcome aboard!';
        d.getElementById('blog-sub-email').value = '';
      } catch (e) {
        msg.textContent = 'Could not subscribe right now (' + (e.message || 'network') + '). Please try again.';
      } finally { btn.disabled = false; btn.textContent = 'Subscribe'; }
    };
  }

  var Blog = {
    mountList() {
      var root = d.getElementById('blog-root');
      if (!root) return;
      var self = this;
      root.innerHTML =
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">' +
          '<input id="blog-q" type="search" placeholder="🔎 Search posts…" style="flex:1;min-width:200px;padding:10px 14px;border:1px solid var(--gray-300,#e2e8f0);border-radius:12px;font:inherit">' +
          '<select id="blog-cat" style="padding:10px 12px;border:1px solid var(--gray-300,#e2e8f0);border-radius:12px;font:inherit"><option value="">All topics</option></select>' +
        '</div>' +
        '<div id="blog-tags" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px"></div>' +
        '<div id="blog-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px"><p class="muted">Loading posts…</p></div>' +
        '<div style="text-align:center;margin:18px 0 40px"><button id="blog-more" class="btn btn-outline" type="button" style="display:none;border-radius:99px;padding:10px 26px;font-weight:700">⬇ Load more posts</button></div>';
      var q = d.getElementById('blog-q');
      var cat = d.getElementById('blog-cat');
      var state = { tag: (new URLSearchParams(location.search).get('tag') || '').trim(), page: 1 };
      var run = function () { self._loadList(q.value, cat.value, root, state); };
      q.addEventListener('input', run);
      cat.addEventListener('change', run);
      d.getElementById('blog-more').onclick = function () { state.page++; run(true); };
      this._loadCats(cat, run);
      run();
    },

    async _loadCats(sel, run) {
      try {
        if (w.sb) {
          var { data } = await w.sb.from('tc_blog_categories').select('name,slug').order('name');
          (data || []).forEach(function (c) {
            var o = d.createElement('option');
            o.value = c.slug; o.textContent = c.name;
            sel.appendChild(o);
          });
        }
      } catch (_) {}
    },

    async _loadList(query, category, root, state) {
      var box = d.getElementById('blog-list');
      if (!box) return;
      var self = this;
      var append = !!(state && state.page > 1);
      var PAGE = 9;
      try {
        var posts = [];
        if (w.sb) {
          var { data, error } = await w.sb.rpc('tc_blog_list', { p_category: category || null, p_q: query || null });
          if (error) throw error;
          posts = (data && Array.isArray(data)) ? data : [];
        } else {
          posts = w.DEMO && Array.isArray(w.DEMO.tc_blog_posts)
            ? w.DEMO.tc_blog_posts.filter(function (p) { return p.status === 'published'; })
            : [];
        }
        /* V44: tag deep-link (?tag=…) — clicking #waec on a post filters here */
        var tag = state && state.tag;
        if (tag) {
          var tl = tag.toLowerCase();
          posts = posts.filter(function (p) {
            return String(p.tags || '').split(',').some(function (t) { return t.trim().toLowerCase() === tl; });
          });
        }
        /* V44: build the tag-chip row from whatever is loaded (top 12 tags) */
        var tagBox = d.getElementById('blog-tags');
        if (tagBox) {
          var counts = {};
          posts.forEach(function (p) {
            String(p.tags || '').split(',').forEach(function (t) {
              t = t.trim(); if (t) counts[t] = (counts[t] || 0) + 1;
            });
          });
          var tags = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 12);
          tagBox.innerHTML = tags.map(function (t) {
            var on = tag && t.toLowerCase() === tag.toLowerCase();
            return '<a href="blog.html' + (on ? '' : '?tag=' + encodeURIComponent(t)) + '" class="badge" style="text-decoration:none;background:' + (on ? '#0506ae' : '#f1f5f9') + ';color:' + (on ? '#fff' : '#475569') + ';border:1px solid #e2e8f0;border-radius:99px;padding:5px 13px;font-size:.8rem;font-weight:700">#' + esc(t) + '</a>';
          }).join('');
        }
        var total = posts.length;
        posts = append ? posts.slice(0, (state.page) * PAGE) : posts.slice(0, (state.page || 1) * PAGE);
        var moreBtn = d.getElementById('blog-more');
        if (moreBtn) moreBtn.style.display = total > posts.length ? '' : 'none';
        if (!posts.length) {
          box.innerHTML = '<div class="card" style="grid-column:1/-1;padding:40px;text-align:center"><div style="font-size:2.4rem">📝</div><h3>Nothing here yet</h3><p class="muted">The studio has not published any posts yet — check back soon.</p></div>';
          return;
        }
        
        box.style.gridTemplateColumns = 'repeat(auto-fill, minmax(320px, 1fr))';
        box.style.gap = '24px';
        var heroIdx = posts.findIndex(function (p) { return p.pinned; });
        if (heroIdx < 0) heroIdx = 0;
        box.innerHTML = posts.map(function (p, i) {
          var isHero = (i === heroIdx && !query && !category && !tag);
          var cover = p.cover_url
            ? '<div style="height:'+(isHero?'280px':'200px')+'; background:#f1f5f9 center/cover no-repeat url(&quot;' + esc(p.cover_url) + '&quot;); transition: transform 0.4s ease;" class="blog-img"></div>'
            : '<div style="height:'+(isHero?'280px':'200px')+'; background:var(--gradient,linear-gradient(135deg,#0506ae,#964eec)); display:flex; align-items:center; justify-content:center; color:#fff; font-size:3rem; transition: transform 0.4s ease;" class="blog-img">📄</div>';
          
          return '<a class="card blog-card" style="text-decoration:none; color:inherit; overflow:hidden; display:flex; flex-direction:column; padding:0; border:none; box-shadow:0 10px 25px rgba(0,0,0,0.05); transition: box-shadow 0.3s ease; border-radius: 16px; ' + (isHero ? 'grid-column: 1 / -1; flex-direction: row; align-items: center;' : '') + '" href="blog-post.html?slug=' + encodeURIComponent(p.slug) + '" onmouseover="this.style.boxShadow=\'0 20px 40px rgba(0,0,0,0.1)\'; this.querySelector(\'.blog-img\').style.transform=\'scale(1.05)\';" onmouseout="this.style.boxShadow=\'0 10px 25px rgba(0,0,0,0.05)\'; this.querySelector(\'.blog-img\').style.transform=\'scale(1)\';">' +
            '<div style="overflow:hidden; '+(isHero?'width:50%; height:100%;':'')+'">' + cover + '</div>' +
            '<div style="padding:24px; display:flex; flex-direction:column; flex:1; '+(isHero?'width:50%;':'')+'">' +
              '<div style="font-size:.75rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--primary,#0506ae); margin-bottom: 8px;">' + esc(p.category || 'News') + ' · ' + fmt(p.published_at) + '</div>' +
              '<h3 style="margin:0 0 12px; line-height:1.35; font-size:'+(isHero?'2rem':'1.4rem')+'; font-weight:800; color:#0f172a;">' + esc(p.title) + '</h3>' +
              (p.excerpt ? '<p style="margin:0 0 16px; font-size:'+(isHero?'1.1rem':'0.95rem')+'; line-height:1.6; color:#475569; flex:1;">' + esc(p.excerpt) + '</p>' : '<div style="flex:1"></div>') +
              '<div style="font-size:.85rem; color:#64748b; font-weight: 500; display:flex; align-items:center; gap: 12px; flex-wrap:wrap;">' +
                '<span style="background:#f1f5f9; padding:6px 12px; border-radius:999px;">✍️ ' + esc(p.author_name || 'The Studio') + '</span>' +
                '<span>👁 ' + (p.view_count || 0) + ' reads</span>' +
                '<span>⏱ ' + (p.read_min || 3) + ' min</span>' +
                (p.pinned ? '<span style="background:#fef3c7;color:#92400e;padding:6px 12px;border-radius:999px;font-weight:800">📌 Pinned</span>' : '') +
              '</div>' +
            '</div></a>';
        }).join('');
      } catch (e) {
        box.innerHTML = '<div class="card" style="grid-column:1/-1;padding:30px;text-align:center"><p class="muted">Could not load posts: ' + esc(e && e.message || e) + '</p></div>';
      }
    },

    mountPost() {
      var root = d.getElementById('blog-post-root');
      if (!root) return;
      var slug = new URLSearchParams(location.search).get('slug') || '';
      if (!slug) { root.innerHTML = '<p class="muted">No post selected. <a href="blog.html">Browse the blog</a>.</p>'; return; }
      root.innerHTML = '<p class="muted">Loading…</p>';
      var self = this;
            var done = function (post) {
        if (!post) {
          root.innerHTML = '<div class="card" style="max-width:560px;margin:30px auto;text-align:center;padding:40px"><h3>Post not found</h3><p class="muted">It may have been unpublished.</p><p><a class="btn btn-primary" href="blog.html">Back to blog</a></p></div>';
          return;
        }
        d.title = (post.title || 'Post') + ' · ' + d.title.split('·').pop().trim();
        var wordCount = (post.body || '').split(/\s+/).length;
        var readTime = Math.max(1, Math.ceil(wordCount / 200));
        var cover = post.cover_url
          ? '<div style="border-radius:24px;overflow:hidden;margin:32px 0;box-shadow:0 12px 35px rgba(0,0,0,0.08)"><img src="' + esc(post.cover_url) + '" alt="" style="width:100%;max-height:550px;object-fit:cover;display:block;background:#f8fafc"></div>'
          : '';
        var authorInitials = esc(post.author_name || 'T S').split(' ').map(n => n[0]).join('').slice(0, 2);
        
        /* V44: real reactions (like / applause / insight) through
           tc_blog_react — the old button showed the VIEW count as if it were
           applause, which was misleading. */
        var reactionBtn = function (kind, icon, label) {
          return '<button type="button" data-react="' + kind + '" style="display:inline-flex;align-items:center;gap:8px;color:#475569;padding:10px 18px;border-radius:99px;background:#f1f5f9;border:1px solid transparent;transition:all .2s;font-family:var(--font);font-weight:600;cursor:pointer;font-size:.95rem">' + icon + ' <span data-count="' + kind + '">·</span> <span style="font-size:.78rem;opacity:.75">' + label + '</span></button>';
        };
        var reactionsRow = '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:34px 0">' +
          reactionBtn('like', '❤️', 'liked this') +
          reactionBtn('clap', '👏', 'applause') +
          reactionBtn('insight', '💡', 'learned something') +
        '</div>';
        
        var shareBtns = shareRow(location.href, post.title);

        root.innerHTML =
          '<article style="max-width:800px;margin:40px auto;padding:0 20px;font-family:\'Source Serif 4\', Georgia, serif;">' +
            '<div style="text-align:center;max-width:720px;margin:0 auto">' +
              '<div style="font-family:var(--font);font-size:.85rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--primary,#0506ae);margin-bottom:20px">' + esc(post.category || 'News') + '</div>' +
              '<h1 style="font-size:clamp(2.2rem,5vw,3.4rem);line-height:1.15;margin:0 0 24px;font-weight:800;color:#0f172a;letter-spacing:-0.02em">' + esc(post.title) + '</h1>' +
              (post.excerpt ? '<h2 style="font-family:var(--font);font-weight:400;font-size:1.35rem;color:#475569;line-height:1.6;margin:0 0 36px">' + esc(post.excerpt) + '</h2>' : '') +
              
              '<div style="display:flex;align-items:center;justify-content:center;gap:16px;font-family:var(--font);border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;padding:24px 0;margin-bottom:36px;flex-wrap:wrap">' +
                '<div style="width:52px;height:52px;border-radius:50%;background:var(--gradient);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.2rem;box-shadow:0 4px 12px rgba(5,6,174,.2)">' + authorInitials + '</div>' +
                '<div style="text-align:left">' +
                  '<div style="font-weight:800;color:#0f172a;font-size:1.1rem">' + esc(post.author_name || 'The Studio') + '</div>' +
                  '<div style="font-size:.9rem;color:#64748b;font-weight:500">' + fmt(post.published_at) + ' · ' + readTime + ' min read</div>' +
                '</div>' +
                '<div style="flex:1;min-width:40px"></div>' +
                shareBtns +
              '</div>' +
            '</div>' +
            cover +
            '<div class="blog-body" style="font-size:1.25rem;line-height:1.8;color:#1e293b;margin:40px auto;max-width:720px">' + md(post.body) + '</div>' +
            
            '<div style="max-width:720px;margin:40px auto;display:flex;justify-content:space-between;align-items:center;padding:24px 0;border-top:1px solid #e2e8f0;font-family:var(--font);flex-wrap:wrap;gap:16px">' +
              (post.tags ? '<div style="display:flex;gap:8px;flex-wrap:wrap">' + String(post.tags).split(',').map(function (t) { return '<a href="blog.html?tag=' + encodeURIComponent(t.trim()) + '" style="background:#f8fafc;color:#475569;border-radius:8px;padding:6px 14px;font-size:.85rem;font-weight:700;border:1px solid #e2e8f0;text-decoration:none">#' + esc(t.trim()) + '</a>'; }).join('') + '</div>' : '<div></div>') +
              '<span style="font-size:.85rem;color:#64748b;font-weight:600">👁 ' + (post.view_count || 0) + ' reads · ⏱ ' + (post.read_min || readMin(post.body)) + ' min</span>' +
            '</div>' +

            '<div style="max-width:720px;margin:60px auto;background:#f8fafc;border:1px solid #e2e8f0;border-radius:24px;padding:32px;display:flex;align-items:center;gap:24px;font-family:var(--font);box-shadow:0 10px 30px rgba(15,23,42,0.03)">' +
              '<div style="width:80px;height:80px;border-radius:50%;background:var(--gradient);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:2rem;flex-shrink:0">' + authorInitials + '</div>' +
              '<div>' +
                '<div style="font-size:.85rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:6px">Written by</div>' +
                '<h3 style="margin:0 0 10px;font-size:1.6rem;color:#0f172a;font-weight:800">' + esc(post.author_name || 'The Studio') + '</h3>' +
                '<p style="margin:0;color:#475569;font-size:1.05rem;line-height:1.55">Tutor and contributor at ' + esc(practiceName()) + '. Passionate about empowering learners through digital and hybrid education strategies.</p>' +
              '</div>' +
            '</div>' +

            reactionsRow +
            '<div id="blog-nav" style="max-width:720px;margin:34px auto;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;font-family:var(--font)"></div>' +
            '<div id="blog-related" style="max-width:720px;margin:14px auto 0;font-family:var(--font)"></div>' +
            subscribeBox(false) +
            '<div id="blog-comments" style="max-width:720px;margin:34px auto;font-family:var(--font)"></div>' +
          '</article>';

        self._enhancePost(root, post, slug);
      };

      if (w.sb) {
        w.sb.rpc('tc_blog_get', { p_slug: slug }).then(function ({ data, error }) {
          if (error) { root.innerHTML = '<p class="muted">Could not load post: ' + esc(error.message) + '</p>'; return; }
          done(data && data.ok ? data.post : null);
        });
      } else {
        var demo = (w.DEMO && Array.isArray(w.DEMO.tc_blog_posts) && w.DEMO.tc_blog_posts.filter(function (p) { return p.status === 'published' && p.slug === slug; })[0]) || null;
        done(demo);
      }
    },

    /* ---------------- V44 post enhancement (run after render) ---------------- */
    _enhancePost: async function (root, post, slug) {
      /* 1. reading progress bar */
      try {
        var bar = d.createElement('div');
        bar.id = 'blog-progress';
        bar.style.cssText = 'position:fixed;top:0;left:0;height:3px;width:0;z-index:9999;background:linear-gradient(90deg,#0506ae,#964eec);transition:width .1s linear';
        d.body.appendChild(bar);
        var art = root.querySelector('article');
        var onScroll = function () {
          if (!art || !d.body.contains(bar)) { w.removeEventListener('scroll', onScroll); return; }
          var rect = art.getBoundingClientRect();
          var total = rect.height - w.innerHeight + 120;
          var donePx = Math.min(Math.max(-rect.top + 60, 0), Math.max(total, 1));
          bar.style.width = Math.round(donePx / Math.max(total, 1) * 100) + '%';
        };
        w.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
      } catch (e) {}

      /* 2. table of contents from the rendered h2s (h3 in source = h2 here) */
      try {
        var body = root.querySelector('.blog-body');
        var heads = body ? body.querySelectorAll('h2[id], h3[id]') : [];
        if (heads.length >= 3) {
          var toc = d.createElement('div');
          toc.style.cssText = 'max-width:720px;margin:0 auto 28px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:18px 22px;font-family:var(--font)';
          var html = '';
          heads.forEach(function (h) {
            var isSub = h.tagName === 'H3';
            html += '<div style="' + (isSub ? 'padding-left:18px;' : '') + 'margin:4px 0"><a href="#' + h.id + '" style="color:#334155;text-decoration:none;font-size:.95rem;font-weight:' + (isSub ? '500' : '700') + '">' + esc(h.textContent) + '</a></div>';
          });
          toc.innerHTML = '<div style="font-weight:800;letter-spacing:.06em;text-transform:uppercase;font-size:.78rem;color:#64748b;margin-bottom:8px">📑 On this page</div>' + html;
          if (body && body.parentNode) body.parentNode.insertBefore(toc, body);
        }
      } catch (e) {}

      /* 3. copy buttons on code blocks */
      root.querySelectorAll('.blog-code-copy').forEach(function (b) {
        b.onclick = function () {
          try {
            navigator.clipboard.writeText(b.getAttribute('data-code')).then(function () {
              b.textContent = '✅ Copied';
              setTimeout(function () { b.textContent = '⧉ Copy'; }, 1600);
            });
          } catch (e) {}
        };
      });

      /* 4. reactions: load counts, then wire taps (one of each per visitor) */
      var wireReactions = function (counts) {
        root.querySelectorAll('[data-react]').forEach(function (btn) {
          var kind = btn.getAttribute('data-react');
          var c = counts && counts[kind] || 0;
          var el = btn.querySelector('[data-count="' + kind + '"]');
          if (el) el.textContent = c;
          var mine = false;
          try { mine = !!w.localStorage.getItem('tc-blog-reacted-' + slug + '-' + kind); } catch (e) {}
          if (mine) { btn.style.borderColor = '#4338ca'; btn.style.background = '#e0e7ff'; btn.style.color = '#4338ca'; }
          btn.onclick = async function () {
            try { w.localStorage.setItem('tc-blog-reacted-' + slug + '-' + kind, '1'); } catch (e) {}
            btn.style.borderColor = '#4338ca'; btn.style.background = '#e0e7ff'; btn.style.color = '#4338ca';
            if (el) el.textContent = String((parseInt(el.textContent, 10) || 0) + (mine ? 0 : 1));
            mine = true;
            try {
              if (w.sb) {
                var res = await w.sb.rpc('tc_blog_react', { p_slug: slug, p_reaction: kind, p_visitor: readerId() });
                var data = res && res.data;
                if (data && data.ok && data.counts) {
                  for (var k in data.counts) {
                    var cel = root.querySelector('[data-count="' + k + '"]');
                    if (cel) cel.textContent = data.counts[k];
                  }
                }
              }
            } catch (e) {}
          };
        });
      };
      /* counts render as 0 and update to the true server counts the moment a
         reader reacts (the RPC returns the fresh tally for all three kinds) */
      wireReactions(null);

      /* 5. prev / next / related */
      try {
        if (w.sb) {
          var res2 = await w.sb.rpc('tc_blog_list', {});
          var posts = (res2.data || []);
          var idx = -1;
          for (var i = 0; i < posts.length; i++) if (posts[i].slug === slug) { idx = i; break; }
          var nav = d.getElementById('blog-nav');
          if (nav && idx > -1) {
            var prev = posts[idx + 1];   /* list is newest-first: prev = older */
            var next = posts[idx - 1];   /* next = newer */
            nav.innerHTML =
              (prev ? '<a href="blog-post.html?slug=' + encodeURIComponent(prev.slug) + '" style="flex:1;min-width:220px;text-decoration:none;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 18px;color:#334155"><div style="font-size:.72rem;font-weight:800;letter-spacing:.08em;color:#64748b;text-transform:uppercase">← Older</div><b>' + esc(prev.title) + '</b></a>' : '<span style="flex:1"></span>') +
              (next ? '<a href="blog-post.html?slug=' + encodeURIComponent(next.slug) + '" style="flex:1;min-width:220px;text-decoration:none;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px 18px;color:#334155;text-align:right"><div style="font-size:.72rem;font-weight:800;letter-spacing:.08em;color:#64748b;text-transform:uppercase">Newer →</div><b>' + esc(next.title) + '</b></a>' : '<span style="flex:1"></span>');
          }
          var rel = d.getElementById('blog-related');
          if (rel) {
            var myTags = String(post.tags || '').split(',').map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean);
            var related = posts.filter(function (p) {
              if (p.slug === slug) return false;
              var pt = String(p.tags || '').split(',').map(function (t) { return t.trim().toLowerCase(); });
              return (post.category && p.category === post.category) || pt.some(function (t) { return myTags.indexOf(t) > -1; });
            }).slice(0, 3);
            if (related.length) {
              rel.innerHTML = '<div style="font-weight:800;letter-spacing:.06em;text-transform:uppercase;font-size:.78rem;color:#64748b;margin:26px 0 12px">🔎 Related reading</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">' +
                related.map(function (p) {
                  return '<a href="blog-post.html?slug=' + encodeURIComponent(p.slug) + '" style="text-decoration:none;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;color:#0f172a"><b style="font-size:.95rem">' + esc(p.title) + '</b><div style="font-size:.78rem;color:#64748b;margin-top:6px">' + esc(p.category || '') + ' · ' + (p.read_min || 3) + ' min</div></a>';
                }).join('') + '</div>';
            }
          }
        }
      } catch (e) {}

      /* 6. comments */
      this._renderComments(slug, post);

      /* 7. newsletter box */
      wireSubscribe();

      /* 8. JSON-LD article schema (Ghost-style structured data) */
      try {
        d.getElementById('blog-jsonld') && d.getElementById('blog-jsonld').remove();
        var ld = d.createElement('script');
        ld.type = 'application/ld+json';
        ld.id = 'blog-jsonld';
        ld.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt || post.seo_description || '',
          image: post.cover_url || undefined,
          datePublished: post.published_at || undefined,
          dateModified: post.updated_at || post.published_at || undefined,
          author: { '@type': 'Person', name: post.author_name || 'The Studio' },
          publisher: { '@type': 'Organization', name: d.title.split('·').pop().trim() },
          mainEntityOfPage: location.href
        });
        d.head.appendChild(ld);
        if (post.cover_url) {
          var og = d.querySelector('meta[property="og:image"]') || (function () {
            var m = d.createElement('meta'); m.setAttribute('property', 'og:image'); d.head.appendChild(m); return m;
          })();
          og.setAttribute('content', post.cover_url);
        }
      } catch (e) {}
    },

    /* ---------------- V44 comments ---------------- */
    _renderComments: async function (slug, post, note) {
      var box = d.getElementById('blog-comments');
      if (!box) return;
      var self = this;
      var listHtml = function (items) {
        if (!items.length) return '<p class="muted" style="margin:8px 0 0">No comments yet — be the first to say something kind or useful.</p>';
        return items.map(function (c) {
          return '<div style="border:1px solid #e2e8f0;border-radius:14px;padding:12px 16px;margin:8px 0;background:#fff">' +
            '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b style="font-size:.92rem">' + esc(c.author_name || 'Reader') + '</b>' +
            '<span class="muted" style="font-size:.78rem">' + fmt(c.created_at) + '</span></div>' +
            '<div style="margin-top:6px;color:#334155;font-size:.95rem;line-height:1.55">' + esc(c.body) + '</div></div>';
        }).join('');
      };
      var render = function (items, note) {
        box.innerHTML = '<div style="border-top:1px solid #e2e8f0;padding-top:24px"><b style="font-size:1.1rem">💬 Comments</b>' +
          '<div id="blog-comments-list" style="margin-top:10px">' + listHtml(items) + '</div>' +
          '<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">' +
            '<input id="blog-c-name" class="form-input" placeholder="Your name" style="max-width:200px">' +
            '<input id="blog-c-body" class="form-input" placeholder="Write a comment…" style="flex:1;min-width:220px">' +
            '<button id="blog-c-send" class="btn btn-primary btn-sm" type="button">Post comment</button>' +
          '</div>' + (note ? '<div class="muted" style="font-size:.82rem;margin-top:6px">' + esc(note) + '</div>' : '') + '</div>';
        var send = d.getElementById('blog-c-send');
        if (send) send.onclick = async function () {
          var name = (d.getElementById('blog-c-name').value || '').trim();
          var body = (d.getElementById('blog-c-body').value || '').trim();
          if (!body) { if (w.toast) w.toast('Write a comment first.', 'warning'); return; }
          send.disabled = true;
          try {
            var res = w.sb
              ? await w.sb.rpc('tc_blog_comment_add', { p_slug: slug, p_name: name, p_body: body })
              : { data: { ok: true } };
            var data = res && res.data;
            if (res.error || !data || data.ok === false) {
              var reason = data && data.reason;
              if (reason === 'sign_in_required') {
                self._renderComments(slug, post, 'Sign in to your portal account to comment — this keeps spam out.');
                return;
              }
              throw new Error(reason || (res.error && res.error.message) || 'failed');
            }
            if (w.toast) w.toast('Comment posted ✅', 'success');
            self._renderComments(slug, post);
          } catch (e) {
            if (w.toast) w.toast('Could not post the comment: ' + (e.message || e), 'danger');
            send.disabled = false;
          }
        };
      };
      try {
        var items = [];
        if (w.sb) {
          var res = await w.sb.from('tc_blog_comments').select('author_name,body,created_at').eq('post_id', post.id).eq('status', 'visible').order('created_at', { ascending: false }).limit(50);
          items = (res.data || []);
        }
        render(items, note);
      } catch (e) {
        render([], 'Comments are unavailable right now.');
      }
    },

    /* ---------------------- staff editor ---------------------- */
    mountAdmin() {
      var root = d.getElementById('blog-admin-root');
      if (!root) return;
      var self = this;
      root.innerHTML =
        '<div id="blog-stats" class="card" style="padding:14px 16px;margin-bottom:14px;display:flex;gap:18px;flex-wrap:wrap;align-items:center"></div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;margin-bottom:14px">' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button class="btn btn-primary" type="button" id="blog-new">＋ New post</button>' +
            '<button class="btn btn-outline" type="button" id="blog-refresh">↻ Refresh</button>' +
            '<a class="btn btn-outline" href="blog.html" target="_blank" rel="noopener">👁 View public blog</a>' +
            '<button class="btn btn-outline" type="button" id="blog-export" title="Download every post (including drafts) as a JSON backup">⬇ Export all</button>' +
            '<button class="btn btn-outline" type="button" id="blog-import" title="Restore posts from an Export backup — existing slugs are skipped">⬆ Import</button>' +
            '<input type="file" id="blog-import-file" accept="application/json" style="display:none">' +
          '</div>' +
          '<span class="muted" style="font-size:.82rem">Cover art and media are links only (Drive / web) — nothing is uploaded.</span>' +
        '</div>' +
        '<div id="blog-comments-mod" class="card" style="padding:14px 16px;margin-bottom:16px"></div>' +
        '<div id="blog-form" class="card" style="display:none;margin-bottom:16px;padding:18px"></div>' +
        '<div id="blog-cats" class="card" style="padding:14px 16px;margin-bottom:16px">' +
          '<b>Categories</b> <span class="muted" style="font-size:.8rem">— manage the topic labels</span>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
            '<input id="blog-cat-name" class="form-input" style="flex:1;min-width:180px" placeholder="New category name">' +
            '<button class="btn btn-sm btn-outline" type="button" id="blog-cat-add">＋ Add</button>' +
          '</div>' +
          '<div id="blog-cat-list" style="margin-top:10px"></div>' +
        '</div>' +
        '<div id="blog-admin-list"></div>';
      d.getElementById('blog-new').onclick = function () { self._form(null, root); };
      d.getElementById('blog-refresh').onclick = function () { self._adminList(root); self._loadStats(); self._loadCommentsMod(); };
      d.getElementById('blog-cat-add').onclick = function () { self._addCat(); };
      d.getElementById('blog-export').onclick = function () { self._exportAll(); };
      d.getElementById('blog-import').onclick = function () { d.getElementById('blog-import-file').click(); };
      d.getElementById('blog-import-file').addEventListener('change', function () { self._importAll(this); });
      this._adminList(root);
      this._loadStats();
      this._loadCommentsMod();
      this._catList();
    },

    /* V44: Ghost-style dashboard numbers in one strip */
    _loadStats: async function () {
      var box = d.getElementById('blog-stats');
      if (!box || !w.sb) { if (box) box.style.display = 'none'; return; }
      try {
        var res = await w.sb.rpc('tc_blog_stats');
        var s = res && res.data;
        if (!s || s.ok === false) { box.style.display = 'none'; return; }
        var tile = function (icon, v, label, bg, fg) {
          return '<div style="display:flex;gap:10px;align-items:center;background:' + bg + ';border-radius:12px;padding:10px 16px">' +
            '<span style="font-size:1.3rem">' + icon + '</span><div><div style="font-weight:800;color:' + fg + ';font-size:1.15rem;line-height:1.1">' + v + '</div>' +
            '<div class="muted" style="font-size:.75rem">' + label + '</div></div></div>';
        };
        box.innerHTML =
          tile('📝', s.published || 0, 'published', '#dcfce7', '#166534') +
          tile('🟡', s.drafts || 0, 'drafts', '#fef3c7', '#92400e') +
          tile('⏰', s.scheduled || 0, 'scheduled', '#e0e7ff', '#3730a3') +
          tile('👁', s.views || 0, 'total reads', '#f1f5f9', '#0f172a') +
          tile('📬', s.subscribers || 0, 'subscribers', '#fce7f3', '#9d174d') +
          tile('💬', s.comments || 0, 'comments', '#ecfeff', '#155e75') +
          tile('👏', s.reactions || 0, 'reactions', '#fef9c3', '#854d0e');
        if (s.top_posts && s.top_posts.length) {
          box.innerHTML += '<div style="flex-basis:100%" class="muted" style="font-size:.8rem">Top: ' +
            s.top_posts.map(function (p) { return esc(p.title) + ' (' + p.views + ')'; }).join(' · ') + '</div>';
        }
      } catch (e) { box.style.display = 'none'; }
    },

    /* V44: comment moderation — recent comments with hide / restore */
    _loadCommentsMod: async function () {
      var box = d.getElementById('blog-comments-mod');
      if (!box || !w.sb) { if (box) box.style.display = 'none'; return; }
      try {
        var res = await w.sb.from('tc_blog_comments')
          .select('id,author_name,body,status,created_at,post_id,tc_blog_posts(title,slug)')
          .order('created_at', { ascending: false }).limit(20);
        var items = res.data || [];
        if (!items.length) { box.style.display = 'none'; return; }
        box.innerHTML = '<b>💬 Recent comments</b> <span class="muted" style="font-size:.8rem">— hide anything unkind or spammy; hidden comments vanish publicly but stay here</span>' +
          '<div style="margin-top:8px">' + items.map(function (c) {
            return '<div style="display:flex;gap:10px;align-items:center;border-top:1px solid #e2e8f0;padding:8px 0;flex-wrap:wrap">' +
              '<div style="flex:1;min-width:200px"><b>' + esc(c.author_name) + '</b> <span class="muted" style="font-size:.75rem">on ' + esc((c.tc_blog_posts && c.tc_blog_posts.title) || 'a post') + ' · ' + fmt(c.created_at) + '</span>' +
              '<div style="font-size:.88rem;color:#334155">' + esc(String(c.body || '').slice(0, 160)) + (String(c.body || '').length > 160 ? '…' : '') + '</div></div>' +
              (c.status === 'visible'
                ? '<button type="button" class="btn btn-sm btn-outline" data-chide="' + c.id + '">🙈 Hide</button>'
                : '<button type="button" class="btn btn-sm btn-outline" data-cshow="' + c.id + '">👁 Restore</button>') +
            '</div>';
          }).join('') + '</div>';
        var self2 = this;
        box.querySelectorAll('[data-chide]').forEach(function (b) {
          b.onclick = async function () {
            await w.sb.from('tc_blog_comments').update({ status: 'hidden' }).eq('id', b.getAttribute('data-chide'));
            self2._loadCommentsMod();
          };
        });
        box.querySelectorAll('[data-cshow]').forEach(function (b) {
          b.onclick = async function () {
            await w.sb.from('tc_blog_comments').update({ status: 'visible' }).eq('id', b.getAttribute('data-cshow'));
            self2._loadCommentsMod();
          };
        });
      } catch (e) { box.style.display = 'none'; }
    },

    /* V44: full-content backup / restore (WordPress-style portability) */
    _exportAll: async function () {
      if (!w.sb) return;
      try {
        var res = await w.sb.from('tc_blog_posts').select('*').order('created_at');
        var posts = res.data || [];
        var catRes = await w.sb.from('tc_blog_categories').select('*').order('name');
        var pack = { kind: 'tc-blog-backup', exported_at: new Date().toISOString(), categories: catRes.data || [], posts: posts };
        var blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
        var a = d.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'blog-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        if (w.toast) w.toast('Exported ' + posts.length + ' posts ✅', 'success');
      } catch (e) { if (w.toast) w.toast('Export failed: ' + (e.message || e), 'danger'); }
    },
    _importAll: async function (input) {
      if (!input || !input.files || !input.files[0] || !w.sb) return;
      var self = this;
      try {
        var pack = JSON.parse(await input.files[0].text());
        if (!pack || pack.kind !== 'tc-blog-backup' || !Array.isArray(pack.posts)) throw new Error('Not a blog backup file');
        if (!confirm('Import ' + pack.posts.length + ' posts? Existing slugs are kept untouched.')) return;
        var ok = 0, skipped = 0;
        for (var i = 0; i < pack.posts.length; i++) {
          var p = pack.posts[i];
          var dup = await w.sb.from('tc_blog_posts').select('id').eq('slug', p.slug).maybeSingle();
          if (dup && dup.data) { skipped++; continue; }
          var row = {
            slug: p.slug, title: p.title, body: p.body || '', excerpt: p.excerpt || null,
            category_id: null, cover_url: p.cover_url || null, tags: p.tags || null,
            seo_description: p.seo_description || null, author_name: p.author_name || null,
            status: p.status === 'published' ? 'published' : 'draft',
            published_at: p.published_at || null, pinned: !!p.pinned
          };
          var ins = await w.sb.from('tc_blog_posts').insert(row);
          if (ins.error) skipped++; else ok++;
        }
        if (w.toast) w.toast('Imported ' + ok + ' posts, skipped ' + skipped + ' (duplicate slugs)', 'success', 6000);
        self._adminList(d.getElementById('blog-admin-root'));
        self._loadStats();
      } catch (e) { if (w.toast) w.toast('Import failed: ' + (e.message || e), 'danger'); }
      input.value = '';
    },

    async _addCat() {
      var inp = d.getElementById('blog-cat-name');
      var name = (inp.value || '').trim();
      if (!name || !w.sb) return;
      var slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'cat';
      var { error } = await w.sb.from('tc_blog_categories').insert({ name: name, slug: slug });
      if (error) { if (w.toast) toast(error.message, 'danger'); return; }
      inp.value = '';
      if (w.toast) toast('Category added', 'success');
      this._catList();
      var sel = d.getElementById('blog-form-cat');
      if (sel) this._fillCatSel(sel);
    },

    async _catList() {
      var box = d.getElementById('blog-cat-list');
      if (!box || !w.sb) return;
      var self = this;
      var { data } = await w.sb.from('tc_blog_categories').select('*').order('name');
      box.innerHTML = (data || []).map(function (c) {
        return '<span style="display:inline-flex;align-items:center;gap:6px;background:var(--surface-soft,#f1f5f9);border:1px solid var(--gray-200,#e2e8f0);border-radius:99px;padding:4px 8px 4px 12px;margin:0 6px 6px 0;font-size:.8rem">' + esc(c.name) +
          '<button type="button" data-cat-del="' + c.id + '" style="border:0;background:none;cursor:pointer;color:#b42318;font-weight:800">×</button></span>';
      }).join('') || '<span class="muted">No categories yet.</span>';
      box.querySelectorAll('[data-cat-del]').forEach(function (b) {
        b.onclick = async function () {
          if (!confirm('Delete this category? Posts keep their text but lose the label.')) return;
          var { error } = await w.sb.from('tc_blog_categories').delete().eq('id', b.getAttribute('data-cat-del'));
          if (error) { if (w.toast) toast(error.message, 'danger'); return; }
          self._catList();
        };
      });
    },

    async _fillCatSel(sel) {
      if (!sel || !w.sb) return;
      var { data } = await w.sb.from('tc_blog_categories').select('id,name').order('name');
      var cur = sel.value;
      sel.innerHTML = '<option value="">— none —</option>' + (data || []).map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + '</option>'; }).join('');
      sel.value = cur;
    },

    _form(post, root) {
      var self = this;   /* without this, `self` resolves to window.self and the save/publish/delete buttons throw */
      var box = d.getElementById('blog-form');
      box.style.display = 'block';
      box.innerHTML =
        '<h3 style="margin:0 0 12px">' + (post ? '✏️ Edit post' : '＋ New post') + '</h3>' +
        '<div class="grid grid-2">' +
          '<div class="form-group"><label>Title *</label><input class="form-input" id="blog-f-title" value="' + (post ? esc(post.title) : '') + '" required></div>' +
          '<div class="form-group"><label>Slug (blank = auto)</label><input class="form-input" id="blog-f-slug" value="' + (post ? esc(post.slug) : '') + '" placeholder="my-first-post"></div>' +
          '<div class="form-group"><label>Category</label><select class="form-select" id="blog-f-cat"></select></div>' +
          '<div class="form-group"><label>Status</label><select class="form-select" id="blog-f-status">' +
            '<option value="draft"' + (post && post.status === 'draft' ? ' selected' : '') + '>Draft</option>' +
            '<option value="published"' + (post && post.status === 'published' ? ' selected' : '') + '>Published</option>' +
            '<option value="archived"' + (post && post.status === 'archived' ? ' selected' : '') + '>Archived</option>' +
          '</select></div>' +
          '<div class="form-group"><label>Publish on (schedule — blank = immediately when published)</label><input class="form-input" type="datetime-local" id="blog-f-when" value="' + (post && post.published_at ? esc(String(post.published_at).slice(0, 16)) : '') + '" title="Pick a future date and the post stays hidden until then"></div>' +
          '<div class="form-group" style="display:flex;align-items:center;gap:8px;padding-top:26px"><input type="checkbox" id="blog-f-pin"' + (post && post.pinned ? ' checked' : '') + ' style="width:18px;height:18px"><label for="blog-f-pin" style="margin:0">📌 Pin to the top of the blog</label></div>' +
          '<div class="form-group"><label>Cover image (Drive / web link)</label><input class="form-input" id="blog-f-cover" value="' + (post ? esc(post.cover_url || '') : '') + '" placeholder="https://drive.google.com/…"></div>' +
          '<div class="form-group"><label>Tags (comma separated)</label><input class="form-input" id="blog-f-tags" value="' + (post ? esc(post.tags || '') : '') + '" placeholder="maths, igcse, exam-tips"></div>' +
          '<div class="form-group" style="grid-column:1/-1"><label>Excerpt (shown on the blog card)</label><input class="form-input" id="blog-f-excerpt" value="' + (post ? esc(post.excerpt || '') : '') + '"></div>' +
          '<div class="form-group" style="grid-column:1/-1"><label>Body * — paragraphs, ## headings, - lists, **bold**, [text](https://…), > quotes, \`\`\` code blocks</label><textarea class="form-textarea" id="blog-f-body" rows="12" required>' + (post ? esc(post.body || '') : '') + '</textarea>' +
            '<div style="display:flex;gap:14px;align-items:center;margin-top:6px;flex-wrap:wrap">' +
              '<span class="muted" id="blog-f-count" style="font-size:.8rem"></span>' +
              '<button class="btn btn-sm btn-outline" type="button" id="blog-f-preview">👁 Live preview</button>' +
              '<span class="muted" id="blog-f-draft" style="font-size:.8rem"></span>' +
            '</div>' +
            '<div id="blog-f-preview-box" class="blog-body card" style="display:none;margin-top:10px;padding:20px;max-height:420px;overflow:auto;font-size:1.05rem"></div>' +
          '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">' +
          '<button class="btn btn-primary" type="button" id="blog-f-save">💾 Save</button>' +
          (post ? '<button class="btn btn-outline" type="button" id="blog-f-publish">' + (post.status === 'published' ? '📥 Unpublish' : '🚀 Publish now') + '</button>' : '') +
          (post ? '<button class="btn btn-danger" type="button" id="blog-f-del">🗑 Delete</button>' : '') +
          '<button class="btn btn-ghost" type="button" id="blog-f-cancel">Cancel</button>' +
        '</div>';
      this._fillCatSel(d.getElementById('blog-f-cat')).then(function () {
        var sel = d.getElementById('blog-f-cat');
        if (post && post.category_id) sel.value = post.category_id;
      });
      /* V44: live preview, word/read-time counters and draft autosave */
      var bodyTa = d.getElementById('blog-f-body');
      var countEl = d.getElementById('blog-f-count');
      var draftEl = d.getElementById('blog-f-draft');
      var AS_KEY = 'tc-blog-draft-' + (post ? post.id : 'new');
      var refreshCounters = function () {
        var words = bodyTa.value.split(/\s+/).filter(Boolean).length;
        countEl.textContent = words + ' words · ~' + readMin(bodyTa.value) + ' min read';
      };
      refreshCounters();
      bodyTa.addEventListener('input', function () {
        refreshCounters();
        try { w.localStorage.setItem(AS_KEY, bodyTa.value); draftEl.textContent = '💾 draft autosaved'; } catch (e) {}
        var pv = d.getElementById('blog-f-preview-box');
        if (pv && pv.style.display !== 'none') pv.innerHTML = md(bodyTa.value);
      });
      if (!post) {
        try {
          var savedDraft = w.localStorage.getItem(AS_KEY);
          if (savedDraft && savedDraft.trim() && !bodyTa.value.trim()) {
            bodyTa.value = savedDraft;
            refreshCounters();
            draftEl.textContent = '💾 recovered your last draft';
          }
        } catch (e) {}
      }
      d.getElementById('blog-f-preview').onclick = function () {
        var pv = d.getElementById('blog-f-preview-box');
        var on = pv.style.display === 'none';
        pv.style.display = on ? 'block' : 'none';
        if (on) pv.innerHTML = md(bodyTa.value);
        this.textContent = on ? '🙈 Hide preview' : '👁 Live preview';
      };
      d.getElementById('blog-f-save').onclick = function () { self._save(post, box); };
      if (post) {
        d.getElementById('blog-f-publish').onclick = function () {
          var next = post.status === 'published' ? 'draft' : 'published';
          if (w.sb) w.sb.rpc('tc_blog_set_status', { p_id: post.id, p_status: next }).then(function ({ error }) {
            if (error) { if (w.toast) toast(error.message, 'danger'); return; }
            if (w.toast) toast(next === 'published' ? 'Post published — it is live on the public blog' : 'Post unpublished', 'success');
            self._adminList(root);
          });
        };
        d.getElementById('blog-f-del').onclick = async function () {
          if (!confirm('Delete this post permanently?')) return;
          var { error } = await w.sb.from('tc_blog_posts').delete().eq('id', post.id);
          if (error) { if (w.toast) toast(error.message, 'danger'); return; }
          if (w.toast) toast('Post deleted', 'success');
          box.style.display = 'none';
          self._adminList(root);
        };
      }
      d.getElementById('blog-f-cancel').onclick = function () { box.style.display = 'none'; };
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    /* V40 (item 9) — a save that cannot fail silently.
       Three defects made "Save"/"Publish" appear to do nothing and were fatal
       to correctness once a post was actually reached by a reader:
         1. slug is `text not null unique`, but a blank slug arrived as NULL and
            the insert threw a 23502 that the toast never surfaced clearly.
         2. published_at was never set, so a published post could never be found
            by the public reader (it filters on status AND published_at order).
         3. excerpt / seo_description were left blank, so the blog cards and the
            shared social card (LinkedIn / Facebook / X) had no summary.
       All three are handled here, in the client, so no DB RPC is required. */
    _slugify: function (t) {
      return String(t || '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'post';
    },
    async _save(post, box) {
      if (!w.sb) { if (w.toast) toast('Connect Supabase to save posts', 'warning'); return; }
      var title = d.getElementById('blog-f-title').value.trim();
      var body = d.getElementById('blog-f-body').value;
      if (!title || !body.trim()) { if (w.toast) toast('Title and body are required', 'warning'); return; }
      var manualSlug = d.getElementById('blog-f-slug').value.trim();
      var slug = manualSlug || this._slugify(title);
      var status = d.getElementById('blog-f-status').value;
      var excerpt = d.getElementById('blog-f-excerpt').value.trim() ||
                    body.replace(/[#*`>\-\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
      var profile = (w.TC_PROFILE && (w.TC_PROFILE.id || w.TC_PROFILE.user_id)) ? w.TC_PROFILE : null;

      /* Uniqueness: if we auto-derived a slug that already exists, append a
         short suffix so the second post of the same title does not collide. */
      if (!manualSlug && post && post.slug !== slug && slug && !/^[0-9a-f-]{36}$/.test(slug)) {
        var dup = await w.sb.from('tc_blog_posts').select('id').eq('slug', slug).limit(1).maybeSingle();
        if (dup && dup.data) slug = slug + '-' + Date.now().toString(36);
      }
      /* V44: pin + schedule. A future date keeps the post published but
         INVISIBLE to readers until that moment (tc_blog_list filters on
         published_at <= now()). */
      var whenVal = (d.getElementById('blog-f-when') || {}).value || '';
      var payload = {
        title: title,
        slug: slug,
        category_id: d.getElementById('blog-f-cat').value || null,
        status: status,
        pinned: !!(d.getElementById('blog-f-pin') || {}).checked,
        cover_url: d.getElementById('blog-f-cover').value.trim() || null,
        tags: d.getElementById('blog-f-tags').value.trim() || null,
        excerpt: excerpt,
        seo_description: excerpt,
        body: body
      };
      if (profile) { payload.author_id = profile.id || profile.user_id; payload.author_name = profile.full_name || profile.name || ''; }
      /* A post leaving draft gets its publication timestamp now. Existing
         published posts keep theirs. Re-dating to "now" every edit would move
         the post around the blog, which readers experience as it reappearing. */
      if (status === 'published' && whenVal) {
        payload.published_at = new Date(whenVal).toISOString();
      } else if (status === 'published' && !(post && post.published_at)) {
        payload.published_at = new Date().toISOString();
      }
      if (post) payload.updated_at = new Date().toISOString();
      try { w.localStorage.removeItem('tc-blog-draft-' + (post ? post.id : 'new')); } catch (e) {}
      try {
        var saved;
        if (post) {
          var { data: u, error } = await w.sb.from('tc_blog_posts').update(payload).eq('id', post.id).select('id');
          if (error) throw error; saved = u && u[0];
        } else {
          var { data: ins, error: err2 } = await w.sb.from('tc_blog_posts').insert(payload).select('id,slug,name,status');
          if (err2) throw err2; saved = ins && ins[0];
        }
        var liveSlug = (saved && saved.slug) || slug;
        if (w.toast) toast(status === 'published'
          ? 'Published — live at blog.html?slug=' + liveSlug
          : 'Saved as ' + (d.getElementById('blog-f-status').selectedOptions && d.getElementById('blog-f-status').selectedOptions[0] ? d.getElementById('blog-f-status').selectedOptions[0].text.toLowerCase() : 'draft'));
        box.style.display = 'none';
        this._adminList(document.getElementById('blog-admin-root'));
      } catch (e) {
        var msg = e && (e.message || e.error_description) || String(e);
        if (w.toast) toast(msg.indexOf('duplicate') > -1 || msg.indexOf('23505') > -1
          ? 'That slug is already used — change the slug or title.' : msg, 'danger');
      }
    },

    async _adminList(root) {
      var box = d.getElementById('blog-admin-list');
      if (!box) return;
      box.innerHTML = '<p class="muted">Loading…</p>';
      var posts = [];
      try {
        if (w.sb) {
          var { data, error } = await w.sb.rpc('tc_blog_my_posts');
          if (error) throw error;
          posts = (data && Array.isArray(data)) ? data : [];
        } else {
          posts = (w.DEMO && Array.isArray(w.DEMO.tc_blog_posts)) ? w.DEMO.tc_blog_posts : [];
        }
      } catch (e) {
        box.innerHTML = '<p class="muted">Could not load posts: ' + esc(e && e.message || e) + '</p>';
        return;
      }
      if (!posts.length) {
        box.innerHTML = '<div class="card" style="padding:30px;text-align:center"><p class="muted">No posts yet — press <b>＋ New post</b> to write the first one.</p></div>';
        return;
      }
      var badge = { published: '🟢 Published', draft: '🟡 Draft', archived: '⚪ Archived' };
      box.style.gridTemplateColumns = '';
      box.style.gap = '';
      box.innerHTML = '<div class="table-wrap"><table style="width:100%"><thead><tr><th align="left">Title</th><th align="left">Status</th><th align="left">Category</th><th align="right">Views</th><th align="right">Actions</th></tr></thead><tbody>' +
        posts.map(function(p) {
          return '<tr>' +
            '<td><strong>' + esc(p.title) + '</strong>' + (p.pinned ? ' 📌' : '') + '<br><small class="muted">' + fmt(p.published_at || p.created_at) + (p.read_min ? ' · ' + p.read_min + ' min' : '') + '</small></td>' +
            '<td><span class="badge">' + (badge[p.status] || p.status) + '</span>' + (p.scheduled ? '<br><small style="color:#3730a3">⏰ ' + fmt(p.published_at) + '</small>' : '') + '</td>' +
            '<td>' + esc(p.category || 'News') + '</td>' +
            '<td align="right">' + (p.view_count || 0) + '</td>' +
            '<td align="right" style="white-space:nowrap">' +
              '<button type="button" class="btn btn-sm btn-outline" data-edit="' + esc(p.id) + '">Edit</button> ' +
              '<button type="button" class="btn btn-sm btn-outline" data-pin="' + esc(p.id) + '" data-pinned="' + (p.pinned ? '1' : '') + '" title="Pin to the top of the public blog">' + (p.pinned ? '📌 Unpin' : '📌 Pin') + '</button> ' +
              (p.status === 'published' && !p.scheduled ? '<a href="blog-post.html?slug=' + encodeURIComponent(p.slug) + '" class="btn btn-sm btn-outline" target="_blank">View</a>' : '') +
            '</td>' +
          '</tr>';
        }).join('') +
      '</tbody></table></div>';
      var self = this;
      box.querySelectorAll('[data-edit]').forEach(function (b) {
        b.onclick = async function () {
          var { data } = await w.sb.from('tc_blog_posts').select('*').eq('id', b.getAttribute('data-edit')).single();
          if (data) self._form(data, root);
        };
      });
      box.querySelectorAll('[data-pin]').forEach(function (b) {
        b.onclick = async function () {
          var { error } = await w.sb.from('tc_blog_posts')
            .update({ pinned: !b.getAttribute('data-pinned') })
            .eq('id', b.getAttribute('data-pin'));
          if (error) { if (w.toast) w.toast(error.message, 'danger'); return; }
          if (w.toast) w.toast(b.getAttribute('data-pinned') ? 'Unpinned' : '📌 Pinned to the top of the blog', 'success');
          self._adminList(root);
        };
      });
    },

    init() {
      if (d.getElementById('blog-root')) this.mountList();
      if (d.getElementById('blog-post-root')) this.mountPost();
      if (d.getElementById('blog-admin-root')) this.mountAdmin();
    }
  };

  
  d.head.insertAdjacentHTML('beforeend', '<style>' +
    '.blog-body p { margin-bottom: 1.8em; }' +
    '.blog-body h2 { font-family: var(--font); font-size: 2rem; margin: 2em 0 1em; font-weight: 800; letter-spacing: -0.01em; color: #0f172a; }' +
    '.blog-body h3 { font-family: var(--font); font-size: 1.5rem; margin: 1.5em 0 0.8em; font-weight: 700; color: #1e293b; }' +
    '.blog-body h4 { font-family: var(--font); font-size: 1.2rem; margin: 1.2em 0 0.6em; font-weight: 700; color: #334155; }' +
    '.blog-body ul, .blog-body ol { margin-bottom: 1.8em; padding-left: 1.5em; }' +
    '.blog-body li { margin-bottom: 0.8em; }' +
    '.blog-body blockquote { font-style: italic; border-left: 4px solid var(--primary); padding-left: 20px; margin: 2em 0; color: #475569; font-size: 1.4rem; }' +
    '.blog-body a { color: var(--primary); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }' +
  '</style>');

  w.Blog = Blog;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { Blog.init(); });
  else Blog.init();
})(window, document);
