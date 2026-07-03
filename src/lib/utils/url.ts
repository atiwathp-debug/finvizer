/** Builds an absolute app URL honoring the Vite `base` path (needed for GitHub Pages project sites). */
export function buildAppUrl(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${window.location.origin}${base}${path}`
}
