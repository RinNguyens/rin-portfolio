// Publish the static build (dist/client) to the gh-pages branch as a single fresh commit.
import { execSync } from "node:child_process"
import { mkdtempSync, cpSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const sh = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit" })
const remote = execSync("git remote get-url origin").toString().trim()
const dir = mkdtempSync(join(tmpdir(), "pages-"))
cpSync("dist/client", dir, { recursive: true })
rmSync(join(dir, ".DS_Store"), { force: true })
sh("git init -q -b gh-pages", dir)
sh("git add -A", dir)
sh(`git commit -q -m "Deploy ${new Date().toISOString()}"`, dir)
sh(`git push -f ${remote} gh-pages`, dir)
rmSync(dir, { recursive: true, force: true })
console.log("Published to gh-pages")
