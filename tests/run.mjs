import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import path from "node:path";
const d=path.dirname(fileURLToPath(import.meta.url));let bad=0;
for(const f of ["hub.test.mjs","router.test.mjs","match.test.mjs"]){
  const r=spawnSync(process.execPath,["--no-warnings",path.join(d,f)],{stdio:"inherit"});if(r.status)bad++;
}
process.exit(bad?1:0);
