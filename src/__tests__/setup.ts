import { homedir, tmpdir } from 'os';
import { mkdtempSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

// Test isolation for the audit log.
//
// Several tests spawn the real hook/CLI binaries (via execFileSync, which
// inherits process.env) or call homedir() in-process. The hook writes its
// audit log to `<homedir>/.claude/warden-audit.jsonl` by default, so deny-path
// tests like `shutdown -h now` appended a real entry to the developer's live
// audit log on every run. Redirecting HOME to a throwaway sandbox keeps all of
// that inside the temp dir and out of the real ~/.claude.
const realHome = process.env.HOME || homedir();
const sandboxHome = mkdtempSync(join(tmpdir(), 'warden-test-home-'));
mkdirSync(join(sandboxHome, '.claude'), { recursive: true });

process.env.WARDEN_REAL_HOME = realHome; // stashed for the audit-leak guard test
process.env.HOME = sandboxHome;
process.env.USERPROFILE = sandboxHome; // Windows

process.on('exit', () => {
  try {
    rmSync(sandboxHome, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});
