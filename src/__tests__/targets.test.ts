import { describe, it, expect } from 'vitest';
import { evaluateTargetPolicies } from '../targets';
import { evaluate } from '../evaluator';
import { parseCommand } from '../parser';
import { DEFAULT_CONFIG } from '../defaults';
import type { WardenConfig, ParsedCommand, TargetPolicy } from '../types';

function cmd(command: string, args: string[]): ParsedCommand {
  return { command, originalCommand: command, args, envPrefixes: [], raw: `${command} ${args.join(' ')}` };
}

function configWith(policies: TargetPolicy[]): WardenConfig {
  return { ...structuredClone(DEFAULT_CONFIG), targetPolicies: policies };
}

function evalWith(cmdStr: string, overrides: Partial<WardenConfig>, cwd?: string) {
  const config: WardenConfig = { ...structuredClone(DEFAULT_CONFIG), ...overrides };
  return evaluate(parseCommand(cmdStr), config, 0, cwd);
}

describe('target policies', () => {
  describe('path tower', () => {
    it('recursive matching: rm /tmp/foo matches policy path: /tmp', () => {
      const config = configWith([{ type: 'path', path: '/tmp', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('rm', ['/tmp/foo']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('recursive matching: rm /tmp matches policy path: /tmp', () => {
      const config = configWith([{ type: 'path', path: '/tmp', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('rm', ['/tmp']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('exact matching: recursive: false, rm /tmp matches', () => {
      const config = configWith([{ type: 'path', path: '/tmp', decision: 'deny', recursive: false }]);
      const result = evaluateTargetPolicies(cmd('rm', ['/tmp']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('exact matching: recursive: false, rm /tmp/foo does NOT match', () => {
      const config = configWith([{ type: 'path', path: '/tmp', decision: 'deny', recursive: false }]);
      const result = evaluateTargetPolicies(cmd('rm', ['/tmp/foo']), '/', config);
      expect(result).toBeNull();
    });

    it('{{cwd}} expansion: path with cwd placeholder matches correctly', () => {
      const config = configWith([{ type: 'path', path: '{{cwd}}/node_modules', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('rm', ['/project/node_modules/x']), '/project', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('allow');
    });

    it('{{cwd}} expansion: does not match outside cwd', () => {
      const config = configWith([{ type: 'path', path: '{{cwd}}/node_modules', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('rm', ['/other/node_modules/x']), '/project', config);
      expect(result).toBeNull();
    });

    it('{{cwd}} expansion: cwd with glob-like chars does not trigger glob matching', () => {
      const config = configWith([{ type: 'path', path: '{{cwd}}/build', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('rm', ['/project[0]/build/output']), '/project[0]', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('path traversal normalization: /tmp/../etc/passwd does NOT match /tmp', () => {
      const config = configWith([{ type: 'path', path: '/tmp', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('rm', ['/tmp/../etc/passwd']), '/', config);
      expect(result).toBeNull();
    });

    it('command filtering: policy with commands: [rm] does not match cp', () => {
      const config = configWith([{ type: 'path', path: '/tmp', decision: 'deny', commands: ['rm'] }]);
      const result = evaluateTargetPolicies(cmd('cp', ['/tmp/foo', '/tmp/bar']), '/', config);
      expect(result).toBeNull();
    });

    it('command filtering: policy with commands: [rm] matches rm', () => {
      const config = configWith([{ type: 'path', path: '/tmp', decision: 'deny', commands: ['rm'] }]);
      const result = evaluateTargetPolicies(cmd('rm', ['/tmp/foo']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('allowAll bypasses command filter', () => {
      const config = configWith([{ type: 'path', path: '/tmp', decision: 'deny', allowAll: true }]);
      const result = evaluateTargetPolicies(cmd('cp', ['/tmp/foo', '/dst']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('deny on ~/.ssh blocks rm ~/.ssh/id_rsa', () => {
      const config = configWith([{ type: 'path', path: '~/.ssh', decision: 'deny', reason: 'SSH keys protected' }]);
      const home = require('os').homedir();
      const result = evaluateTargetPolicies(cmd('rm', [`${home}/.ssh/id_rsa`]), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
      expect(result!.reason).toBe('SSH keys protected');
    });

    it('allow on /tmp allows rm /tmp/scratch', () => {
      const config = configWith([{ type: 'path', path: '/tmp', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('rm', ['/tmp/scratch']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('allow');
    });

    it('multiple policies: deny on /etc + allow on /tmp', () => {
      const config = configWith([
        { type: 'path', path: '/etc', decision: 'deny' },
        { type: 'path', path: '/tmp', decision: 'allow' },
      ]);
      const denyResult = evaluateTargetPolicies(cmd('rm', ['/etc/passwd']), '/', config);
      expect(denyResult).not.toBeNull();
      expect(denyResult!.decision).toBe('deny');

      const allowResult = evaluateTargetPolicies(cmd('rm', ['/tmp/scratch']), '/', config);
      expect(allowResult).not.toBeNull();
      expect(allowResult!.decision).toBe('allow');
    });

    it('most restrictive wins: deny > allow when both match', () => {
      const config = configWith([
        { type: 'path', path: '/data', decision: 'allow' },
        { type: 'path', path: '/data', decision: 'deny' },
      ]);
      const result = evaluateTargetPolicies(cmd('rm', ['/data/file']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('skips flag-like args (starting with -)', () => {
      const config = configWith([{ type: 'path', path: '/tmp', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('rm', ['-rf', '/safe/file']), '/', config);
      expect(result).toBeNull();
    });

    it('relative paths resolved against cwd', () => {
      const config = configWith([{ type: 'path', path: '/project/build', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('rm', ['build/output.js']), '/project', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('allow');
    });

    it('default commands for path type include rm, chmod, cp, mv, etc.', () => {
      const config = configWith([{ type: 'path', path: '/tmp', decision: 'deny' }]);
      for (const c of ['rm', 'chmod', 'chown', 'cp', 'mv', 'tee', 'mkdir', 'rmdir', 'touch', 'ln']) {
        const result = evaluateTargetPolicies(cmd(c, ['/tmp/file']), '/', config);
        expect(result).not.toBeNull();
        expect(result!.decision).toBe('deny');
      }
    });

    it('non-path commands like cat are not matched by default', () => {
      const config = configWith([{ type: 'path', path: '/tmp', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('cat', ['/tmp/file']), '/', config);
      expect(result).toBeNull();
    });
  });

  describe('database tower', () => {
    it('flag parsing: psql -h localhost -d mydb', () => {
      const config = configWith([{ type: 'database', host: 'localhost', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['-h', 'localhost', '-d', 'mydb']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('allow');
    });

    it('long flags: psql --host=prod.db --dbname=users', () => {
      const config = configWith([{ type: 'database', host: 'prod.db', database: 'users', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['--host=prod.db', '--dbname=users']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('long flags with space: psql --host prod.db --dbname users', () => {
      const config = configWith([{ type: 'database', host: 'prod.db', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['--host', 'prod.db', '--dbname', 'users']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('URI: psql postgresql://localhost/testdb', () => {
      const config = configWith([{ type: 'database', host: 'localhost', database: 'testdb', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['postgresql://localhost/testdb']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('allow');
    });

    it('MongoDB URI: mongosh mongodb://prod:27017/appdb', () => {
      const config = configWith([{ type: 'database', host: 'prod', database: 'appdb', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('mongosh', ['mongodb://prod:27017/appdb']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('Redis URI: redis-cli redis://cache.local:6379', () => {
      const config = configWith([{ type: 'database', host: 'cache.local', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('redis-cli', ['redis://cache.local:6379']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('allow');
    });

    it('glob matching: host *.prod.* matches db.prod.internal', () => {
      const config = configWith([{ type: 'database', host: '*.prod.*', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['-h', 'db.prod.internal']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('glob matching: host *.prod.* does not match db.dev.internal', () => {
      const config = configWith([{ type: 'database', host: '*.prod.*', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['-h', 'db.dev.internal']), '/', config);
      expect(result).toBeNull();
    });

    it('port filtering: policy port 5432 matches -p 5432', () => {
      const config = configWith([{ type: 'database', host: 'localhost', port: 5432, decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['-h', 'localhost', '-p', '5432']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('allow');
    });

    it('port filtering: policy port 5432 does not match -p 3306', () => {
      const config = configWith([{ type: 'database', host: 'localhost', port: 5432, decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['-h', 'localhost', '-p', '3306']), '/', config);
      expect(result).toBeNull();
    });

    it('port from URI', () => {
      const config = configWith([{ type: 'database', host: 'localhost', port: 5432, decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['postgresql://localhost:5432/mydb']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('allow');
    });

    it('malformed URI does not crash', () => {
      const config = configWith([{ type: 'database', host: 'localhost', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['postgresql://not a valid url:::/']), '/', config);
      // Should not throw, just skip
      expect(result).toBeNull();
    });

    it('no connection info returns null', () => {
      const config = configWith([{ type: 'database', host: 'localhost', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['--version']), '/', config);
      expect(result).toBeNull();
    });

    it('policy specifies host but command has no host returns null', () => {
      const config = configWith([{ type: 'database', host: 'prod', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['-d', 'mydb']), '/', config);
      expect(result).toBeNull();
    });

    it('malformed glob in database host policy does not crash', () => {
      const config = configWith([{ type: 'database', host: '[invalid', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['-h', 'localhost']), '/', config);
      expect(result).toBeNull();
    });

    it('malformed glob in endpoint pattern does not crash', () => {
      const config = configWith([{ type: 'endpoint', pattern: 'https://[invalid', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('curl', ['https://example.com']), '/', config);
      expect(result).toBeNull();
    });

    it('malformed glob in path policy does not crash', () => {
      const config = configWith([{ type: 'path', path: '/tmp/[invalid', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('rm', ['/tmp/file']), '/', config);
      expect(result).toBeNull();
    });

    it('database glob matching', () => {
      const config = configWith([{ type: 'database', host: '*', database: 'prod_*', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['-h', 'any', '-d', 'prod_users']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('default commands for database type', () => {
      const config = configWith([{ type: 'database', host: 'localhost', decision: 'deny' }]);
      for (const c of ['psql', 'mysql', 'mariadb', 'redis-cli', 'mongosh', 'mongo']) {
        const result = evaluateTargetPolicies(cmd(c, ['-h', 'localhost']), '/', config);
        expect(result).not.toBeNull();
      }
    });

    it('non-database command not matched by default', () => {
      const config = configWith([{ type: 'database', host: 'localhost', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('curl', ['-h', 'localhost']), '/', config);
      expect(result).toBeNull();
    });

    it('flags take precedence over URI', () => {
      const config = configWith([{ type: 'database', host: 'flaghost', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['-h', 'flaghost', 'postgresql://urihost/db']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });
  });

  describe('endpoint tower', () => {
    it('positional URL: curl https://api.dev.example.com/users', () => {
      const config = configWith([{ type: 'endpoint', pattern: 'https://api.dev.*', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('curl', ['https://api.dev.example.com/users']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('allow');
    });

    it('--url flag: curl --url https://internal.api/secret', () => {
      const config = configWith([{ type: 'endpoint', pattern: 'https://internal.api*', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('curl', ['--url', 'https://internal.api/secret']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('--url= syntax: curl --url=https://internal.api/secret', () => {
      const config = configWith([{ type: 'endpoint', pattern: 'https://internal.api*', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('curl', ['--url=https://internal.api/secret']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('glob matching: pattern https://api.dev.* matches', () => {
      const config = configWith([{ type: 'endpoint', pattern: 'https://api.dev.*', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('curl', ['https://api.dev.example.com']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('allow');
    });

    it('glob matching: pattern does not match different domain', () => {
      const config = configWith([{ type: 'endpoint', pattern: 'https://api.dev.*', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('curl', ['https://api.prod.example.com']), '/', config);
      expect(result).toBeNull();
    });

    it('command filtering: only curl/wget/http/httpie by default', () => {
      const config = configWith([{ type: 'endpoint', pattern: 'https://*', decision: 'deny' }]);
      for (const c of ['curl', 'wget', 'http', 'httpie']) {
        const result = evaluateTargetPolicies(cmd(c, ['https://example.com']), '/', config);
        expect(result).not.toBeNull();
      }
      // Non-endpoint command
      const result = evaluateTargetPolicies(cmd('cat', ['https://example.com']), '/', config);
      expect(result).toBeNull();
    });

    it('allowAll bypasses endpoint command filter', () => {
      const config = configWith([{ type: 'endpoint', pattern: 'https://*', decision: 'deny', allowAll: true }]);
      const result = evaluateTargetPolicies(cmd('node', ['https://example.com']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('no URL in args returns null', () => {
      const config = configWith([{ type: 'endpoint', pattern: 'https://*', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('curl', ['-v', '--header', 'X-Auth: token']), '/', config);
      expect(result).toBeNull();
    });

    it('http:// URLs also matched', () => {
      const config = configWith([{ type: 'endpoint', pattern: 'http://localhost*', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('curl', ['http://localhost:3000/api']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('allow');
    });
  });

  describe('integration via evaluate()', () => {
    it('alwaysDeny takes precedence: rm in alwaysDeny, path policy allows /tmp', () => {
      const result = evalWith('rm /tmp/foo', {
        targetPolicies: [{ type: 'path', path: '/tmp', decision: 'allow' }],
        layers: [{
          ...structuredClone(DEFAULT_CONFIG).layers[0],
          alwaysDeny: [...structuredClone(DEFAULT_CONFIG).layers[0].alwaysDeny, 'rm'],
        }],
      }, '/');
      expect(result.decision).toBe('deny');
    });

    it('target deny overrides command-specific allow: rule allows rm, path denies /etc', () => {
      const config = structuredClone(DEFAULT_CONFIG);
      // rm has default: ask with patterns, but let's add a rule that allows rm by default
      const rmRuleIdx = config.layers[0].rules.findIndex(r => r.command === 'rm');
      config.layers[0].rules[rmRuleIdx] = { command: 'rm', default: 'allow' };
      config.targetPolicies = [{ type: 'path', path: '/etc', decision: 'deny', reason: 'system config protected' }];
      const result = evaluate(parseCommand('rm /etc/passwd'), config, 0, '/');
      // Target policies are checked before command rules, so deny wins
      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('system config protected');
    });

    it('no cwd: target policies silently skip, fall through to normal eval', () => {
      const result = evalWith('rm /tmp/foo', {
        targetPolicies: [{ type: 'path', path: '/tmp', decision: 'allow' }],
      });
      // Without cwd, target policies are skipped; rm /tmp/foo goes through normal eval
      // rm with few args and no recursive flags → allow by default rules
      expect(result.decision).toBe('allow');
    });

    it('no targetPolicies in config: no effect, normal evaluation', () => {
      const result = evalWith('rm file.txt', { targetPolicies: [] }, '/');
      // Normal rm evaluation with few args → allow
      expect(result.decision).toBe('allow');
    });

    it('target allow on /tmp lets rm through', () => {
      const result = evalWith('rm /tmp/scratch', {
        targetPolicies: [{ type: 'path', path: '/tmp', decision: 'allow' }],
      }, '/');
      expect(result.decision).toBe('allow');
    });

    it('target deny on database blocks matching host', () => {
      const result = evalWith('psql -h db.prod.internal -d users', {
        targetPolicies: [{ type: 'database', host: '*.prod.*', decision: 'deny', reason: 'prod blocked' }],
      }, '/');
      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('prod blocked');
    });

    it('non-matching database host falls through to normal eval', () => {
      const result = evalWith('psql -h prod.db -d users', {
        targetPolicies: [{ type: 'database', host: '*.prod.*', decision: 'deny' }],
      }, '/');
      // prod.db doesn't match *.prod.* (no dot before "prod"), falls through to normal psql rule
      // psql has VERSION_HELP_FLAGS pattern: -h matches ^-[vh]$ → allow
      expect(result.decision).toBe('allow');
    });

    it('endpoint policy blocks curl to matched URL', () => {
      const result = evalWith('curl https://evil.example.com/exfil', {
        targetPolicies: [{ type: 'endpoint', pattern: 'https://evil.*', decision: 'deny' }],
      }, '/');
      expect(result.decision).toBe('deny');
    });

    it('pipes: target policy applies to each command in pipeline', () => {
      const result = evalWith('cat /etc/passwd | rm /etc/shadow', {
        targetPolicies: [{ type: 'path', path: '/etc', decision: 'deny' }],
      }, '/');
      // cat is not in PATH_COMMANDS so won't match, but rm is
      expect(result.decision).toBe('deny');
    });
  });

  describe('matchedRule field', () => {
    it('path policy sets matchedRule to targetPolicy:path', () => {
      const config = configWith([{ type: 'path', path: '/tmp', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('rm', ['/tmp/file']), '/', config);
      expect(result!.matchedRule).toBe('targetPolicy:path');
    });

    it('database policy sets matchedRule to targetPolicy:database', () => {
      const config = configWith([{ type: 'database', host: 'localhost', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('psql', ['-h', 'localhost']), '/', config);
      expect(result!.matchedRule).toBe('targetPolicy:database');
    });

    it('endpoint policy sets matchedRule to targetPolicy:endpoint', () => {
      const config = configWith([{ type: 'endpoint', pattern: 'https://*', decision: 'allow' }]);
      const result = evaluateTargetPolicies(cmd('curl', ['https://example.com']), '/', config);
      expect(result!.matchedRule).toBe('targetPolicy:endpoint');
    });
  });

  describe('no matching policies', () => {
    it('returns null when no policies configured', () => {
      const config = configWith([]);
      const result = evaluateTargetPolicies(cmd('rm', ['/tmp/file']), '/', config);
      expect(result).toBeNull();
    });

    it('returns null when command does not match any policy', () => {
      const config = configWith([{ type: 'path', path: '/opt', decision: 'deny' }]);
      const result = evaluateTargetPolicies(cmd('rm', ['/tmp/file']), '/', config);
      expect(result).toBeNull();
    });
  });

  describe('decision precedence across matching policies', () => {
    it('ask > allow when both match', () => {
      const config = configWith([
        { type: 'path', path: '/data', decision: 'allow' },
        { type: 'path', path: '/data', decision: 'ask' },
      ]);
      const result = evaluateTargetPolicies(cmd('rm', ['/data/file']), '/', config);
      expect(result!.decision).toBe('ask');
    });

    it('deny > ask > allow', () => {
      const config = configWith([
        { type: 'path', path: '/data', decision: 'allow' },
        { type: 'path', path: '/data', decision: 'ask' },
        { type: 'path', path: '/data', decision: 'deny' },
      ]);
      const result = evaluateTargetPolicies(cmd('rm', ['/data/file']), '/', config);
      expect(result!.decision).toBe('deny');
    });
  });

  describe('rework fixes', () => {
    it('database policy does not match when command omits database but policy specifies one', () => {
      const config = configWith([
        { type: 'database', host: 'prod', database: 'secret_db', decision: 'deny' },
      ]);
      const result = evaluateTargetPolicies(cmd('psql', ['-h', 'prod']), '/', config);
      expect(result).toBeNull();
    });

    it('database policy matches when command provides matching database', () => {
      const config = configWith([
        { type: 'database', host: 'prod', database: 'secret_db', decision: 'deny' },
      ]);
      const result = evaluateTargetPolicies(cmd('psql', ['-h', 'prod', '-d', 'secret_db']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('matchedRule reflects winning policy type, not first policy', () => {
      const config = configWith([
        { type: 'path', path: '/tmp', decision: 'allow', allowAll: true },
        { type: 'endpoint', pattern: 'https://evil.com/*', decision: 'deny', allowAll: true },
      ]);
      const result = evaluateTargetPolicies(
        cmd('curl', ['/tmp/out', 'https://evil.com/data']), '/tmp', config
      );
      expect(result!.decision).toBe('deny');
      expect(result!.matchedRule).toBe('targetPolicy:endpoint');
    });

    it('path policy supports glob patterns with *', () => {
      const config = configWith([
        { type: 'path', path: '/tmp/*/build', decision: 'allow' },
      ]);
      const result = evaluateTargetPolicies(cmd('rm', ['/tmp/foo/build/output']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('allow');
    });

    it('path policy glob * does not cross segments', () => {
      const config = configWith([
        { type: 'path', path: '/tmp/*/build', decision: 'allow', recursive: false },
      ]);
      const result = evaluateTargetPolicies(cmd('rm', ['/tmp/foo/bar/build']), '/', config);
      expect(result).toBeNull();
    });

    it('path policy supports ** glob', () => {
      const config = configWith([
        { type: 'path', path: '/home/**/.ssh', decision: 'deny' },
      ]);
      const result = evaluateTargetPolicies(cmd('rm', ['/home/user/sub/.ssh/key']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });

    it('expands ~ in command args', () => {
      const home = require('os').homedir();
      const config = configWith([
        { type: 'path', path: '~/.ssh', decision: 'deny' },
      ]);
      const result = evaluateTargetPolicies(cmd('rm', ['~/.ssh/id_rsa']), '/', config);
      expect(result).not.toBeNull();
      expect(result!.decision).toBe('deny');
    });
  });

  describe('target policies before chain-resolved auto-allow', () => {
    it('target deny blocks chain-resolved command with no rules', () => {
      // Simulate: RM=/bin/rm && $RM /etc/passwd
      // The $RM resolves to rm (no user rules for it, but defaults exist)
      // Path policy denies /etc — should block it before chain-resolved auto-allow
      const config = structuredClone(DEFAULT_CONFIG);
      config.targetPolicies = [{ type: 'path', path: '/etc', decision: 'deny' }];
      const parsed = parseCommand('RM=/bin/rm && $RM /etc/passwd');
      const result = evaluate(parsed, config, 0, '/');
      expect(result.decision).toBe('deny');
      expect(result.reason).toContain('target policy');
    });

    it('target allow on /tmp lets chain-resolved rm through', () => {
      const config = structuredClone(DEFAULT_CONFIG);
      config.targetPolicies = [{ type: 'path', path: '/tmp', decision: 'allow' }];
      const parsed = parseCommand('RM=/bin/rm && $RM /tmp/scratch');
      const result = evaluate(parsed, config, 0, '/');
      expect(result.decision).toBe('allow');
    });
  });
});
