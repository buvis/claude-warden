import { readFileSync, statSync } from 'fs';
import { resolve, isAbsolute } from 'path';

export type ScanLevel = 'dangerous' | 'cautious';
export type Language = 'python' | 'typescript' | 'perl' | 'ruby' | 'php';
export type Verdict = 'dangerous' | 'cautious' | 'safe' | 'unknown';

interface ScanPattern {
  regex: RegExp;
  level: ScanLevel;
  reason: string;
}

// ─── Python patterns ───

const PYTHON_PATTERNS: ScanPattern[] = [
  // Dangerous
  { regex: /\bos\.system\s*\(/, level: 'dangerous', reason: 'os.system() executes shell commands' },
  { regex: /\bos\.popen\s*\(/, level: 'dangerous', reason: 'os.popen() executes shell commands' },
  { regex: /\bos\.exec[a-z]*\s*\(/, level: 'dangerous', reason: 'os.exec*() replaces the process' },
  { regex: /\bsubprocess\b/, level: 'dangerous', reason: 'subprocess can execute shell commands' },
  { regex: /\bshutil\.rmtree\s*\(/, level: 'dangerous', reason: 'shutil.rmtree() deletes directory trees' },
  { regex: /\b__import__\s*\(/, level: 'dangerous', reason: '__import__() loads arbitrary modules' },
  { regex: /(?<!\.\s*)(?<!\w)\bexec\s*\(/, level: 'dangerous', reason: 'exec() executes arbitrary code' },
  { regex: /(?<!\.\s*)(?<!\w)\beval\s*\(/, level: 'dangerous', reason: 'eval() evaluates arbitrary expressions' },
  { regex: /(?<!re\.)(?<!\w)\bcompile\s*\(/, level: 'dangerous', reason: 'compile() compiles arbitrary code' },
  { regex: /\bctypes\b/, level: 'dangerous', reason: 'ctypes allows calling C functions directly' },
  { regex: /\bpickle\.loads?\s*\(/, level: 'dangerous', reason: 'pickle deserialization can execute arbitrary code' },
  { regex: /\bpickle\.Unpickler\b/, level: 'dangerous', reason: 'pickle deserialization can execute arbitrary code' },
  { regex: /\bimportlib\b/, level: 'dangerous', reason: 'importlib loads arbitrary modules' },

  // Cautious
  { regex: /\bopen\s*\([^)]*['"][wax]/, level: 'cautious', reason: 'opens file for writing' },
  { regex: /\bPath\s*[\.(].*\.write_text\s*\(/, level: 'cautious', reason: 'writes to file via Path' },
  { regex: /\bPath\s*[\.(].*\.write_bytes\s*\(/, level: 'cautious', reason: 'writes to file via Path' },
  { regex: /\bsocket\b/, level: 'cautious', reason: 'uses network sockets' },
  { regex: /\brequests\.(post|put|delete)\s*\(/, level: 'cautious', reason: 'makes mutating HTTP request' },
  { regex: /\burllib\.request\b/, level: 'cautious', reason: 'makes HTTP requests' },
  { regex: /\bos\.(remove|unlink|rmdir|rename)\s*\(/, level: 'cautious', reason: 'modifies filesystem' },
  { regex: /\.unlink\s*\(/, level: 'cautious', reason: 'deletes a file' },
  { regex: /\.rmdir\s*\(/, level: 'cautious', reason: 'removes a directory' },
  { regex: /\bos\.replace\s*\(/, level: 'cautious', reason: 'renames/overwrites a file' },
  { regex: /\bshutil\.move\s*\(/, level: 'cautious', reason: 'moves a file' },
];

// ─── TypeScript/JavaScript patterns ───

const TYPESCRIPT_PATTERNS: ScanPattern[] = [
  // Dangerous
  { regex: /\bchild_process\b/, level: 'dangerous', reason: 'child_process can execute shell commands' },
  { regex: /\bexecSync\s*\(/, level: 'dangerous', reason: 'execSync() executes shell commands' },
  { regex: /\bspawnSync\s*\(/, level: 'dangerous', reason: 'spawnSync() executes shell commands' },
  { regex: /\.spawn\s*\(/, level: 'dangerous', reason: '.spawn() executes shell commands' },
  { regex: /\bfs\.rmSync\s*\([^)]*recursive/, level: 'dangerous', reason: 'fs.rmSync with recursive deletes directory trees' },
  { regex: /\bfs\.rmdirSync\s*\([^)]*recursive/, level: 'dangerous', reason: 'fs.rmdirSync with recursive deletes directory trees' },
  { regex: /(?<!\.\s*)(?<!\w)\beval\s*\(/, level: 'dangerous', reason: 'eval() executes arbitrary code' },
  { regex: /\bnew\s+Function\s*\(/, level: 'dangerous', reason: 'new Function() compiles arbitrary code' },
  { regex: /\bprocess\.exit\s*\(/, level: 'dangerous', reason: 'process.exit() terminates the process' },
  { regex: /\brimraf\b/, level: 'dangerous', reason: 'rimraf deletes directory trees' },

  // Cautious — match both `fs.writeFileSync(` and chained `require('fs').writeFileSync(`
  { regex: /\.writeFileSync\s*\(/, level: 'cautious', reason: 'writes to file' },
  { regex: /\.writeFile\s*\(/, level: 'cautious', reason: 'writes to file' },
  { regex: /\.appendFile(Sync)?\s*\(/, level: 'cautious', reason: 'appends to file' },
  { regex: /\.createWriteStream\s*\(/, level: 'cautious', reason: 'opens write stream' },
  { regex: /\.unlinkSync\s*\(/, level: 'cautious', reason: 'deletes file' },
  { regex: /\.unlink\s*\(/, level: 'cautious', reason: 'deletes file' },
  { regex: /\.renameSync\s*\(/, level: 'cautious', reason: 'renames/moves file' },
  { regex: /\bfetch\s*\([^)]*method\s*:\s*['"]?(POST|PUT|DELETE)/i, level: 'cautious', reason: 'makes mutating HTTP request' },
  { regex: /\bfetch\s*\(/, level: 'cautious', reason: 'makes HTTP request' },
  { regex: /\bhttps?\.request\s*\(/, level: 'cautious', reason: 'makes HTTP request' },
  { regex: /\bnet\.(?:connect|createConnection)\s*\(/, level: 'cautious', reason: 'opens network connection' },
  { regex: /\.rmSync\s*\(/, level: 'cautious', reason: 'deletes file/directory' },
  { regex: /\.rmdirSync\s*\(/, level: 'cautious', reason: 'removes directory' },
  { regex: /\.rm\s*\(/, level: 'cautious', reason: 'deletes file/directory' },
];

// ─── Perl patterns ───

const PERL_PATTERNS: ScanPattern[] = [
  // Dangerous
  { regex: /\bsystem\s*\(/, level: 'dangerous', reason: 'system() executes shell commands' },
  { regex: /\bexec\s*\(/, level: 'dangerous', reason: 'exec() replaces the process with a shell command' },
  { regex: /`[^`]+`/, level: 'dangerous', reason: 'backtick execution runs shell commands' },
  { regex: /\bqx\s*[{(]/, level: 'dangerous', reason: 'qx{} executes shell commands' },
  { regex: /\bunlink\b/, level: 'dangerous', reason: 'unlink deletes files' },
  { regex: /\beval\s+"/, level: 'dangerous', reason: 'eval "" executes arbitrary code (string eval)' },
  { regex: /\brequire\s+\$/, level: 'dangerous', reason: 'require with variable loads arbitrary modules' },

  // Cautious
  { regex: /\bopen\s*\([^)]*['"]?\s*>{1,2}/, level: 'cautious', reason: 'opens file for writing' },
  { regex: /\bsocket\b/i, level: 'cautious', reason: 'uses network sockets' },
  { regex: /\bIO::Socket\b/, level: 'cautious', reason: 'uses network sockets' },
  { regex: /\bLWP::UserAgent\b/, level: 'cautious', reason: 'makes HTTP requests' },
  { regex: /\bHTTP::Request\b/, level: 'cautious', reason: 'makes HTTP requests' },
  { regex: /\brename\s*\(/, level: 'cautious', reason: 'renames files' },
  { regex: /\brmdir\s*\(/, level: 'cautious', reason: 'removes directories' },
  { regex: /\bFile::Path::remove_tree\b/, level: 'cautious', reason: 'removes directory trees' },
];

// ─── Ruby patterns ───

const RUBY_PATTERNS: ScanPattern[] = [
  // Dangerous
  { regex: /`[^`]+`/, level: 'dangerous', reason: 'backtick execution runs shell commands' },
  { regex: /%x[(\{[]/, level: 'dangerous', reason: '%x{} executes shell commands' },
  { regex: /\bsystem\s*\(/, level: 'dangerous', reason: 'system() executes shell commands' },
  { regex: /\bexec\s*\(/, level: 'dangerous', reason: 'exec() replaces the process with a shell command' },
  { regex: /\bIO\.popen\b/, level: 'dangerous', reason: 'IO.popen executes shell commands' },
  { regex: /\bKernel\./, level: 'dangerous', reason: 'Kernel methods can execute shell commands' },
  { regex: /\bspawn\s*\(/, level: 'dangerous', reason: 'spawn() executes shell commands' },

  // Cautious
  { regex: /\bFile\.open\s*\([^)]*['"][wax+]/, level: 'cautious', reason: 'opens file for writing' },
  { regex: /\bFile\.write\b/, level: 'cautious', reason: 'writes to file' },
  { regex: /\bopen-uri\b/, level: 'cautious', reason: 'makes HTTP requests' },
  { regex: /\bNet::HTTP\b/, level: 'cautious', reason: 'makes HTTP requests' },
];

// ─── PHP patterns ───

const PHP_PATTERNS: ScanPattern[] = [
  // Dangerous
  { regex: /`[^`]+`/, level: 'dangerous', reason: 'backtick execution runs shell commands' },
  { regex: /\bshell_exec\b/, level: 'dangerous', reason: 'shell_exec() executes shell commands' },
  { regex: /\b(?:system|passthru|popen|proc_open)\s*\(/, level: 'dangerous', reason: 'executes shell commands' },
  { regex: /\bexec\s*\(/, level: 'dangerous', reason: 'exec() executes shell commands' },

  // Cautious
  { regex: /\bfile_put_contents\b/, level: 'cautious', reason: 'writes to file' },
  { regex: /\bfwrite\b/, level: 'cautious', reason: 'writes to file' },
  { regex: /\bfopen\s*\([^)]*['"][wax+]/, level: 'cautious', reason: 'opens file for writing' },
  { regex: /\bcurl_exec\b/, level: 'cautious', reason: 'makes HTTP requests' },
  { regex: /\bfsockopen\b/, level: 'cautious', reason: 'opens network connection' },
];

const PATTERNS_BY_LANGUAGE: Record<Language, ScanPattern[]> = {
  python: PYTHON_PATTERNS,
  typescript: TYPESCRIPT_PATTERNS,
  perl: PERL_PATTERNS,
  ruby: RUBY_PATTERNS,
  php: PHP_PATTERNS,
};

const MAX_SCRIPT_SIZE = 1024 * 1024; // 1MB

// Evasion signals for each language
const PYTHON_EVASION_SIGNALS = [
  { regex: /\bgetattr\s*\(/, reason: 'getattr enables dynamic attribute dispatch' },
  { regex: /\bchr\s*\(/, reason: 'chr()-built strings can hide identifiers' },
];

const TYPESCRIPT_EVASION_SIGNALS = [
  { regex: /\bglobalThis\s*\[/, reason: 'globalThis[...] is dynamic global access' },
  { regex: /\brequire\s*\(\s*(?!['\"`])/, reason: 'require() with a variable loads a dynamic module' },
];

const PERL_EVASION_SIGNALS: { regex: RegExp; reason: string }[] = [];
const RUBY_EVASION_SIGNALS: { regex: RegExp; reason: string }[] = [];
const PHP_EVASION_SIGNALS: { regex: RegExp; reason: string }[] = [];

const EVASION_SIGNALS_BY_LANGUAGE: Record<Language, { regex: RegExp; reason: string }[]> = {
  python: PYTHON_EVASION_SIGNALS,
  typescript: TYPESCRIPT_EVASION_SIGNALS,
  perl: PERL_EVASION_SIGNALS,
  ruby: RUBY_EVASION_SIGNALS,
  php: PHP_EVASION_SIGNALS,
};

export function scanScriptCode(code: string, language: Language): { verdict: Verdict; reason: string } {
  const patterns = PATTERNS_BY_LANGUAGE[language];

  // Check dangerous patterns first (higher severity wins)
  for (const pattern of patterns) {
    if (pattern.level === 'dangerous' && pattern.regex.test(code)) {
      return { verdict: 'dangerous', reason: pattern.reason };
    }
  }

  for (const pattern of patterns) {
    if (pattern.level === 'cautious' && pattern.regex.test(code)) {
      return { verdict: 'cautious', reason: pattern.reason };
    }
  }

  // Check for evasion signals
  const evasionSignals = EVASION_SIGNALS_BY_LANGUAGE[language] || [];
  for (const signal of evasionSignals) {
    if (signal.regex.test(code)) {
      return { verdict: 'unknown', reason: signal.reason };
    }
  }

  return { verdict: 'unknown', reason: 'no recognized danger or safe-shape pattern' };
}

export function readScriptFile(filePath: string, cwd: string): { content: string } | { error: string } {
  const fullPath = isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
  try {
    const stat = statSync(fullPath);
    if (stat.size > MAX_SCRIPT_SIZE) {
      return { error: 'script too large to scan' };
    }
    const content = readFileSync(fullPath, 'utf-8');
    return { content };
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EACCES') return { error: 'script not readable (permission denied)' };
    return { error: 'script not found' };
  }
}
