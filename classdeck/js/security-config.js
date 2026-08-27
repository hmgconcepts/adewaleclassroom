/* HMG ClassDeck v3 security configuration.
   For strongest subscription enforcement, deploy security/license-gateway-worker
   and paste its HTTPS URL below. Leave empty for legacy offline/local licensing. */
window.HMG_SECURITY = {
  licenseGateway: "",        // e.g. "https://classdeck-license.yourname.workers.dev"
  licenseMode: "hybrid",     // "hybrid" = gateway when online, local fallback; "strict" = gateway required
  leaseMinutes: 30,
  heartbeatMinutes: 5,
  appName: "HMG ACADEMY CLASS DECK",
  supportWhatsApp: "https://wa.me/2348100866322"
};
