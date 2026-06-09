import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { scanScriptCode, readScriptFile } from '../script-scanner';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ─── Contract tests ───

describe('scanScriptCode contract', () => {
  it('always returns an object with verdict and reason, never null/undefined', () => {
    const dangerous = scanScriptCode('os.system("ls")', 'python');
    expect(dangerous).not.toBeNull();
    expect(dangerous).not.toBeUndefined();
    expect(typeof dangerous.verdict).toBe('string');
    expect(typeof dangerous.reason).toBe('string');
    expect(dangerous.reason.length).toBeGreaterThan(0);
    expect(dangerous.verdict).toBe('dangerous');

    const cautious = scanScriptCode("open('file.txt', 'w')", 'python');
    expect(cautious).not.toBeNull();
    expect(cautious).not.toBeUndefined();
    expect(typeof cautious.verdict).toBe('string');
    expect(typeof cautious.reason).toBe('string');
    expect(cautious.reason.length).toBeGreaterThan(0);
    expect(cautious.verdict).toBe('cautious');

    const unknown = scanScriptCode('result.exec()', 'python');
    expect(unknown).not.toBeNull();
    expect(unknown).not.toBeUndefined();
    expect(typeof unknown.verdict).toBe('string');
    expect(typeof unknown.reason).toBe('string');
    expect(unknown.reason.length).toBeGreaterThan(0);
    expect(unknown.verdict).toBe('unknown');
  });

  it('benign python code returns safe', () => {
    expect(scanScriptCode('print("hello")', 'python').verdict).toBe('safe');
    expect(scanScriptCode('x = 1 + 2', 'python').verdict).toBe('safe');
  });

  it('benign typescript code returns safe', () => {
    expect(scanScriptCode('console.log("hello")', 'typescript').verdict).toBe('safe');
    expect(scanScriptCode('const x = 1 + 2', 'typescript').verdict).toBe('safe');
  });

  it('benign perl code returns safe', () => {
    expect(scanScriptCode('my $x = 1 + 2', 'perl').verdict).toBe('safe');
  });

  it('reason is non-empty for every verdict tier', () => {
    const tiers = [
      scanScriptCode('os.system("ls")', 'python'),
      scanScriptCode("open('file.txt', 'w')", 'python'),
      scanScriptCode('print("hello")', 'python'),
    ];
    for (const r of tiers) {
      expect(r.reason.length).toBeGreaterThan(0);
    }
  });
});

// ─── scanScriptCode: Python ───

