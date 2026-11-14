import fs from 'node:fs'
import path from 'node:path'
const files = []
function walk(dir) { for (const name of fs.readdirSync(dir)) { const file = path.join(dir, name); const stat = fs.statSync(file); if (stat.isDirectory() && !['node_modules', 'dist', 'target'].includes(name)) walk(file); else if (/\.(tsx|jsx)$/.test(name)) files.push(file) } }
walk(path.join(process.cwd(), 'src'))
const failures = []
for (const file of files) { const source = fs.readFileSync(file, 'utf8'); for (const image of source.matchAll(/<img\b([^>]*)>/g)) if (!/\balt=/.test(image[1])) failures.push(`${file}: image without alt`) }
if (failures.length) { console.error(failures.join('\n')); process.exit(1) }
console.log(`Accessibility static gate passed for ${files.length} TSX/JSX files.`)
