/* Link-only media. Never upload files into Supabase. Preview Drive / YouTube / images. */
const Media = {
  driveId(url) {
    const s = String(url || '');
    const m = s.match(/\/d\/([a-zA-Z0-9_-]+)/) || s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    return m ? m[1] : '';
  },
  driveView(url) {
    const id = this.driveId(url);
    return id ? 'https://drive.google.com/uc?export=view&id=' + id : url;
  },
  driveThumb(url) {
    const id = this.driveId(url);
    return id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w640' : '';
  },
  youtubeId(url) {
    const s = String(url || '');
    const m = s.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([a-zA-Z0-9_-]{6,})/);
    return m ? m[1] : '';
  },
  youtubeThumb(url) {
    const id = this.youtubeId(url);
    return id ? 'https://img.youtube.com/vi/' + id + '/hqdefault.jpg' : '';
  },
  youtubeEmbed(url) {
    const id = this.youtubeId(url);
    return id ? 'https://www.youtube.com/embed/' + id : '';
  },
  kind(url) {
    const u = String(url || '').toLowerCase();
    if (this.youtubeId(url)) return 'youtube';
    if (this.driveId(url)) return 'drive';
    if (/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u)) return 'image';
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) return 'video';
    if (/\.(mp3|wav)(\?|$)/i.test(u)) return 'audio';
    if (/\.pdf(\?|$)/i.test(u)) return 'pdf';
    return 'link';
  },
  card(url, title) {
    if (!url) return '';
    const k = this.kind(url);
    const t = TC.esc(title || url);
    const href = TC.esc(url);
    if (k === 'youtube') {
      return `<figure class="media-card"><a href="${href}" target="_blank" rel="noopener">
        <img src="${this.youtubeThumb(url)}" alt="${t}" style="width:100%;border-radius:12px">
        <figcaption>▶ ${t}</figcaption></a>
        <iframe src="${this.youtubeEmbed(url)}" title="${t}" loading="lazy" allowfullscreen
          style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px;margin-top:8px"></iframe></figure>`;
    }
    if (k === 'drive' || k === 'image') {
      const src = k === 'drive' ? this.driveView(url) : url;
      return `<figure class="media-card"><a href="${href}" target="_blank" rel="noopener">
        <img src="${TC.esc(src)}" alt="${t}" style="max-width:100%;border-radius:12px"
          onerror="this.onerror=null;this.src='${this.driveThumb(url) || src}'">
        <figcaption>${t}</figcaption></a></figure>`;
    }
    if (k === 'video') return `<video controls src="${href}" style="max-width:100%;border-radius:12px"></video>`;
    if (k === 'audio') return `<audio controls src="${href}"></audio>`;
    if (k === 'pdf') return `<p><a class="btn btn-ghost" href="${href}" target="_blank" rel="noopener">Open PDF — ${t}</a></p>`;
    return `<p><a href="${href}" target="_blank" rel="noopener">${t}</a></p>`;
  },
  hydrate(root) {
    (root || document).querySelectorAll('[data-media-url]').forEach(el => {
      el.innerHTML = this.card(el.getAttribute('data-media-url'), el.getAttribute('data-media-title'));
    });
  }
};
window.Media = Media;
document.addEventListener('DOMContentLoaded', () => Media.hydrate());
