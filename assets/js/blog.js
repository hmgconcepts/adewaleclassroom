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
  /* Light, safe markdown: escape first, then apply structural rules. */
  function md(t) {
    var s = esc(t || '');
    var paras = s.split(/\n{2,}/);
    return paras.map(function (p) {
      p = p.trim();
      if (!p) return '';
      if (/^#{1,3}\s/.test(p)) {
        var lvl = p.match(/^(#{1,3})\s/)[1].length;
        return '<h' + (lvl + 1) + '>' + p.replace(/^#{1,3}\s/, '') + '</h' + (lvl + 1) + '>';
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

  var Blog = {
    mountList() {
      var root = d.getElementById('blog-root');
      if (!root) return;
      var self = this;
      root.innerHTML =
        '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px">' +
          '<input id="blog-q" type="search" placeholder="🔎 Search posts…" style="flex:1;min-width:200px;padding:10px 14px;border:1px solid var(--gray-300,#e2e8f0);border-radius:12px;font:inherit">' +
          '<select id="blog-cat" style="padding:10px 12px;border:1px solid var(--gray-300,#e2e8f0);border-radius:12px;font:inherit"><option value="">All topics</option></select>' +
        '</div>' +
        '<div id="blog-list" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px"><p class="muted">Loading posts…</p></div>';
      var q = d.getElementById('blog-q');
      var cat = d.getElementById('blog-cat');
      var run = function () { self._loadList(q.value, cat.value, root); };
      q.addEventListener('input', run);
      cat.addEventListener('change', run);
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

    async _loadList(query, category, root) {
      var box = d.getElementById('blog-list');
      if (!box) return;
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
        if (!posts.length) {
          box.innerHTML = '<div class="card" style="grid-column:1/-1;padding:40px;text-align:center"><div style="font-size:2.4rem">📝</div><h3>Nothing here yet</h3><p class="muted">The studio has not published any posts yet — check back soon.</p></div>';
          return;
        }
        
        box.style.gridTemplateColumns = 'repeat(auto-fill, minmax(320px, 1fr))';
        box.style.gap = '24px';
        box.innerHTML = posts.map(function (p, i) {
          var isHero = (i === 0 && !query && !category);
          var cover = p.cover_url
            ? '<div style="height:'+(isHero?'280px':'200px')+'; background:#f1f5f9 center/cover no-repeat url(&quot;' + esc(p.cover_url) + '&quot;); transition: transform 0.4s ease;" class="blog-img"></div>'
            : '<div style="height:'+(isHero?'280px':'200px')+'; background:var(--gradient,linear-gradient(135deg,#0506ae,#964eec)); display:flex; align-items:center; justify-content:center; color:#fff; font-size:3rem; transition: transform 0.4s ease;" class="blog-img">📄</div>';
          
          return '<a class="card blog-card" style="text-decoration:none; color:inherit; overflow:hidden; display:flex; flex-direction:column; padding:0; border:none; box-shadow:0 10px 25px rgba(0,0,0,0.05); transition: box-shadow 0.3s ease; border-radius: 16px; ' + (isHero ? 'grid-column: 1 / -1; flex-direction: row; align-items: center;' : '') + '" href="blog-post.html?slug=' + encodeURIComponent(p.slug) + '" onmouseover="this.style.boxShadow=\'0 20px 40px rgba(0,0,0,0.1)\'; this.querySelector(\'.blog-img\').style.transform=\'scale(1.05)\';" onmouseout="this.style.boxShadow=\'0 10px 25px rgba(0,0,0,0.05)\'; this.querySelector(\'.blog-img\').style.transform=\'scale(1)\';">' +
            '<div style="overflow:hidden; '+(isHero?'width:50%; height:100%;':'')+'">' + cover + '</div>' +
            '<div style="padding:24px; display:flex; flex-direction:column; flex:1; '+(isHero?'width:50%;':'')+'">' +
              '<div style="font-size:.75rem; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--primary,#0506ae); margin-bottom: 8px;">' + esc(p.category || 'News') + ' · ' + fmt(p.published_at) + '</div>' +
              '<h3 style="margin:0 0 12px; line-height:1.35; font-size:'+(isHero?'2rem':'1.4rem')+'; font-weight:800; color:#0f172a;">' + esc(p.title) + '</h3>' +
              (p.excerpt ? '<p style="margin:0 0 16px; font-size:'+(isHero?'1.1rem':'0.95rem')+'; line-height:1.6; color:#475569; flex:1;">' + esc(p.excerpt) + '</p>' : '<div style="flex:1"></div>') +
              '<div style="font-size:.85rem; color:#64748b; font-weight: 500; display:flex; align-items:center; gap: 12px;">' +
                '<span style="background:#f1f5f9; padding:6px 12px; border-radius:999px;">✍️ ' + esc(p.author_name || 'The Studio') + '</span>' +
                '<span>👁 ' + (p.view_count || 0) + ' reads</span>' +
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
        
        var clapBtn = '<button id="btn-clap" style="background:none;border:none;cursor:pointer;font-size:1.4rem;display:flex;align-items:center;gap:8px;color:#475569;padding:10px 20px;border-radius:99px;background:#f1f5f9;transition:all 0.2s;font-family:var(--font);font-weight:600">👏 <span id="clap-count">' + (post.view_count || 0) + '</span></button>';
        
        var shareBtns = '<div style="display:flex;gap:12px;align-items:center;margin:20px 0;font-family:var(--font)">' +
          '<button onclick="navigator.clipboard.writeText(location.href);toast(\'Link copied!\',\'success\')" class="btn btn-sm btn-outline" style="border-radius:99px;padding:8px 16px;font-weight:600">🔗 Copy Link</button>' +
          '<a href="https://twitter.com/intent/tweet?url=' + encodeURIComponent(location.href) + '&text=' + encodeURIComponent(post.title) + '" target="_blank" class="btn btn-sm btn-outline" style="border-radius:99px;padding:8px 16px;font-weight:600">𝕏 Post</a>' +
          '<a href="https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(location.href) + '" target="_blank" class="btn btn-sm btn-outline" style="border-radius:99px;padding:8px 16px;font-weight:600">💼 Share</a>' +
          '</div>';

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
              (post.tags ? '<div style="display:flex;gap:8px;flex-wrap:wrap">' + String(post.tags).split(',').map(function (t) { return '<span style="background:#f8fafc;color:#475569;border-radius:8px;padding:6px 14px;font-size:.85rem;font-weight:700;border:1px solid #e2e8f0">#' + esc(t.trim()) + '</span>'; }).join('') + '</div>' : '<div></div>') +
              clapBtn +
            '</div>' +

            '<div style="max-width:720px;margin:60px auto;background:#f8fafc;border:1px solid #e2e8f0;border-radius:24px;padding:32px;display:flex;align-items:center;gap:24px;font-family:var(--font);box-shadow:0 10px 30px rgba(15,23,42,0.03)">' +
              '<div style="width:80px;height:80px;border-radius:50%;background:var(--gradient);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:2rem;flex-shrink:0">' + authorInitials + '</div>' +
              '<div>' +
                '<div style="font-size:.85rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#64748b;margin-bottom:6px">Written by</div>' +
                '<h3 style="margin:0 0 10px;font-size:1.6rem;color:#0f172a;font-weight:800">' + esc(post.author_name || 'The Studio') + '</h3>' +
                '<p style="margin:0;color:#475569;font-size:1.05rem;line-height:1.55">Tutor and contributor at ADEWALE CLASSROOM. Passionate about empowering learners through digital and hybrid education strategies.</p>' +
              '</div>' +
            '</div>' +
          '</article>';
          
        var cb = d.getElementById('btn-clap');
        if (cb) {
          cb.onclick = function() {
            var el = d.getElementById('clap-count');
            el.textContent = parseInt(el.textContent) + 1;
            cb.style.background = '#e0e7ff';
            cb.style.color = '#4338ca';
            if (w.sb && post.id) {
               w.sb.rpc('tc_blog_clap', { p_id: post.id }).catch(()=>{});
            }
          };
        }
      };};
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

    /* ---------------------- staff editor ---------------------- */
    mountAdmin() {
      var root = d.getElementById('blog-admin-root');
      if (!root) return;
      var self = this;
      root.innerHTML =
        '<div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:center;margin-bottom:14px">' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<button class="btn btn-primary" type="button" id="blog-new">＋ New post</button>' +
            '<button class="btn btn-outline" type="button" id="blog-refresh">↻ Refresh</button>' +
            '<a class="btn btn-outline" href="blog.html" target="_blank" rel="noopener">👁 View public blog</a>' +
          '</div>' +
          '<span class="muted" style="font-size:.82rem">Cover art and media are links only (Drive / web) — nothing is uploaded.</span>' +
        '</div>' +
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
      d.getElementById('blog-refresh').onclick = function () { self._adminList(root); };
      d.getElementById('blog-cat-add').onclick = function () { self._addCat(); };
      this._adminList(root);
      this._catList();
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
          '<div class="form-group"><label>Cover image (Drive / web link)</label><input class="form-input" id="blog-f-cover" value="' + (post ? esc(post.cover_url || '') : '') + '" placeholder="https://drive.google.com/…"></div>' +
          '<div class="form-group"><label>Tags (comma separated)</label><input class="form-input" id="blog-f-tags" value="' + (post ? esc(post.tags || '') : '') + '" placeholder="maths, igcse, exam-tips"></div>' +
          '<div class="form-group" style="grid-column:1/-1"><label>Excerpt (shown on the blog card)</label><input class="form-input" id="blog-f-excerpt" value="' + (post ? esc(post.excerpt || '') : '') + '"></div>' +
          '<div class="form-group" style="grid-column:1/-1"><label>Body * — paragraphs, ## headings, - lists, **bold**, [text](https://…)</label><textarea class="form-textarea" id="blog-f-body" rows="12" required>' + (post ? esc(post.body || '') : '') + '</textarea></div>' +
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
      var payload = {
        title: title,
        slug: slug,
        category_id: d.getElementById('blog-f-cat').value || null,
        status: status,
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
      if (status === 'published' && !(post && post.published_at)) payload.published_at = new Date().toISOString();
      if (post) payload.updated_at = new Date().toISOString();
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
            '<td><strong>' + esc(p.title) + '</strong><br><small class="muted">' + fmt(p.published_at || p.created_at) + '</small></td>' +
            '<td><span class="badge">' + (badge[p.status] || p.status) + '</span></td>' +
            '<td>' + esc(p.category || 'News') + '</td>' +
            '<td align="right">' + (p.view_count || 0) + '</td>' +
            '<td align="right" style="white-space:nowrap">' +
              '<button type="button" class="btn btn-sm btn-outline" data-edit="' + esc(p.id) + '">Edit</button> ' +
              (p.status === 'published' ? '<a href="blog-post.html?slug=' + encodeURIComponent(p.slug) + '" class="btn btn-sm btn-outline" target="_blank">View</a>' : '') +
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
    '.blog-body ul, .blog-body ol { margin-bottom: 1.8em; padding-left: 1.5em; }' +
    '.blog-body li { margin-bottom: 0.8em; }' +
    '.blog-body blockquote { font-style: italic; border-left: 4px solid var(--primary); padding-left: 20px; margin: 2em 0; color: #475569; font-size: 1.4rem; }' +
    '.blog-body a { color: var(--primary); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px; }' +
  '</style>');

  w.Blog = Blog;
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { Blog.init(); });
  else Blog.init();
})(window, document);