describe('scanScriptCode (python)', () => {
  const scan = (code: string) => scanScriptCode(code, 'python');

  // Dangerous
  it('detects os.system()', () => {
    const r = scan('os.system("ls")');
    expect(r.verdict).toBe('dangerous');
    expect(r.reason).toContain('os.system');
  });

  it('detects os.popen()', () => {
    const r = scan('os.popen("ls")');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects os.execvp()', () => {
    const r = scan('os.execvp("/bin/sh", [])');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects subprocess', () => {
    const r = scan('import subprocess\nsubprocess.run(["ls"])');
    expect(r.verdict).toBe('dangerous');
    expect(r.reason).toContain('subprocess');
  });

  it('detects shutil.rmtree()', () => {
    const r = scan('shutil.rmtree("/tmp/dir")');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects __import__()', () => {
    const r = scan('__import__("os")');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects builtin exec()', () => {
    const r = scan('exec(code)');
    expect(r.verdict).toBe('dangerous');
  });

  it('allows method .exec() (not builtin)', () => {
    const r = scan('result.exec()');
    expect(r.verdict).toBe('unknown');
  });

  it('detects builtin eval()', () => {
    const r = scan('eval(expression)');
    expect(r.verdict).toBe('dangerous');
  });

  it('allows method .eval() (not builtin)', () => {
    const r = scan('obj.eval()');
    expect(r.verdict).toBe('unknown');
  });

  it('allows re.compile()', () => {
    const r = scan('re.compile(r"pattern")');
    expect(r.verdict).toBe('unknown');
  });

  it('detects bare compile()', () => {
    const r = scan('compile(source, "filename", "exec")');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects ctypes', () => {
    const r = scan('import ctypes');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects pickle.loads()', () => {
    const r = scan('pickle.loads(data)');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects pickle.load()', () => {
    const r = scan('pickle.load(f)');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects pickle.Unpickler', () => {
    const r = scan('pickle.Unpickler(f)');
    expect(r.verdict).toBe('dangerous');
  });

  // Cautious
  it('detects open() with write mode', () => {
    const r = scan("open('file.txt', 'w')");
    expect(r.verdict).toBe('cautious');
  });

  it('allows open() with read mode', () => {
    const r = scan("open('file.txt', 'r')");
    expect(r.verdict).toBe('safe');
  });

  it('allows open() with no explicit mode (defaults to read)', () => {
    const r = scan("open('file.txt')");
    expect(r.verdict).toBe('safe');
  });

  it('detects Path.write_text()', () => {
    const r = scan('Path("f").write_text(data)');
    expect(r.verdict).toBe('cautious');
  });

  it('detects Path.write_bytes()', () => {
    const r = scan('Path("f").write_bytes(data)');
    expect(r.verdict).toBe('cautious');
  });

  it('detects requests.post()', () => {
    const r = scan('requests.post(url, data=data)');
    expect(r.verdict).toBe('cautious');
  });

  it('detects requests.put()', () => {
    const r = scan('requests.put(url, data=data)');
    expect(r.verdict).toBe('cautious');
  });

  it('detects requests.delete()', () => {
    const r = scan('requests.delete(url)');
    expect(r.verdict).toBe('cautious');
  });

  it('detects urllib.request', () => {
    const r = scan('import urllib.request');
    expect(r.verdict).toBe('cautious');
  });

  it('detects os.remove()', () => {
    const r = scan('os.remove("file")');
    expect(r.verdict).toBe('cautious');
  });

  it('detects os.unlink()', () => {
    const r = scan('os.unlink("file")');
    expect(r.verdict).toBe('cautious');
  });

  it('detects os.rename()', () => {
    const r = scan('os.rename("a", "b")');
    expect(r.verdict).toBe('cautious');
  });

  it('detects pathlib unlink', () => {
    const r = scan("from pathlib import Path; Path('/x').unlink()");
    expect(r.verdict).toBe('cautious');
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it('detects pathlib rmdir', () => {
    const r = scan("Path('/x').rmdir()");
    expect(r.verdict).toBe('cautious');
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it('detects importlib as dangerous', () => {
    const r = scan("import importlib; importlib.import_module('os')");
    expect(r.verdict).toBe('dangerous');
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it('detects os.replace() as cautious', () => {
    const r = scan("os.replace('a', 'b')");
    expect(r.verdict).toBe('cautious');
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it('detects shutil.move() as cautious', () => {
    const r = scan("import shutil; shutil.move('a', 'b')");
    expect(r.verdict).toBe('cautious');
    expect(r.reason.length).toBeGreaterThan(0);
  });

  // Word-boundary negative tests: substring matches that must NOT fire
  it('does not flag identifier containing importlib as a substring', () => {
    expect(scan('importlibrary = 1').verdict).toBe('safe');
  });

  it('does not flag os.replace on a receiver whose name ends in "os"', () => {
    expect(scan("cos.replace_thing('a')").verdict).toBe('unknown');
  });

  it('does not flag shutil.move on a receiver whose name ends in "shutil"', () => {
    expect(scan("myshutil.move_along('a')").verdict).toBe('unknown');
  });

  // Safe shape
  it('returns safe for recognized-benign code', () => {
    expect(scan('print("hello")').verdict).toBe('safe');
    expect(scan('import json\njson.loads(data)').verdict).toBe('safe');
    expect(scan('x = 1 + 2').verdict).toBe('safe');
  });

  // Priority: dangerous wins over cautious
  it('returns dangerous when both dangerous and cautious patterns match', () => {
    const r = scan('import subprocess\nopen("f", "w")');
    expect(r.verdict).toBe('dangerous');
  });
});

// ─── scanScriptCode: TypeScript/JavaScript ───

describe('scanScriptCode (typescript)', () => {
  const scan = (code: string) => scanScriptCode(code, 'typescript');

  // Dangerous
  it('detects require("child_process")', () => {
    const r = scan('const cp = require("child_process")');
    expect(r.verdict).toBe('dangerous');
    expect(r.reason).toContain('child_process');
  });

  it('detects import from child_process', () => {
    const r = scan('import { exec } from "child_process"');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects execSync()', () => {
    const r = scan('execSync("ls")');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects spawnSync()', () => {
    const r = scan('spawnSync("ls", ["-la"])');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects fs.rmSync with recursive', () => {
    const r = scan('fs.rmSync(dir, { recursive: true })');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects fs.rmdirSync with recursive', () => {
    const r = scan('fs.rmdirSync(dir, { recursive: true })');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects eval()', () => {
    const r = scan('eval(code)');
    expect(r.verdict).toBe('dangerous');
  });

  it('allows method .eval()', () => {
    const r = scan('obj.eval()');
    expect(r.verdict).toBe('unknown');
  });

  it('detects new Function()', () => {
    const r = scan('const fn = new Function("return 1")');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects process.exit()', () => {
    const r = scan('process.exit(1)');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects rimraf', () => {
    const r = scan('import rimraf from "rimraf"');
    expect(r.verdict).toBe('dangerous');
  });

  // Cautious
  it('detects fs.writeFileSync()', () => {
    const r = scan('fs.writeFileSync("f", data)');
    expect(r.verdict).toBe('cautious');
  });

  it('detects fs.writeFile()', () => {
    const r = scan('fs.writeFile("f", data, cb)');
    expect(r.verdict).toBe('cautious');
  });

  it('detects fs.appendFile()', () => {
    const r = scan('fs.appendFile("f", data, cb)');
    expect(r.verdict).toBe('cautious');
  });

  it('detects fs.unlinkSync()', () => {
    const r = scan('fs.unlinkSync("f")');
    expect(r.verdict).toBe('cautious');
  });

  it('detects fs.unlink()', () => {
    const r = scan('fs.unlink("f", cb)');
    expect(r.verdict).toBe('cautious');
  });

  it('detects fs.renameSync()', () => {
    const r = scan('fs.renameSync("a", "b")');
    expect(r.verdict).toBe('cautious');
  });

  it('detects fetch with POST', () => {
    const r = scan('fetch(url, { method: "POST", body: data })');
    expect(r.verdict).toBe('cautious');
  });

  it('detects fetch with DELETE', () => {
    const r = scan("fetch(url, { method: 'DELETE' })");
    expect(r.verdict).toBe('cautious');
  });

  it('detects http.request()', () => {
    const r = scan('http.request(options, cb)');
    expect(r.verdict).toBe('cautious');
  });

  it('detects https.request()', () => {
    const r = scan('https.request(options, cb)');
    expect(r.verdict).toBe('cautious');
  });

  it('detects fs.rmSync without recursive option as cautious', () => {
    const r = scan("fs.rmSync('x')");
    expect(r.verdict).toBe('cautious');
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it('detects fs.rmdirSync without recursive option as cautious', () => {
    const r = scan("fs.rmdirSync('x')");
    expect(r.verdict).toBe('cautious');
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it('detects fs.rm() as cautious', () => {
    const r = scan('fs.rm("x", cb)');
    expect(r.verdict).toBe('cautious');
    expect(r.reason.length).toBeGreaterThan(0);
  });

  // Regression guards: recursive variants must stay dangerous
  it('regression: fs.rmSync with recursive stays dangerous', () => {
    const r = scan('fs.rmSync(dir, { recursive: true })');
    expect(r.verdict).toBe('dangerous');
  });

  it('regression: fs.rmdirSync with recursive stays dangerous', () => {
    const r = scan('fs.rmdirSync(dir, { recursive: true })');
    expect(r.verdict).toBe('dangerous');
  });

  // Safe shape
  it('returns safe for recognized-benign code', () => {
    expect(scan('console.log("hello")').verdict).toBe('safe');
    expect(scan('const x = 1 + 2').verdict).toBe('safe');
    expect(scan('fs.readFileSync("f")').verdict).toBe('safe');
  });
});

// ─── scanScriptCode: Perl ───

describe('scanScriptCode (perl)', () => {
  const scan = (code: string) => scanScriptCode(code, 'perl');

  // Dangerous
  it('detects system()', () => {
    const r = scan('system("ls")');
    expect(r.verdict).toBe('dangerous');
    expect(r.reason).toContain('system');
  });

  it('detects exec()', () => {
    const r = scan('exec("/bin/sh")');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects backtick execution', () => {
    const r = scan('my $out = `ls -la`');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects qx{}', () => {
    const r = scan('my $out = qx{ls}');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects qx()', () => {
    const r = scan('my $out = qx(ls)');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects unlink', () => {
    const r = scan('unlink @files');
    expect(r.verdict).toBe('dangerous');
  });

  it('detects string eval', () => {
    const r = scan('eval "$code"');
    expect(r.verdict).toBe('dangerous');
    expect(r.reason).toContain('string eval');
  });

  it('allows block eval (exception handling)', () => {
    const r = scan('eval { do_something() }');
    expect(r.verdict).toBe('unknown');
  });

  it('detects require with variable', () => {
    const r = scan('require $module');
    expect(r.verdict).toBe('dangerous');
  });

  // Cautious
  it('detects open() with write mode >', () => {
    const r = scan('open(FH, ">", "file.txt")');
    expect(r.verdict).toBe('cautious');
  });

  it('detects open() with append mode >>', () => {
    const r = scan('open(my $fh, ">>", "log.txt")');
    expect(r.verdict).toBe('cautious');
  });

  it('detects IO::Socket', () => {
    const r = scan('use IO::Socket::INET');
    expect(r.verdict).toBe('cautious');
  });

  it('detects LWP::UserAgent', () => {
    const r = scan('my $ua = LWP::UserAgent->new');
    expect(r.verdict).toBe('cautious');
  });

  it('detects HTTP::Request', () => {
    const r = scan('my $req = HTTP::Request->new(POST => $url)');
    expect(r.verdict).toBe('cautious');
  });

  it('detects rename()', () => {
    const r = scan('rename("old", "new")');
    expect(r.verdict).toBe('cautious');
  });

  it('detects rmdir()', () => {
    const r = scan('rmdir("dir")');
    expect(r.verdict).toBe('cautious');
  });

  it('detects File::Path::remove_tree', () => {
    const r = scan('File::Path::remove_tree("dir")');
    expect(r.verdict).toBe('cautious');
  });

  // Safe shape
  it('returns safe for recognized-benign code', () => {
    expect(scan('print "hello\\n"').verdict).toBe('safe');
    expect(scan('my $x = 1 + 2').verdict).toBe('safe');
    expect(scan('use strict').verdict).toBe('safe');
  });
});

// ─── scanScriptCode evasion signals ───

describe('scanScriptCode evasion signals', () => {
  // Genuinely-new evasion signals → unknown with named reason

  it('python getattr dynamic dispatch returns unknown with getattr reason', () => {
    const r = scanScriptCode("getattr(os, 'sys' + 'tem')('id')", 'python');
    expect(r.verdict).toBe('unknown');
    expect(r.reason.toLowerCase()).toContain('getattr');
  });

  it('python chr-built string returns unknown with chr reason', () => {
    const r = scanScriptCode('name = chr(112) + chr(114) + chr(105)', 'python');
    expect(r.verdict).toBe('unknown');
    expect(r.reason.toLowerCase()).toContain('chr');
  });

  it('typescript globalThis bracket access returns unknown with globalThis reason', () => {
    const r = scanScriptCode("globalThis['fetch']('http://x')", 'typescript');
    expect(r.verdict).toBe('unknown');
    expect(r.reason.toLowerCase()).toContain('globalthis');
  });

  it('typescript require with variable argument returns unknown with require reason', () => {
    const r = scanScriptCode('const m = require(modName)', 'typescript');
    expect(r.verdict).toBe('unknown');
    expect(r.reason.toLowerCase()).toContain('require');
  });

  // Already-dangerous: existing patterns catch these before evasion check

  it('python exec(base64.b64decode()) is caught as dangerous, not unknown', () => {
    const r = scanScriptCode('exec(base64.b64decode(s))', 'python');
    expect(r.verdict).toBe('dangerous');
  });

  it('typescript eval(Buffer.from().toString()) is caught as dangerous, not unknown', () => {
    const r = scanScriptCode("eval(Buffer.from(x, 'base64').toString())", 'typescript');
    expect(r.verdict).toBe('dangerous');
  });

  it('typescript new Function() is caught as dangerous, not unknown', () => {
    const r = scanScriptCode("new Function('return 1')()", 'typescript');
    expect(r.verdict).toBe('dangerous');
  });

  // Negatives: must NOT trigger evasion detection

  it('python print("hello") returns safe, not an evasion signal', () => {
    const r = scanScriptCode('print("hello")', 'python');
    expect(r.verdict).toBe('safe');
  });

  it('typescript require with string literal is NOT the dynamic require evasion signal', () => {
    const r = scanScriptCode("const m = require('fs')", 'typescript');
    expect(r.verdict).toBe('unknown');
    expect(r.reason.toLowerCase()).not.toContain('getattr');
    expect(r.reason.toLowerCase()).not.toContain('chr');
    expect(r.reason.toLowerCase()).not.toContain('globalthis');
    expect(r.reason.toLowerCase()).not.toContain('require');
  });
});

// ─── scanScriptCode safe-shape ───

describe('scanScriptCode safe-shape', () => {
  // Positives: every statement is a recognized-benign construct → safe

  it('python print() is safe', () => {
    expect(scanScriptCode('print("hello")', 'python').verdict).toBe('safe');
  });

  it('python no-call assignment is safe', () => {
    expect(scanScriptCode('x = 1 + 2', 'python').verdict).toBe('safe');
  });

  it('python import + json.loads() is safe', () => {
    expect(scanScriptCode('import json\njson.loads(data)', 'python').verdict).toBe('safe');
  });

  it('python open() with read mode is safe', () => {
    expect(scanScriptCode("open('file.txt', 'r')", 'python').verdict).toBe('safe');
  });

  it('python open() with no explicit mode is safe', () => {
    expect(scanScriptCode("open('file.txt')", 'python').verdict).toBe('safe');
  });

  it('python open() with a variable mode is NOT safe (ambiguous read/write)', () => {
    expect(scanScriptCode('open(f, mode)', 'python').verdict).toBe('unknown');
  });

  it('typescript console.log() is safe', () => {
    expect(scanScriptCode('console.log("hello")', 'typescript').verdict).toBe('safe');
  });

  it('typescript no-call assignment is safe', () => {
    expect(scanScriptCode('const x = 1 + 2', 'typescript').verdict).toBe('safe');
  });

  it('typescript fs.readFileSync() is safe', () => {
    expect(scanScriptCode('fs.readFileSync("f")', 'typescript').verdict).toBe('safe');
  });

  it('perl print is safe', () => {
    expect(scanScriptCode('print "hello\\n"', 'perl').verdict).toBe('safe');
  });

  it('perl no-call assignment is safe', () => {
    expect(scanScriptCode('my $x = 1 + 2', 'perl').verdict).toBe('safe');
  });

  it('perl use statement is safe', () => {
    expect(scanScriptCode('use strict', 'perl').verdict).toBe('safe');
  });

  // Negatives: unrecognized construct → unknown (safe-shape never fires)

  it('python unrecognized method call is unknown', () => {
    expect(scanScriptCode('result.exec()', 'python').verdict).toBe('unknown');
  });

  it('python re.compile() is unknown', () => {
    expect(scanScriptCode('re.compile(r"pattern")', 'python').verdict).toBe('unknown');
  });

  it('typescript require() with string literal is unknown (not a recognized safe construct)', () => {
    expect(scanScriptCode("const m = require('fs')", 'typescript').verdict).toBe('unknown');
  });

  // Negatives: dangerous/cautious/evasion always wins over safe-shape

  it('python subprocess.run() is dangerous, not safe', () => {
    expect(scanScriptCode("subprocess.run(['ls'])", 'python').verdict).toBe('dangerous');
  });

  it('python open() with write mode is cautious, not safe', () => {
    expect(scanScriptCode("open('file.txt', 'w')", 'python').verdict).toBe('cautious');
  });

  it('python getattr() evasion is unknown, not safe', () => {
    expect(scanScriptCode("getattr(os, name)", 'python').verdict).toBe('unknown');
  });

  // Mixed: one unrecognized statement disqualifies the whole script

  it('python script with one unrecognized statement is unknown, not safe', () => {
    expect(scanScriptCode('print("hi")\nresult.exec()', 'python').verdict).toBe('unknown');
  });

  // Positive: multi-statement all-safe scripts

  it('multi-statement all-safe python script is safe (import, assignment, print)', () => {
    expect(scanScriptCode('import json\nx = 1\nprint(x)', 'python').verdict).toBe('safe');
  });

  it('multi-statement all-safe typescript script is safe (assignment, console.log)', () => {
    expect(scanScriptCode('const x = 1\nconsole.log(x)', 'typescript').verdict).toBe('safe');
  });

  // Negative: benign-looking but unrecognized constructs stay unknown

  it('unrecognized call Array.from is not safe', () => {
    expect(scanScriptCode('Array.from([1, 2, 3])', 'typescript').verdict).toBe('unknown');
  });

  it('attribute access without assignment is not safe', () => {
    expect(scanScriptCode('obj.attr.value', 'python').verdict).toBe('unknown');
  });

  it('del statement disqualifies script even when other statements are safe', () => {
    expect(scanScriptCode('print("ok")\ndel x', 'python').verdict).toBe('unknown');
  });
});

// ─── readScriptFile ───

describe('readScriptFile', () => {
  const tmpDir = join(tmpdir(), 'warden-test-' + Date.now());

  beforeAll(() => {
    mkdirSync(tmpDir, { recursive: true });
    writeFileSync(join(tmpDir, 'safe.py'), 'print("hello")');
    writeFileSync(join(tmpDir, 'large.py'), 'x'.repeat(1024 * 1024 + 1));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('reads a normal file', () => {
    const r = readScriptFile('safe.py', tmpDir);
    expect('content' in r).toBe(true);
    if ('content' in r) {
      expect(r.content).toBe('print("hello")');
    }
  });

  it('returns error for file not found', () => {
    const r = readScriptFile('nonexistent.py', tmpDir);
    expect('error' in r).toBe(true);
    if ('error' in r) {
      expect(r.error).toBe('script not found');
    }
  });

  it('returns error for file too large', () => {
    const r = readScriptFile('large.py', tmpDir);
    expect('error' in r).toBe(true);
    if ('error' in r) {
      expect(r.error).toBe('script too large to scan');
    }
  });

  it('resolves relative paths against cwd', () => {
    const r = readScriptFile('safe.py', tmpDir);
    expect('content' in r).toBe(true);
  });

  it('handles absolute paths', () => {
    const r = readScriptFile(join(tmpDir, 'safe.py'), '/');
    expect('content' in r).toBe(true);
  });
});
