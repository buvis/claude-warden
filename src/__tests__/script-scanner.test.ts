import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { scanScriptCode, readScriptFile } from '../script-scanner';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// ─── scanScriptCode: Python ───

describe('scanScriptCode (python)', () => {
  const scan = (code: string) => scanScriptCode(code, 'python');

  // Dangerous
  it('detects os.system()', () => {
    const r = scan('os.system("ls")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
    expect(r!.reason).toContain('os.system');
  });

  it('detects os.popen()', () => {
    const r = scan('os.popen("ls")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects os.execvp()', () => {
    const r = scan('os.execvp("/bin/sh", [])');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects subprocess', () => {
    const r = scan('import subprocess\nsubprocess.run(["ls"])');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
    expect(r!.reason).toContain('subprocess');
  });

  it('detects shutil.rmtree()', () => {
    const r = scan('shutil.rmtree("/tmp/dir")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects __import__()', () => {
    const r = scan('__import__("os")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects builtin exec()', () => {
    const r = scan('exec(code)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('allows method .exec() (not builtin)', () => {
    const r = scan('result.exec()');
    expect(r).toBeNull();
  });

  it('detects builtin eval()', () => {
    const r = scan('eval(expression)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('allows method .eval() (not builtin)', () => {
    const r = scan('obj.eval()');
    expect(r).toBeNull();
  });

  it('allows re.compile()', () => {
    const r = scan('re.compile(r"pattern")');
    expect(r).toBeNull();
  });

  it('detects bare compile()', () => {
    const r = scan('compile(source, "filename", "exec")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects ctypes', () => {
    const r = scan('import ctypes');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects pickle.loads()', () => {
    const r = scan('pickle.loads(data)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects pickle.load()', () => {
    const r = scan('pickle.load(f)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects pickle.Unpickler', () => {
    const r = scan('pickle.Unpickler(f)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  // Cautious
  it('detects open() with write mode', () => {
    const r = scan("open('file.txt', 'w')");
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('allows open() with read mode', () => {
    const r = scan("open('file.txt', 'r')");
    expect(r).toBeNull();
  });

  it('allows open() with no explicit mode (defaults to read)', () => {
    const r = scan("open('file.txt')");
    expect(r).toBeNull();
  });

  it('detects Path.write_text()', () => {
    const r = scan('Path("f").write_text(data)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects Path.write_bytes()', () => {
    const r = scan('Path("f").write_bytes(data)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects requests.post()', () => {
    const r = scan('requests.post(url, data=data)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects requests.put()', () => {
    const r = scan('requests.put(url, data=data)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects requests.delete()', () => {
    const r = scan('requests.delete(url)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects urllib.request', () => {
    const r = scan('import urllib.request');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects os.remove()', () => {
    const r = scan('os.remove("file")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects os.unlink()', () => {
    const r = scan('os.unlink("file")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects os.rename()', () => {
    const r = scan('os.rename("a", "b")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  // Safe
  it('returns null for safe code', () => {
    expect(scan('print("hello")')).toBeNull();
    expect(scan('import json\njson.loads(data)')).toBeNull();
    expect(scan('x = 1 + 2')).toBeNull();
  });

  // Priority: dangerous wins over cautious
  it('returns dangerous when both dangerous and cautious patterns match', () => {
    const r = scan('import subprocess\nopen("f", "w")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });
});

// ─── scanScriptCode: TypeScript/JavaScript ───

describe('scanScriptCode (typescript)', () => {
  const scan = (code: string) => scanScriptCode(code, 'typescript');

  // Dangerous
  it('detects require("child_process")', () => {
    const r = scan('const cp = require("child_process")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
    expect(r!.reason).toContain('child_process');
  });

  it('detects import from child_process', () => {
    const r = scan('import { exec } from "child_process"');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects execSync()', () => {
    const r = scan('execSync("ls")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects spawnSync()', () => {
    const r = scan('spawnSync("ls", ["-la"])');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects fs.rmSync with recursive', () => {
    const r = scan('fs.rmSync(dir, { recursive: true })');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects fs.rmdirSync with recursive', () => {
    const r = scan('fs.rmdirSync(dir, { recursive: true })');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects eval()', () => {
    const r = scan('eval(code)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('allows method .eval()', () => {
    const r = scan('obj.eval()');
    expect(r).toBeNull();
  });

  it('detects new Function()', () => {
    const r = scan('const fn = new Function("return 1")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects process.exit()', () => {
    const r = scan('process.exit(1)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects rimraf', () => {
    const r = scan('import rimraf from "rimraf"');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  // Cautious
  it('detects fs.writeFileSync()', () => {
    const r = scan('fs.writeFileSync("f", data)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects fs.writeFile()', () => {
    const r = scan('fs.writeFile("f", data, cb)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects fs.appendFile()', () => {
    const r = scan('fs.appendFile("f", data, cb)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects fs.unlinkSync()', () => {
    const r = scan('fs.unlinkSync("f")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects fs.unlink()', () => {
    const r = scan('fs.unlink("f", cb)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects fs.renameSync()', () => {
    const r = scan('fs.renameSync("a", "b")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects fetch with POST', () => {
    const r = scan('fetch(url, { method: "POST", body: data })');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects fetch with DELETE', () => {
    const r = scan("fetch(url, { method: 'DELETE' })");
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects http.request()', () => {
    const r = scan('http.request(options, cb)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects https.request()', () => {
    const r = scan('https.request(options, cb)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  // Safe
  it('returns null for safe code', () => {
    expect(scan('console.log("hello")')).toBeNull();
    expect(scan('const x = 1 + 2')).toBeNull();
    expect(scan('fs.readFileSync("f")')).toBeNull();
  });
});

// ─── scanScriptCode: Perl ───

describe('scanScriptCode (perl)', () => {
  const scan = (code: string) => scanScriptCode(code, 'perl');

  // Dangerous
  it('detects system()', () => {
    const r = scan('system("ls")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
    expect(r!.reason).toContain('system');
  });

  it('detects exec()', () => {
    const r = scan('exec("/bin/sh")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects backtick execution', () => {
    const r = scan('my $out = `ls -la`');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects qx{}', () => {
    const r = scan('my $out = qx{ls}');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects qx()', () => {
    const r = scan('my $out = qx(ls)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects unlink', () => {
    const r = scan('unlink @files');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  it('detects string eval', () => {
    const r = scan('eval "$code"');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
    expect(r!.reason).toContain('string eval');
  });

  it('allows block eval (exception handling)', () => {
    const r = scan('eval { do_something() }');
    expect(r).toBeNull();
  });

  it('detects require with variable', () => {
    const r = scan('require $module');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('dangerous');
  });

  // Cautious
  it('detects open() with write mode >', () => {
    const r = scan('open(FH, ">", "file.txt")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects open() with append mode >>', () => {
    const r = scan('open(my $fh, ">>", "log.txt")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects IO::Socket', () => {
    const r = scan('use IO::Socket::INET');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects LWP::UserAgent', () => {
    const r = scan('my $ua = LWP::UserAgent->new');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects HTTP::Request', () => {
    const r = scan('my $req = HTTP::Request->new(POST => $url)');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects rename()', () => {
    const r = scan('rename("old", "new")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects rmdir()', () => {
    const r = scan('rmdir("dir")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  it('detects File::Path::remove_tree', () => {
    const r = scan('File::Path::remove_tree("dir")');
    expect(r).not.toBeNull();
    expect(r!.level).toBe('cautious');
  });

  // Safe
  it('returns null for safe code', () => {
    expect(scan('print "hello\\n"')).toBeNull();
    expect(scan('my $x = 1 + 2')).toBeNull();
    expect(scan('use strict')).toBeNull();
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
