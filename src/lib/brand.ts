// Central brand configuration for the remixed app.
// Update these values once and the changes propagate across the UI, manifest, and HTML metadata.

export const brand = {
  // Full legal/organizational name
  organization: "BFP MIMAROPA",

  // Short product/system name
  shortName: "FSIMS",

  // Full application name shown in headers, titles, and SEO
  appName: "Fire Safety Inspection Monitoring System",

  // Tagline or one-line description
  tagline: "Fire Safety Inspection Monitoring",

  // Region or jurisdiction (leave empty if not applicable)
  region: "MIMAROPA Region",

  // Copyright / footer line
  footer: "Fire Safety Inspection Monitoring",

  // Theme colors (also update index.html and manifest.webmanifest manually)
  themeColor: "#B91C1C",
  backgroundColor: "#0F172A",

  // Logo asset paths
  logo: "/src/assets/bfp-mimaropa.png",
  favicon: "/bfpmimaropa.ico",

  // Contact / support channel shown in access-denied and error pages
  supportContact: "your system administrator",
} as const;
