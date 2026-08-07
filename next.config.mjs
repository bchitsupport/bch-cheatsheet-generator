/** @type {import('next').NextConfig} */
const nextConfig = {
  // These packages ship native/binary assets and must not be bundled by Turbopack
  // or webpack — they have to be `require`d from node_modules at runtime.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core', 'pdf-parse'],

  // `next dev` and `next build` both write chunks into the output directory. If
  // they share one, running a build while the dev server is up replaces the
  // chunks the browser already has and the running app dies with
  // "Cannot find module './873.js'". Giving dev its own directory makes that
  // impossible. `next build` and `next start` run with NODE_ENV=production, so
  // Vercel still gets a normal `.next`.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
};

export default nextConfig;
