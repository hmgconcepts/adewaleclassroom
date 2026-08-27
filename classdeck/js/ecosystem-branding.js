/* ===================================================================
   HMG ECOSYSTEM BRANDING — Lead Generation Engine
   ---------------------------------------------------------------
   Embeds the full HMG Concepts ecosystem (Academy, Technologies,
   Media, Gospel) into every page of the ClassDeck so visitors
   know who built it and how to reach us. This powers lead gen.
   
   Also embeds the ecosystem footer on client-generated decks
   so every client site is a backlink generator for HMG.
   =================================================================== */
"use strict";

const HMGEcosystem = {
  brand: {
    name: "HMG Concepts",
    fullName: "HMG Concepts",
    meaning: "His Marvellous Grace",
    tagline: "Learning Deliberately. Teaching Authentically.",
    founded: 2015,
    founder: "Adewale Samson Adeagbo",
    founderTitle: "AI-Augmented Solutions Developer · Data Scientist · STEM Educator",
    location: "Lagos, Nigeria",
    whatsapp: "https://wa.me/2348100866322",
    youtube: "https://youtube.com/@hmgconcepts",
    github: "https://github.com/hmgconcepts",
    channel: "https://whatsapp.com/channel/0029Vb7kGoN2ER6feTzs8q2f"
  },

  subsidiaries: [
    {
      name: "HMG Academy",
      tagline: "Virtual Tutors, Home Schooling, Exam Prep & LMS",
      url: "https://hmgacademy.pages.dev",
      description: "A full-service strictly virtual learning institution covering Nursery through Tertiary with vetted tutors, LMS platforms, exam prep and parent monitoring.",
      services: ["Virtual Tutoring", "Home Schooling", "WAEC/NECO/JAMB Prep", "LMS Platforms", "Parent Monitoring", "School Partnerships"]
    },
    {
      name: "HMG Technologies",
      tagline: "AI-Augmented Tools for Nigerian Businesses & Organisations",
      url: "https://hmgtechnologies.pages.dev",
      description: "The innovation arm — AI-augmented tools, CBT systems, data dashboards, ML models, and simulators built for Nigerian schools, businesses, NGOs and churches.",
      services: ["CBT Systems", "Data Dashboards", "AI-Augmented Web Apps", "ML Models", "Data Simulators", "Digital Skills Training"]
    },
    {
      name: "HMG Media",
      tagline: "Content, Storytelling & Brand Visibility",
      url: "https://hmgmedia.pages.dev",
      description: "Purpose-led audio, visual and audiovisual media that turns meaningful work into stories people understand and remember.",
      services: ["Educational Video", "Brand Storytelling", "Social Content", "Graphics & Visibility", "Content Strategy"]
    },
    {
      name: "HMG Gospel",
      tagline: "Christ-Centred Digital Outreach & Faith Communication",
      url: "https://hmggospel.pages.dev",
      description: "The faith arm — Christ-centred digital outreach, dramavangelism, techvangelism, podcasts, teachings and ebooks for real people and communities.",
      services: ["Dramavangelism", "Techvangelism", "Podcasts & Teachings", "Ebooks", "Church Support"]
    }
  ],

  stats: {
    projectsDeployed: 34,
    yearsTeaching: 15,
    studentsReached: 366,
    lmsPlatforms: 12,
    mlModels: 7,
    dataSimulators: 11,
    industriesServed: 7
  },

  /* Return a ready-to-use ecosystem footer HTML block */
  getFooterHTML: function(compact = false) {
    if (compact) {
      return `
<div style="margin-top:20px;padding:14px;border-top:1px solid rgba(255,255,255,.12);font-size:11.5px;color:#9aa3cf;text-align:center;line-height:1.7">
  <b style="color:#ffb347">HMG ACADEMY CLASS DECK</b> — Part of the 
  <a href="https://hmgconcepts.pages.dev" target="_blank" rel="noopener" style="color:#4f6ef7;text-decoration:none">HMG Concepts Ecosystem</a>
  <br/>
  <span style="font-size:11px">
    <a href="https://hmgacademy.pages.dev" target="_blank" rel="noopener" style="color:#8fa3d0;text-decoration:none">Academy</a> · 
    <a href="https://hmgtechnologies.pages.dev" target="_blank" rel="noopener" style="color:#8fa3d0;text-decoration:none">Technologies</a> · 
    <a href="https://hmgmedia.pages.dev" target="_blank" rel="noopener" style="color:#8fa3d0;text-decoration:none">Media</a> · 
    <a href="https://hmggospel.pages.dev" target="_blank" rel="noopener" style="color:#8fa3d0;text-decoration:none">Gospel</a>
    <br/>
    Built by <b>${this.brand.founder}</b> · <a href="${this.brand.whatsapp}" target="_blank" rel="noopener" style="color:#8fa3d0;text-decoration:none">WhatsApp</a> · 
    <a href="${this.brand.youtube}" target="_blank" rel="noopener" style="color:#8fa3d0;text-decoration:none">YouTube @hmgconcepts</a>
  </span>
</div>`;
    }
    return `
<div style="margin-top:30px;padding:20px 16px;border-top:2px solid var(--line);background:var(--bg-2);border-radius:14px;font-size:12.5px;color:var(--text-dim);line-height:1.8">
  <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:center;margin-bottom:14px">
    <b style="font-size:15px;color:var(--accent);flex:1">✦ HMG CONCEPTS ECOSYSTEM</b>
    <span style="font-size:11px;color:var(--text-dim)">${this.brand.meaning} · Est. ${this.brand.founded}</span>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">
    ${this.subsidiaries.map(s => `
      <div style="background:var(--bg-3);border:1px solid var(--line);border-radius:10px;padding:10px">
        <b style="color:#4f6ef7;font-size:12.5px">${s.name}</b>
        <div style="font-size:10.5px;color:var(--text-dim);margin:3px 0">${s.tagline}</div>
        <a href="${s.url}" target="_blank" rel="noopener" style="font-size:10.5px;color:var(--accent);text-decoration:none">Visit →</a>
      </div>
    `).join('')}
  </div>
  <div style="margin-top:10px;font-size:11px;color:var(--text-dim);text-align:center">
    <b>${this.brand.founder}</b> — ${this.brand.founderTitle} — ${this.brand.location}
    <br/>
    ${this.stats.projectsDeployed}+ Projects Deployed · ${this.stats.yearsTeaching}+ Years Teaching · ${this.stats.studentsReached}+ Students Reached
    <br/>
    <a href="${this.brand.whatsapp}" target="_blank" rel="noopener" style="color:#4f6ef7;text-decoration:none">💬 WhatsApp</a> · 
    <a href="${this.brand.youtube}" target="_blank" rel="noopener" style="color:#4f6ef7;text-decoration:none">📺 YouTube</a> · 
    <a href="${this.brand.github}" target="_blank" rel="noopener" style="color:#4f6ef7;text-decoration:none">🐙 GitHub</a> · 
    <a href="${this.brand.channel}" target="_blank" rel="noopener" style="color:#4f6ef7;text-decoration:none">📢 WhatsApp Channel</a>
  </div>
</div>`;
  },

  /* Injects the ecosystem footer into any page that has a specific container */
  injectFooter: function(containerId, compact = false) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = this.getFooterHTML(compact);
  },

  /* Structured data for SEO (injected into <head> on generated decks) */
  getStructuredData: function() {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": "https://hmgconcepts.pages.dev/#organization",
          "name": "HMG Concepts",
          "alternateName": "His Marvellous Grace Concepts",
          "url": "https://hmgconcepts.pages.dev/",
          "founder": {
            "@type": "Person",
            "name": "Adewale Samson Adeagbo",
            "jobTitle": "AI-Augmented Solutions Developer, Data Scientist, STEM Educator",
            "url": "https://cssadewale.pages.dev/"
          },
          "sameAs": [
            "https://hmgacademy.pages.dev/",
            "https://hmgtechnologies.pages.dev/",
            "https://hmgmedia.pages.dev/",
            "https://hmggospel.pages.dev/",
            "https://youtube.com/@hmgconcepts",
            "https://github.com/hmgconcepts"
          ]
        },
        {
          "@type": "SoftwareApplication",
          "name": document.title || "HMG ACADEMY CLASS DECK",
          "applicationCategory": "EducationalApplication",
          "operatingSystem": "Web, Android, iOS, Windows, macOS, Linux",
          "description": "Tablet-first virtual classroom and split-screen teaching studio with WebRTC live classroom, whiteboard, PDFs, quizzes, captions and no-OBS tablet social live relay workflow.",
          "creator": { "@id": "https://hmgconcepts.pages.dev/#organization" },
          "publisher": { "@id": "https://hmgconcepts.pages.dev/#organization" },
          "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
        }
      ]
    };
  },

  /* Inject the ecosystem chatbot widget (floating WhatsApp + info) */
  injectChatWidget: function() {
    if (document.getElementById("hmgEcosystemWidget")) return;
    const w = document.createElement("div");
    w.id = "hmgEcosystemWidget";
    w.innerHTML = `
<div id="hmgEcoFab" style="position:fixed;bottom:20px;right:20px;z-index:9998;display:flex;flex-direction:column;align-items:flex-end;gap:8px">
  <div id="hmgEcoPanel" style="display:none;background:var(--panel,#1b2147);border:1px solid var(--line,#2e3768);border-radius:16px;padding:16px;max-width:280px;box-shadow:0 10px 40px rgba(0,0,0,.5);font-size:12.5px;color:var(--text,#eef1ff);line-height:1.6">
    <b style="color:var(--accent,#ffb347);display:block;margin-bottom:6px">✦ HMG Concepts Ecosystem</b>
    <div style="margin-bottom:8px">Built by <b>Adewale Samson Adeagbo</b> — Lagos, Nigeria</div>
    <div style="display:flex;flex-direction:column;gap:4px">
      <a href="https://hmgconcepts.pages.dev" target="_blank" rel="noopener" style="color:#4f6ef7;text-decoration:none">🌐 HMG Concepts</a>
      <a href="https://hmgacademy.pages.dev" target="_blank" rel="noopener" style="color:#4f6ef7;text-decoration:none">🎓 HMG Academy</a>
      <a href="https://hmgtechnologies.pages.dev" target="_blank" rel="noopener" style="color:#4f6ef7;text-decoration:none">💻 HMG Technologies</a>
      <a href="https://hmgmedia.pages.dev" target="_blank" rel="noopener" style="color:#4f6ef7;text-decoration:none">📺 HMG Media</a>
      <a href="https://hmggospel.pages.dev" target="_blank" rel="noopener" style="color:#4f6ef7;text-decoration:none">✝️ HMG Gospel</a>
    </div>
    <div style="margin-top:8px;font-size:11px;color:var(--text-dim,#9aa3cf)">
      <a href="https://wa.me/2348100866322" target="_blank" rel="noopener" style="color:#2ecc71;text-decoration:none">💬 WhatsApp</a> · 
      <a href="https://youtube.com/@hmgconcepts" target="_blank" rel="noopener" style="color:#ff5d5d;text-decoration:none">📺 YouTube</a>
    </div>
  </div>
  <button id="hmgEcoToggle" style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#1e2a78,#4f6ef7);border:none;color:#fff;font-size:22px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center">✦</button>
</div>`;
    document.body.appendChild(w);
    document.getElementById("hmgEcoToggle").addEventListener("click", function() {
      const p = document.getElementById("hmgEcoPanel");
      p.style.display = p.style.display === "none" ? "block" : "none";
    });
  },

  /* SEO meta injection into head */
  injectMetaTags: function() {
    const meta = [
      { name: "author", content: this.brand.founder + ", HMG Concepts" },
      { name: "keywords", content: "HMG Concepts, HMG Academy, HMG Technologies, HMG Media, HMG Gospel, Adewale Samson Adeagbo, online teaching platform Nigeria, virtual classroom, tablet teaching app, WebRTC classroom, no OBS tablet live streaming, Lagos Nigeria EdTech" }
    ];
    meta.forEach(m => {
      if (!document.querySelector(`meta[name="${m.name}"]`)) {
        const el = document.createElement("meta");
        el.name = m.name;
        el.content = m.content;
        document.head.appendChild(el);
      }
    });
    /* JSON-LD */
    if (!document.querySelector('script[type="application/ld+json"][data-hmg]')) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.dataset.hmg = "1";
      script.textContent = JSON.stringify(this.getStructuredData());
      document.head.appendChild(script);
    }
  }
};

/* Auto-init on every page — inject ecosystem branding into ecosystem container and head */
(function ecoInit() {
  try {
    HMGEcosystem.injectMetaTags();
    HMGEcosystem.injectChatWidget();
    /* Try to fill an ecosystem container if one exists */
    HMGEcosystem.injectFooter("hmgEcosystemFooter", false);
    HMGEcosystem.injectFooter("hmgEcosystemFooterCompact", true);
  } catch (e) { /* non-critical */ }
})();

window.HMGEcosystem = HMGEcosystem;