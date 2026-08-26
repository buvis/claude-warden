import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { parseCommand } from '../parser';
import { evaluate } from '../evaluator';
import { DEFAULT_CONFIG } from '../defaults';
import {
  allowedRoots, writeTargets, writeScopeBreach, writeScopeState, breachReason, DISARM_LINE,
} from '../write-scope';
import type { WardenConfig } from '../types';

/**
 * Autopilot write-scope fence, Bash half (PRD 00145). Mirrors
 * ~/.claude/hooks/tests/test_enforce_write_scope.py: a fixture repo holding
 * dev/local/autopilot, a fixture TMPDIR, and a fixture HOME so the root floor
 * and `~` expansion are under test control. Out-of-scope fixtures sit beside
 * the repo, never under it or under a temp root.
 */
const HOOK_BIN = resolve(__dirname, '../../dist/index.cjs');
const REAL_TMP = realpathSync('/tmp');

let base: string;
let repo: string;
let tmp: string;
let home: string;
let outside: string;

beforeEach(() => {
  base = realpathSync(mkdtempSync(join(tmpdir(), 'warden-write-scope-')));
  repo = join(base, 'repo');
  mkdirSync(join(repo, 'dev', 'local', 'autopilot'), { recursive: true });
  mkdirSync(join(repo, 'src'));
  tmp = join(base, 'tmproot');
  mkdirSync(tmp);
  home = join(base, 'home');
  mkdirSync(home);
  outside = join(base, 'other-repo');
  mkdirSync(outside);
  vi.stubEnv('HOME', home);
  vi.stubEnv('TMPDIR', tmp);
  vi.stubEnv('CLAUDE_UNATTENDED', '1');
  vi.stubEnv('_AUTOPILOT_WRITE_SCOPE', '');
  vi.stubEnv('_AUTOPILOT_WRITE_SCOPE_EXTRA', '');
  vi.stubEnv('WARDEN_YOLO', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(base, { recursive: true, force: true });
});

function defaultRoots(): string[] {
  return [repo, join(repo, 'dev', 'local'), tmp, REAL_TMP];
}

/** Default config plus an allowlist for every write command, so an in-scope
 *  write resolves to a plain `allow` and an out-of-scope one proves the fence
 *  outranks alwaysAllow. */
function config(): WardenConfig {
  const c = structuredClone(DEFAULT_CONFIG);
  c.layers[0].alwaysAllow.push(
    'echo', 'printf', 'sed', 'cp', 'mv', 'tee', 'mkdir', 'touch', 'rm', 'ln',
    'install', 'dd', 'rg', 'cat', 'cd', 'timeout', 'env', 'command', 'nohup', 'nice',
  );
  return c;
}

function judge(command: string, cwd: string = repo) {
  return evaluate(parseCommand(command), config(), 0, cwd);
}

function redirectsOf(command: string): (string[] | undefined)[] {
  return parseCommand(command).commands.map(c => c.writeRedirects);
}

const targetsOf = (command: string) => parseCommand(command).commands.flatMap(writeTargets);

describe('parser: writing redirects surface on the command', () => {
  it('collects >, >>, >|, &>, &>> and <> targets', () => {
    expect(redirectsOf('echo x > /a/out')).toEqual([['/a/out']]);
    expect(redirectsOf('echo x >> /a/out')).toEqual([['/a/out']]);
    expect(redirectsOf('echo x >| /a/out')).toEqual([['/a/out']]);
    expect(redirectsOf('cmd &> /a/out')).toEqual([['/a/out']]);
    expect(redirectsOf('cmd &>> /a/out')).toEqual([['/a/out']]);
    expect(redirectsOf('cmd <> /a/rw')).toEqual([['/a/rw']]);
  });

  it('keeps fd-numbered file redirects and drops fd duplications', () => {
    expect(redirectsOf('cmd 2> /a/err')).toEqual([['/a/err']]);
    expect(redirectsOf('cmd > /a/out 2>&1')).toEqual([['/a/out']]);
    expect(redirectsOf('cmd 2>&1')).toEqual([undefined]);
    expect(redirectsOf('cmd >&-')).toEqual([undefined]);
    expect(redirectsOf('cmd < /a/in')).toEqual([undefined]);
    expect(redirectsOf('cmd <<< text')).toEqual([undefined]);
  });

  it('emits a synthetic command for a bare redirect with no command name', () => {
    expect(targetsOf('> /a/out')).toEqual(['/a/out']);
    expect(targetsOf('>> /a/out')).toEqual(['/a/out']);
    expect(targetsOf('2> /a/err')).toEqual(['/a/err']);
  });

  it('stamps a compound statement redirect on every inner command', () => {
    expect(redirectsOf('{ echo a; echo b; } > /a/out')).toEqual([['/a/out'], ['/a/out']]);
    expect(redirectsOf('for f in x; do echo $f; done >> /a/out')).toEqual([['/a/out']]);
  });

  it('follows shell -c wrappers and script invocations', () => {
    expect(redirectsOf('bash -c "echo x > /a/out"')).toEqual([['/a/out']]);
    expect(redirectsOf('bash script.sh > /a/out')).toEqual([['/a/out']]);
  });

  it('sees a redirect on each side of a pipe and chain', () => {
    expect(redirectsOf('cat in | tee /a/one > /a/two')).toEqual([undefined, ['/a/two']]);
    expect(redirectsOf('echo a > /a/one && echo b > /a/two')).toEqual([['/a/one'], ['/a/two']]);
  });
});

describe('allowedRoots: the shared root contract', () => {
  it('is repo, repo/dev/local, TMPDIR, /tmp for a cwd inside the repo', () => {
    mkdirSync(join(repo, 'sub', 'deeper'), { recursive: true });
    expect(allowedRoots(join(repo, 'sub', 'deeper'))).toEqual(defaultRoots());
    expect(allowedRoots(repo)).toEqual(defaultRoots());
  });

  it('uses cwd itself when no ancestor carries dev/local/autopilot', () => {
    const plain = join(base, 'plain');
    mkdirSync(plain);
    expect(allowedRoots(plain)).toEqual([plain, join(plain, 'dev', 'local'), tmp, REAL_TMP]);
  });

  it('walks past a decoy dev/local without autopilot/ inside', () => {
    const sub = join(repo, 'sub');
    mkdirSync(join(sub, 'dev', 'local'), { recursive: true });
    expect(allowedRoots(sub)).toEqual(defaultRoots());
  });

  it('stops the walk below $HOME', () => {
    mkdirSync(join(home, 'dev', 'local', 'autopilot'), { recursive: true });
    const proj = join(home, 'proj');
    mkdirSync(proj);
    expect(allowedRoots(proj)[0]).toBe(proj);
  });

  it('drops $HOME and its ancestors, keeps a descendant', () => {
    vi.stubEnv('TMPDIR', '');
    expect(allowedRoots(home)).toEqual([join(home, 'dev', 'local'), REAL_TMP]);
    vi.stubEnv('_AUTOPILOT_WRITE_SCOPE_EXTRA', `${home}:${base}:/`);
    expect(allowedRoots(repo)).toEqual([repo, join(repo, 'dev', 'local'), REAL_TMP]);
  });

  it('widens through _AUTOPILOT_WRITE_SCOPE_EXTRA with ~ expansion and dedupes', () => {
    mkdirSync(join(home, 'extra-one'));
    const two = join(base, 'extra-two');
    mkdirSync(two);
    vi.stubEnv('_AUTOPILOT_WRITE_SCOPE_EXTRA', `~/extra-one:${two}:${two}:${repo}`);
    expect(allowedRoots(repo)).toEqual([...defaultRoots(), join(home, 'extra-one'), two]);
  });

  it('realpaths a symlinked dev/local to its target', () => {
    const symrepo = join(base, 'symrepo');
    const external = join(base, 'claude-dev');
    mkdirSync(join(external, 'autopilot'), { recursive: true });
    mkdirSync(join(symrepo, 'dev'), { recursive: true });
    symlinkSync(external, join(symrepo, 'dev', 'local'));
    expect(allowedRoots(symrepo)).toEqual([symrepo, external, tmp, REAL_TMP]);
  });
});

describe('writeTargets: the covered write vectors', () => {
  it('every positional of tee/mkdir/touch/rm/rmdir/mv/ln', () => {
    expect(targetsOf('tee -a /a/one /a/two')).toEqual(['/a/one', '/a/two']);
    expect(targetsOf('mkdir -p /a/one /a/two')).toEqual(['/a/one', '/a/two']);
    expect(targetsOf('touch /a/one')).toEqual(['/a/one']);
    expect(targetsOf('rm -rf /a/one')).toEqual(['/a/one']);
    expect(targetsOf('rmdir /a/one')).toEqual(['/a/one']);
    // mv removes its source, so both source and destination are write targets.
    expect(targetsOf('mv /src/a /dst/b')).toEqual(['/src/a', '/dst/b']);
    // ln can point a fresh in-scope link at an out-of-scope target, so both operands count.
    expect(targetsOf('ln -sf /src/a /dst/link')).toEqual(['/src/a', '/dst/link']);
  });

  it('honours -- so a dash-leading filename is still a target', () => {
    expect(targetsOf('rm -rf -- -weird')).toEqual(['-weird']);
    expect(targetsOf('touch -- -f')).toEqual(['-f']);
  });

  it('skips value-consuming flags: touch -r/-d/-t reference and stamp args', () => {
    expect(targetsOf('touch -r /etc/hosts src/in-scope')).toEqual(['src/in-scope']);
    expect(targetsOf('touch -d "2026-01-01" src/in-scope')).toEqual(['src/in-scope']);
    expect(targetsOf('touch -t 202601010000 src/in-scope')).toEqual(['src/in-scope']);
  });

  it('the destination of cp/install', () => {
    expect(targetsOf('cp -r /src/a /dst/b')).toEqual(['/dst/b']);
    expect(targetsOf('cp -t /dst /src/a /src/b')).toEqual(['/dst']);
    expect(targetsOf('cp --target-directory=/dst /src/a')).toEqual(['/dst']);
    expect(targetsOf('install -m 755 /src/a /dst/a')).toEqual(['/dst/a']);
    expect(targetsOf('install -d /dst/one /dst/two')).toEqual(['/dst/one', '/dst/two']);
  });

  it('the files of sed -i, never the script, in BSD/GNU/attached/empty forms', () => {
    expect(targetsOf("sed -i '' 's/a/b/' /a/f.py")).toEqual(['/a/f.py']);
    expect(targetsOf("sed -i.bak -e 's/a/b/' /a/one /a/two")).toEqual(['/a/one', '/a/two']);
    expect(targetsOf("sed -i -e 's/a/b/' -e 's/c/d/' /a/f.py")).toEqual(['/a/f.py']);
    expect(targetsOf("sed --in-place --expression='s/a/b/' /a/f.py")).toEqual(['/a/f.py']);
    // Empty-script bypass: `-i '' '' file` must not mistake the file for the script.
    expect(targetsOf("sed -i '' '' /a/f.py")).toEqual(['/a/f.py']);
    // Attached short -eSCRIPT must not swallow the file target.
    expect(targetsOf("sed -i '' -es/a/b/ /a/f.py")).toEqual(['/a/f.py']);
    expect(targetsOf("sed -n '1,$p' /a/f.py")).toEqual([]);
  });

  it('dd of= and redirects on any command', () => {
    expect(targetsOf('dd if=/dev/zero of=/a/blob bs=1m count=1')).toEqual(['/a/blob']);
    expect(targetsOf('rg foo /etc/hosts > /a/out')).toEqual(['/a/out']);
    expect(targetsOf('rg foo /etc/hosts')).toEqual([]);
  });

  it('peels transparent wrappers before classifying the real writer', () => {
    expect(targetsOf('timeout 5 cp a /dst/b')).toEqual(['/dst/b']);
    expect(targetsOf('env FOO=bar cp a /dst/b')).toEqual(['/dst/b']);
    expect(targetsOf('env -i cp a /dst/b')).toEqual(['/dst/b']);
    expect(targetsOf('command cp a /dst/b')).toEqual(['/dst/b']);
    expect(targetsOf('nohup tee /dst/b')).toEqual(['/dst/b']);
    expect(targetsOf('nice -n 10 rm -rf /dst/b')).toEqual(['/dst/b']);
    expect(targetsOf('timeout 5 echo x > /dst/b')).toEqual(['/dst/b']); // redirect survives
  });
});

describe('evaluate(): armed fence denies out-of-scope writes', () => {
  it('denies each covered vector, naming the resolved path', () => {
    const target = join(outside, 'file.py');
    const commands = [
      `echo x > ${target}`,
      `printf 'x' >> ${target}`,
      `> ${target}`,
      `tee ${target}`,
      `cp src/foo.py ${target}`,
      `mv src/foo.py ${target}`,
      `mv ${target} src/foo.py`, // source removal
      `ln -s ${target} src/link`, // link points out of scope
      `sed -i '' 's/a/b/' ${target}`,
      `install -m 644 src/foo.py ${target}`,
      `dd if=/dev/zero of=${target} count=1`,
      `mkdir -p ${outside}/new`,
      `touch ${target}`,
      `rm -f ${target}`,
      `cat src/foo.py | tee ${target}`,
      `bash -c "echo x > ${target}"`,
      `{ echo a; echo b; } > ${target}`,
      `timeout 5 cp src/foo.py ${target}`,
      `env FOO=1 cp src/foo.py ${target}`,
    ];
    for (const command of commands) {
      const result = judge(command);
      expect(result.decision, command).toBe('deny');
      expect(result.reason, command).toContain('BLOCKED: autopilot write-scope fence:');
      expect(result.reason, command).toContain(outside);
    }
  });

  it('tracks cd across &&, ;, newline and ~ so a relative write cannot re-anchor', () => {
    for (const sep of ['&&', ';', '\n']) {
      const command = `cd ${outside} ${sep} echo x > file.py`;
      expect(judge(command).decision, command).toBe('deny');
    }
    expect(judge('cd ~/vault && echo x >> inbox.md').decision).toBe('deny');
    // relative cd that climbs out of every root, then a relative write
    expect(judge('cd ../../other-repo && echo x > escape.md', join(repo, 'src')).decision).toBe('deny');
    // A cd it cannot follow makes every later relative write fail closed.
    expect(judge('cd - && echo x > f.md').reason).toContain('cannot resolve');
    expect(judge('cd $UNSET && echo x > f.md').reason).toContain('cannot resolve');
  });

  it('resolves a relative escape and a symlinked escape before matching', () => {
    expect(judge("sed -i '' s/a/b/ ../other-repo/file.py").reason).toContain(join(outside, 'file.py'));
    symlinkSync(outside, join(repo, 'escape'));
    expect(judge('echo x > escape/file.py').reason).toContain(join(outside, 'file.py'));
  });

  it('follows a dangling leaf symlink that points out of scope', () => {
    // realpathSync would throw on the dangling link; the lenient realpath must
    // still resolve it to the out-of-scope target rather than the in-scope name.
    symlinkSync(join(outside, 'newfile'), join(repo, 'dangling'));
    expect(judge('echo x > dangling').reason).toContain(join(outside, 'newfile'));
  });

  it('expands ~ against $HOME (out of scope) and fails closed on ~user', () => {
    expect(judge('echo x > ~/notes/x.md').reason).toContain(join(home, 'notes', 'x.md'));
    expect(judge('echo x > ~root/pwned').reason).toContain('cannot resolve');
  });

  it('uses in-command variable assignments, not the hook environment', () => {
    // TMPDIR is an allowed root in the environment; a chain-local reassignment
    // to an out-of-scope dir must be what the target resolves against.
    const c = `TMPDIR=${outside} ; echo x > $TMPDIR/f`;
    expect(judge(c).decision).toBe('deny');
    expect(judge(c).reason).toContain(outside);
  });

  it('fails closed on unresolvable or non-plain expansions', () => {
    expect(judge('echo x > $UNSET_OUTPUT_DIR/x.txt').reason).toContain('cannot resolve');
    expect(judge('echo x > "$(mktemp -d)/x.txt"').reason).toContain('cannot resolve');
    expect(judge('OUT=x ; echo x > ${OUT:-/etc/passwd}').reason).toContain('cannot resolve');
  });
});

describe('evaluate(): armed fence allows in-scope writes and reads', () => {
  it('allows writes inside the session scope', () => {
    const commands = [
      'echo x > dev/local/tmp/x.txt',
      `echo x > ${join(repo, 'dev', 'local', 'autopilot', 'state.json')}`,
      "sed -i '' 's/a/b/' src/foo.py",
      `cp src/foo.py ${join(tmp, 'copy.py')}`,
      `mv src/foo.py ${join(repo, 'src', 'bar.py')}`,
      'tee dev/local/tmp/out.txt',
      `mkdir -p ${join(REAL_TMP, 'review-00145')}`,
      'rm -f dev/local/tmp/x.txt',
      'echo x > $TMPDIR/x.txt',
      'rg foo src 2>/dev/null > dev/local/tmp/hits.txt',
      'cd dev/local && echo x > tmp/y.txt',
      'touch -r src/foo.py dev/local/tmp/z.txt',
    ];
    for (const command of commands) {
      expect(judge(command).decision, command).toBe('allow');
    }
  });

  it('leaves reads outside the scope alone', () => {
    for (const command of ['rg foo /etc/hosts', 'cat /etc/hosts', `cat ${join(outside, 'file.py')}`]) {
      expect(judge(command).decision, command).toBe('allow');
    }
  });

  it('outranks alwaysAllow but the in-scope write resolves to a plain ok', () => {
    expect(judge(`echo x > ${join(outside, 'x.txt')}`).decision).toBe('deny');
    expect(judge('echo x > dev/local/tmp/x.txt').reason).toBe('ok');
  });

  it('carries the deny reason in the hook wording, byte for byte with the Python fence', () => {
    const target = join(outside, 'x.txt');
    expect(judge(`echo x > ${target}`).reason).toBe(breachReason(target, defaultRoots()));
  });

  it('denies a subshell-bearing out-of-scope redirect instead of asking', () => {
    // The fence runs before the subshell early-return, so deny wins over ask.
    expect(judge(`echo "$(date)" > ${join(outside, 'x.txt')}`).decision).toBe('deny');
  });
});

describe('evaluate(): three-state arming', () => {
  const escape = () => `echo x > ${join(outside, 'x.txt')}`;

  it('is inert without the marker', () => {
    vi.stubEnv('CLAUDE_UNATTENDED', '');
    expect(judge(escape()).decision).toBe('allow');
    vi.stubEnv('CLAUDE_UNATTENDED', 'true');
    expect(judge(escape()).decision).toBe('allow');
    expect(writeScopeState(repo)).toEqual({ armed: false, disarmed: false });
  });

  it('is inert, and says so, under the kill switch', () => {
    vi.stubEnv('_AUTOPILOT_WRITE_SCOPE', 'off');
    expect(judge(escape()).decision).toBe('allow');
    expect(writeScopeState(repo)).toEqual({ armed: false, disarmed: true });
  });

  it('stays armed unless the kill switch is exactly off', () => {
    for (const value of ['on', '1', '']) {
      vi.stubEnv('_AUTOPILOT_WRITE_SCOPE', value);
      expect(judge(escape()).decision, `kill switch=${value}`).toBe('deny');
    }
  });

  it('refuses every write when the floor empties the root list', () => {
    const cmd = parseCommand(`echo x > ${join(repo, 'x.txt')}`).commands;
    expect(writeScopeBreach(cmd, [], repo)).toContain('no usable write scope');
    expect(writeScopeBreach(parseCommand('rg foo src').commands, [], repo)).toBeNull();
  });
});

describe('hook binary end to end', () => {
  function runHook(command: string, extraEnv: Record<string, string>) {
    const input = JSON.stringify({
      session_id: 'test-write-scope',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_input: { command },
      cwd: repo,
      permission_mode: 'auto',
    });
    const env = {
      ...process.env,
      HOME: home, USERPROFILE: home, TMPDIR: tmp, WARDEN_YOLO: '',
      _AUTOPILOT_WRITE_SCOPE: '', _AUTOPILOT_WRITE_SCOPE_EXTRA: '',
      ...extraEnv,
    };
    const proc = spawnSync(process.execPath, [HOOK_BIN], {
      input, env, encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout = proc.stdout ?? '';
    const decision = JSON.parse(stdout || '{}')?.hookSpecificOutput?.permissionDecision as string;
    return { decision, exitCode: proc.status ?? 1, stderr: proc.stderr ?? '', stdout };
  }

  it('denies an out-of-scope redirect with exit 2 and the resolved path on stderr', () => {
    const target = join(outside, 'x.txt');
    const r = runHook(`echo x > ${target}`, { CLAUDE_UNATTENDED: '1' });
    expect(r.decision).toBe('deny');
    expect(r.exitCode).toBe(2);
    expect(r.stderr).toContain('BLOCKED: autopilot write-scope fence:');
    expect(r.stderr).toContain(target);
  });

  it('allows the in-scope write and stays silent', () => {
    const r = runHook('echo x > dev/local/tmp/x.txt', { CLAUDE_UNATTENDED: '1' });
    expect(r.decision).toBe('allow');
    expect(r.stderr).toBe('');
  });

  it('the fence outranks WARDEN_YOLO and bypassPermissions', () => {
    const target = join(outside, 'x.txt');
    const yolo = runHook(`echo x > ${target}`, { CLAUDE_UNATTENDED: '1', WARDEN_YOLO: '1' });
    expect(yolo.decision).toBe('deny');
    expect(yolo.exitCode).toBe(2);
    const input = JSON.stringify({
      session_id: 's', hook_event_name: 'PreToolUse', tool_name: 'Bash',
      tool_input: { command: `echo x > ${target}` }, cwd: repo, permission_mode: 'bypassPermissions',
    });
    const proc = spawnSync(process.execPath, [HOOK_BIN], {
      input, encoding: 'utf-8', timeout: 5000, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, HOME: home, TMPDIR: tmp, WARDEN_YOLO: '', _AUTOPILOT_WRITE_SCOPE: '', CLAUDE_UNATTENDED: '1' },
    });
    expect(proc.status).toBe(2);
    expect(proc.stderr ?? '').toContain('BLOCKED: autopilot write-scope fence:');
  });

  it('allows and emits the disarm line under the kill switch', () => {
    const r = runHook(`echo x > ${join(outside, 'x.txt')}`, {
      CLAUDE_UNATTENDED: '1', _AUTOPILOT_WRITE_SCOPE: 'off',
    });
    expect(r.decision).toBe('allow');
    expect(r.stderr).toBe(`${DISARM_LINE}\n`);
  });

  it('is invisible without the marker', () => {
    const r = runHook(`echo x > ${join(outside, 'x.txt')}`, { CLAUDE_UNATTENDED: '' });
    expect(r.decision).toBe('allow');
    expect(r.stderr).toBe('');
  });

  it('still judges an in-scope find -exec writer against the session scope', () => {
    writeFileSync(join(repo, 'src', 'a.py'), 'x');
    const r = runHook(`find src -name '*.py' -exec touch ${join(outside, 'f')} \\;`, { CLAUDE_UNATTENDED: '1' });
    expect(r.decision).toBe('deny'); // the static -exec touch target is out of scope
  });
});
