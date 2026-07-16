import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const projectRoot = resolve(import.meta.dirname, '..')
const sourceRoot = resolve(process.argv[2] || process.env.KOMARI_WEB_DIR || resolve(projectRoot, '..', 'komari-web'))
const sourceDist = resolve(sourceRoot, 'dist')
const targetDir = resolve(projectRoot, 'public', 'admin-app')
const overrideCss = resolve(projectRoot, 'scripts', 'assets', 'glass-admin.css')
const charsetMarker = '<meta charset="UTF-8" />'
const pwaManifestPattern = /<link[^>]+href="\/admin-app\/manifest\.webmanifest"[^>]*>/g
const pwaRegisterPattern = /<script[^>]+id="vite-plugin-pwa:register-sw"[^>]*><\/script>/g
const workboxFilenamePattern = /^workbox-[\w-]+\.js$/

if (!existsSync(resolve(sourceRoot, 'package.json')))
  throw new Error(`komari-web source not found: ${sourceRoot}`)

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
execFileSync(npmCommand, ['run', 'build', '--', '--base=/admin-app/'], {
  cwd: sourceRoot,
  stdio: 'inherit',
})

rmSync(targetDir, { recursive: true, force: true })
cpSync(sourceDist, targetDir, { recursive: true })

const indexPath = resolve(targetDir, 'index.html')
let html = readFileSync(indexPath, 'utf8')
if (!html.includes(charsetMarker))
  throw new Error('komari-web index.html no longer contains the expected charset marker')

const bridge = `<script>;(()=>{let t='';try{t=sessionStorage.getItem('komariOfficialAppRoute')||'';if(t)sessionStorage.removeItem('komariOfficialAppRoute')}catch(e){console.warn('[Glassmorphism] Session storage is unavailable.',e)}if(!t){try{t=new URL(location.href).searchParams.get('__komari_route')||''}catch{}}if(t&&/^\\/(admin|terminal|manage)(\\/|\\?|#|$)/.test(t))history.replaceState(null,'',t)})();</script><link rel="stylesheet" href="/admin-app/glass-admin.css">`
html = html.replace(charsetMarker, `${charsetMarker}${bridge}`)

// The official PWA only controls /admin-app/, while the bridge restores /admin and
// /terminal before React boots. Keeping that worker adds stale-cache risk without
// providing working offline navigation for the real routes.
html = html.replace(pwaManifestPattern, '').replace(pwaRegisterPattern, '')
for (const filename of ['manifest.webmanifest', 'registerSW.js', 'sw.js'])
  rmSync(resolve(targetDir, filename), { force: true })
for (const filename of readdirSync(targetDir).filter(filename => workboxFilenamePattern.test(filename)))
  rmSync(resolve(targetDir, filename), { force: true })

if (!html.includes('/admin-app/glass-admin.css') || !html.includes('/admin-app/assets/'))
  throw new Error('komari-web build output is missing the admin bridge stylesheet or /admin-app/ asset base')

writeFileSync(indexPath, html)
cpSync(overrideCss, resolve(targetDir, 'glass-admin.css'))

let commit = 'unknown'
try {
  commit = execFileSync('git', ['-c', `safe.directory=${sourceRoot}`, 'rev-parse', 'HEAD'], {
    cwd: sourceRoot,
    encoding: 'utf8',
  }).trim()
}
catch {}

writeFileSync(resolve(targetDir, 'komari-admin-source.json'), `${JSON.stringify({
  repository: 'https://github.com/komari-monitor/komari-web',
  commit,
  synced_at: new Date().toISOString(),
}, null, 2)}\n`)

console.log(`[sync-komari-admin] Synced complete admin app from ${sourceRoot}`)
