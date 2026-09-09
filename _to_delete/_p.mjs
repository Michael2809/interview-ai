import { parse } from 'espree'
import { readFileSync } from 'node:fs'
let bad=0
for (const f of process.argv.slice(2)) {
  try { parse(readFileSync(f,'utf8'),{ecmaVersion:'latest',sourceType:'module',ecmaFeatures:{jsx:true}}); console.log('OK   ',f) }
  catch(e){bad++;console.log('FAIL ',f,'->',e.message)}
}
process.exit(bad?1:0)
