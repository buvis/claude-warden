import { describe, it, expect } from 'vitest';
import { parseCommand } from '../parser';

describe('parseCommand', () => {
  it('parses a simple command', () => {
    const result = parseCommand('ls -la');
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('ls');
    expect(result.commands[0].args).toEqual(['-la']);
    expect(result.hasSubshell).toBe(false);
    expect(result.parseError).toBe(false);
  });

  it('parses piped commands', () => {
    const result = parseCommand('cat a.txt | grep foo | wc -l');
    expect(result.commands).toHaveLength(3);
    expect(result.commands[0].command).toBe('cat');
    expect(result.commands[1].command).toBe('grep');
    expect(result.commands[1].args).toEqual(['foo']);
    expect(result.commands[2].command).toBe('wc');
    expect(result.commands[2].args).toEqual(['-l']);
  });

  it('parses chained commands with &&', () => {
    const result = parseCommand('mkdir -p dir && cd dir && npm init -y');
    expect(result.commands).toHaveLength(3);
    expect(result.commands[0].command).toBe('mkdir');
    expect(result.commands[1].command).toBe('cd');
    expect(result.commands[2].command).toBe('npm');
    expect(result.commands[2].args).toEqual(['init', '-y']);
  });

  it('parses commands with ||', () => {
    const result = parseCommand('test -f file || touch file');
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].command).toBe('test');
    expect(result.commands[1].command).toBe('touch');
  });

  it('parses commands with ;', () => {
    const result = parseCommand('echo hello; echo world');
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].command).toBe('echo');
    expect(result.commands[0].args).toEqual(['hello']);
    expect(result.commands[1].command).toBe('echo');
    expect(result.commands[1].args).toEqual(['world']);
  });

  it('extracts env prefixes', () => {
    const result = parseCommand('NODE_ENV=production npx next build');
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('npx');
    expect(result.commands[0].args).toEqual(['next', 'build']);
    expect(result.commands[0].envPrefixes).toEqual(['NODE_ENV=production']);
  });

  it('handles multiple env prefixes', () => {
    const result = parseCommand('A=1 B=2 npm run test');
    expect(result.commands[0].envPrefixes).toEqual(['A=1', 'B=2']);
    expect(result.commands[0].command).toBe('npm');
  });

  it('handles quoted arguments', () => {
    const result = parseCommand('echo "hello world" | wc -c');
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].args).toEqual(['hello world']);
  });

  it('handles single-quoted arguments with pipes inside', () => {
    const result = parseCommand("grep 'a|b' file.txt");
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('grep');
    expect(result.commands[0].args).toEqual(['a|b', 'file.txt']);
  });

  it('detects subshells with $()', () => {
    const result = parseCommand('echo $(whoami)');
    expect(result.hasSubshell).toBe(true);
    expect(result.subshellCommands).toEqual(['whoami']);
  });

  it('detects subshells with backticks', () => {
    const result = parseCommand('echo `date`');
    expect(result.hasSubshell).toBe(true);
    expect(result.subshellCommands).toEqual(['date']);
  });

  it('extracts subshellCommands from complex $() expansion', () => {
    const result = parseCommand('echo $(curl http://example.com)');
    expect(result.hasSubshell).toBe(true);
    expect(result.subshellCommands).toEqual(['curl http://example.com']);
  });

  it('extracts multiple subshellCommands', () => {
    const result = parseCommand('echo $(date) $(whoami)');
    expect(result.hasSubshell).toBe(true);
    expect(result.subshellCommands).toContain('date');
    expect(result.subshellCommands).toContain('whoami');
  });

  it('does not set subshellCommands for regular commands', () => {
    const result = parseCommand('ls -la');
    expect(result.subshellCommands).toEqual([]);
  });

  it('normalizes command paths to basename', () => {
    const result = parseCommand('/usr/bin/node --version');
    expect(result.commands[0].command).toBe('node');
  });

  it('handles empty input', () => {
    const result = parseCommand('');
    expect(result.commands).toHaveLength(0);
    expect(result.parseError).toBe(false);
  });

  it('handles whitespace-only input', () => {
    const result = parseCommand('   ');
    expect(result.commands).toHaveLength(0);
  });

  it('recursively parses sh -c commands', () => {
    const result = parseCommand('sh -c "cat file.txt | wc -l"');
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].command).toBe('cat');
    expect(result.commands[1].command).toBe('wc');
  });

  it('recursively parses bash -c commands', () => {
    const result = parseCommand('bash -c "npm run build && npm test"');
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].command).toBe('npm');
    expect(result.commands[1].command).toBe('npm');
  });

  it('extracts script as command from bash script.sh', () => {
    const result = parseCommand('bash script.sh');
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('script.sh');
    expect(result.commands[0].args).toEqual([]);
  });

  it('extracts script as command from bash -x /path/to/script.sh arg1', () => {
    const result = parseCommand('bash -x /path/to/script.sh arg1');
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('script.sh');
    expect(result.commands[0].originalCommand).toBe('/path/to/script.sh');
    expect(result.commands[0].args).toEqual(['arg1']);
  });

  it('extracts script as command from sh with multiple flags', () => {
    const result = parseCommand('sh -xe /tmp/setup.sh -f config.yaml');
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('setup.sh');
    expect(result.commands[0].originalCommand).toBe('/tmp/setup.sh');
    expect(result.commands[0].args).toEqual(['-f', 'config.yaml']);
  });

  it('keeps bash --version as bash command', () => {
    const result = parseCommand('bash --version');
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('bash');
    expect(result.commands[0].args).toEqual(['--version']);
  });

  it('keeps bare bash as bash command', () => {
    const result = parseCommand('bash');
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('bash');
  });

  it('extracts script from zsh invocation', () => {
    const result = parseCommand('zsh /path/to/init.sh');
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('init.sh');
  });

  it('handles heredocs by extracting base command', () => {
    const result = parseCommand('cat <<EOF\nhello\nEOF');
    expect(result.hasSubshell).toBe(false); // heredoc body is data, not a subshell
    expect(result.commands.length).toBeGreaterThanOrEqual(1);
    expect(result.commands[0].command).toBe('cat');
  });

  it('handles complex real-world command', () => {
    const result = parseCommand('NODE_OPTIONS="--max-old-space-size=4096" npx jest --coverage && echo done');
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].command).toBe('npx');
    expect(result.commands[0].args).toContain('jest');
    expect(result.commands[1].command).toBe('echo');
  });

  it('handles nested subshells', () => {
    const result = parseCommand('(echo hello; (echo nested))');
    expect(result.hasSubshell).toBe(true);
  });

  it('detects command substitution in double quotes', () => {
    const result = parseCommand('echo "today is $(date)"');
    expect(result.hasSubshell).toBe(true);
    expect(result.commands[0].command).toBe('echo');
  });

  it('handles mixed pipes and logical operators', () => {
    const result = parseCommand('cat file | sort && echo done || echo fail');
    expect(result.commands).toHaveLength(4);
    expect(result.commands[0].command).toBe('cat');
    expect(result.commands[1].command).toBe('sort');
    expect(result.commands[2].command).toBe('echo');
    expect(result.commands[3].command).toBe('echo');
  });

  it('returns parseError for invalid syntax', () => {
    const result = parseCommand('"unterminated');
    expect(result.parseError).toBe(true);
  });

  it('handles $(cat <<EOF) as string interpolation, not subshell', () => {
    const result = parseCommand('gh pr create --title "test" --body "$(cat <<\'EOF\'\ntest body\nEOF\n)"');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(false);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('gh');
  });

  it('handles $(cat <<EOF) without quotes on marker', () => {
    const result = parseCommand('git commit -m "$(cat <<EOF\ncommit message\nEOF\n)"');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(false);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('git');
  });

  it('does not flag << inside quoted string args as heredoc', () => {
    // << inside a quoted argument should NOT trigger the heredoc first-line extraction path.
    // << inside a quoted argument is text, not a heredoc redirect.
    const result = parseCommand('git commit -m "fix: handle <<EOF pattern"');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(false);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('git');
    expect(result.commands[0].args).toContain('fix: handle <<EOF pattern');
  });

  it('handles $(cat <<EOF) inside quoted args without false heredoc detection', () => {
    // $(cat <<EOF) inside a quoted string is a CommandExpansion (hasSubshell=true),
    // but should NOT be treated as string interpolation (no proper body).
    const result = parseCommand('git commit -m "fix: handle $(cat <<EOF) heredoc"');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(true); // has CommandExpansion
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('git');
  });

  it('does not flag bare heredocs as subshell - body is data, not code', () => {
    const result = parseCommand('cat <<EOF\nhello\nEOF');
    expect(result.hasSubshell).toBe(false);
    expect(result.commands.length).toBeGreaterThanOrEqual(1);
    expect(result.commands[0].command).toBe('cat');
  });

  it('handles heredoc with redirect (cat > file << EOF)', () => {
    const result = parseCommand("cat > /tmp/out.md << 'EOF'\nsome content\nEOF");
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(false);
    expect(result.commands.length).toBeGreaterThanOrEqual(1);
    expect(result.commands[0].command).toBe('cat');
  });

  it('handles heredoc with tee', () => {
    const result = parseCommand("tee /tmp/out.txt << 'EOF'\nhello world\nEOF");
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(false);
    expect(result.commands[0].command).toBe('tee');
  });

  // --- Path parentheses (e.g. Next.js route groups) ---

  it('handles unquoted parentheses in file paths', () => {
    const result = parseCommand('cd /path/to/project && git show HEAD -- apps/mobile/app/(app)/_layout.tsx | head -100');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(3);
    expect(result.commands[0].command).toBe('cd');
    expect(result.commands[1].command).toBe('git');
    expect(result.commands[2].command).toBe('head');
  });

  it('handles simple path with parentheses', () => {
    const result = parseCommand('ls apps/(app)');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('ls');
  });

  it('handles multiple path-parens tokens', () => {
    const result = parseCommand('diff src/(auth)/page.tsx src/(public)/page.tsx');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('diff');
  });

  it('preserves already-quoted paths with parentheses', () => {
    const result = parseCommand('git diff -- "src/(auth)/page.tsx"');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('git');
  });

  it('does not affect $() command substitution', () => {
    const result = parseCommand('echo $(date)');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(true);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('echo');
  });

  it('does not affect actual subshell syntax', () => {
    const result = parseCommand('echo hello && (cd /tmp && ls)');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(true);
  });
});

describe('chain-local variable tracking', () => {
  it('tracks static chain assignments', () => {
    const result = parseCommand('ZDB=/path/to/zdb && echo ok');
    expect(result.chainAssignments.has('ZDB')).toBe(true);
    const a = result.chainAssignments.get('ZDB')!;
    expect(a.isDynamic).toBe(false);
    expect(a.value).toBe('/path/to/zdb');
  });

  it('tracks dynamic chain assignments', () => {
    const result = parseCommand('TMPDIR=$(mktemp -d) && echo ok');
    expect(result.chainAssignments.has('TMPDIR')).toBe(true);
    const a = result.chainAssignments.get('TMPDIR')!;
    expect(a.isDynamic).toBe(true);
    expect(a.value).toBeNull();
  });

  it('resolves variable in command position', () => {
    const result = parseCommand('ZDB=/usr/bin/zdb && $ZDB init');
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('zdb');
    expect(result.commands[0].originalCommand).toBe('/usr/bin/zdb');
  });

  it('preserves resolvedFrom on resolved command', () => {
    const result = parseCommand('ZDB=/usr/bin/zdb && $ZDB init');
    expect(result.commands[0].resolvedFrom).toBe('$ZDB');
  });

  it('does not resolve untracked variables', () => {
    const result = parseCommand('$UNKNOWN init');
    expect(result.commands[0].command).toBe('$UNKNOWN');
    expect(result.commands[0].resolvedFrom).toBeUndefined();
  });

  it('does not resolve dynamic variables in command position', () => {
    const result = parseCommand('CMD=$(which zdb) && $CMD init');
    expect(result.commands[0].command).toBe('$CMD');
    expect(result.commands[0].resolvedFrom).toBe('$CMD');
  });

  it('does not track env prefixes as chain assignments', () => {
    const result = parseCommand('FOO=bar npm test');
    expect(result.chainAssignments.has('FOO')).toBe(false);
  });

  it('tracks multiple standalone assignments in a chain', () => {
    const result = parseCommand('A=1 && B=2 && echo ok');
    expect(result.chainAssignments.has('A')).toBe(true);
    expect(result.chainAssignments.has('B')).toBe(true);
    expect(result.chainAssignments.get('A')!.value).toBe('1');
    expect(result.chainAssignments.get('B')!.value).toBe('2');
  });

  it('preserves $VAR in args (not resolved)', () => {
    const result = parseCommand('DIR=/tmp/build && rm -rf $DIR');
    expect(result.commands[0].args).toContain('$DIR');
  });

  it('handles ${VAR} brace syntax in command position', () => {
    const result = parseCommand('ZDB=/usr/bin/zdb && ${ZDB} init');
    expect(result.commands[0].command).toBe('zdb');
    expect(result.commands[0].resolvedFrom).toBe('${ZDB}');
  });
});

describe('special characters in double-quoted args', () => {
  it('handles $ in double-quoted args', () => {
    const result = parseCommand('gh api repos/org/repo/pulls/1/comments -f body="regex /^[A-Za-z_][A-Za-z0-9_]*$/" -F in_reply_to=123');
    expect(result.parseError).toBe(false);
    expect(result.commands.length).toBe(1);
    expect(result.commands[0].command).toBe('gh');
    expect(result.commands[0].args[0]).toBe('api');
  });

  it('handles pipes with $ in args', () => {
    const result = parseCommand('echo "$invalid" | gh api foo');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].command).toBe('echo');
    expect(result.commands[1].command).toBe('gh');
  });

  it('handles env prefixes with $ in args', () => {
    const result = parseCommand('FOO=bar gh api repos/org/repo/issues -f body="test $value"');
    expect(result.parseError).toBe(false);
    expect(result.commands[0].command).toBe('gh');
    expect(result.commands[0].envPrefixes).toContain('FOO=bar');
  });

  it('handles $ at end of double-quoted string', () => {
    const result = parseCommand('gh api repos/org/repo/issues -f body="price is 100$"');
    expect(result.parseError).toBe(false);
    expect(result.commands[0].command).toBe('gh');
  });

  it('handles multiple $ characters in args', () => {
    const result = parseCommand('gh api repos/org/repo/issues -f body="costs $5 or $10"');
    expect(result.parseError).toBe(false);
    expect(result.commands[0].command).toBe('gh');
  });

  it('normalizes full path commands with $ in args', () => {
    const result = parseCommand('/usr/bin/gh api repos/org/repo/issues -f body="$test"');
    expect(result.parseError).toBe(false);
    expect(result.commands[0].command).toBe('gh');
  });

  it('preserves single-quoted args with $ characters', () => {
    const result = parseCommand("gh api repos/org/repo/issues -f body='has $dollar signs'");
    expect(result.parseError).toBe(false);
    expect(result.commands[0].command).toBe('gh');
  });

  it('handles && chains with $ in args', () => {
    const result = parseCommand('echo "$bad" && echo ok');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].command).toBe('echo');
    expect(result.commands[1].command).toBe('echo');
  });

  it('handles semicolons with $ in args', () => {
    const result = parseCommand('echo "$bad"; echo ok');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].command).toBe('echo');
    expect(result.commands[1].command).toBe('echo');
  });
});

describe('$ in various double-quote positions', () => {
  it('$ followed by / in double quotes (regex anchors)', () => {
    const result = parseCommand('curl -X POST -d "pattern: /^foo$/" http://example.com');
    expect(result.parseError).toBe(false);
    expect(result.commands[0].command).toBe('curl');
  });

  it('$ followed by ] in double quotes (character classes)', () => {
    const result = parseCommand('echo "match [a-z$]"');
    expect(result.parseError).toBe(false);
  });

  it('$ followed by ) in double quotes', () => {
    const result = parseCommand('gh issue create -f body="validate($)"');
    expect(result.parseError).toBe(false);
    expect(result.commands[0].command).toBe('gh');
  });

  it('multiline body with $ characters', () => {
    const result = parseCommand('gh api repos/org/repo/pulls/1/comments -f body="line1\nregex: /^[A-Z]$+/\nline3"');
    expect(result.parseError).toBe(false);
    expect(result.commands[0].command).toBe('gh');
  });
});

describe('pipelines and chains with special characters', () => {
  it('parses multi-segment pipe with $ in grep args', () => {
    const result = parseCommand('gh run view 123 2>&1 | grep -v "^$" | grep -i "step\\|fail" | head -20');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(4);
    expect(result.commands[0].command).toBe('gh');
    expect(result.commands[1].command).toBe('grep');
    expect(result.commands[2].command).toBe('grep');
    expect(result.commands[3].command).toBe('head');
  });

  it('parses simple pipe with $ at end of double-quoted string', () => {
    const result = parseCommand('echo "$" | head -1');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].command).toBe('echo');
    expect(result.commands[1].command).toBe('head');
  });

  it('parses && chain with $ in args', () => {
    const result = parseCommand('echo "foo$" && head file');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].command).toBe('echo');
    expect(result.commands[1].command).toBe('head');
  });

  it('parses || operator with $ in args', () => {
    const result = parseCommand('echo "$bad" || echo fallback');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].command).toBe('echo');
    expect(result.commands[1].command).toBe('echo');
  });

  it('parses mixed pipe and && with $ in args', () => {
    const result = parseCommand('echo "test$" | grep test && echo ok');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(3);
    expect(result.commands[0].command).toBe('echo');
    expect(result.commands[1].command).toBe('grep');
    expect(result.commands[2].command).toBe('echo');
  });

  it('does not split pipe inside quotes', () => {
    const result = parseCommand('echo "hello | world$"');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('echo');
  });

  it('parses semicolons with $ in args', () => {
    const result = parseCommand('echo "$bad"; echo ok');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(2);
    expect(result.commands[0].command).toBe('echo');
    expect(result.commands[1].command).toBe('echo');
  });

  it('propagates chain assignments across segments for $VAR resolution', () => {
    // Chain assignments should propagate and resolve $ZDB even with special chars
    const result = parseCommand('ZDB=/usr/bin/zdb && $ZDB query "pattern $"');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('zdb');
    expect(result.commands[0].originalCommand).toBe('/usr/bin/zdb');
    expect(result.commands[0].resolvedFrom).toBe('$ZDB');
  });

  it('propagates chain assignments with ${VAR} syntax', () => {
    const result = parseCommand('ZDB=/usr/bin/zdb && ${ZDB} query "test $"');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('zdb');
    expect(result.commands[0].resolvedFrom).toBe('${ZDB}');
  });

  it('marks dynamic chain assignments as resolvedFrom without resolving', () => {
    const result = parseCommand('CMD=$(which zdb) && $CMD query "test $"');
    expect(result.parseError).toBe(false);
    expect(result.commands).toHaveLength(1);
    expect(result.commands[0].command).toBe('$CMD');
    expect(result.commands[0].resolvedFrom).toBe('$CMD');
  });

  it('does not split on pipe inside $() command substitution', () => {
    const result = parseCommand('echo $(cat file | head -1) something$');
    // Pipe inside $() must not be treated as a pipeline operator
    if (!result.parseError) {
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].command).toBe('echo');
    }
  });

  it('does not split on pipe inside backticks', () => {
    const result = parseCommand('echo `cat file | head -1` something$');
    if (!result.parseError) {
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].command).toBe('echo');
    }
  });
});

describe('shell control flow constructs', () => {
  it('extracts commands from while loop', () => {
    const result = parseCommand('while ps -p 22396 > /dev/null 2>&1; do sleep 5; done; echo "DONE"');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(false);
    expect(result.commands.map(c => c.command)).toEqual(expect.arrayContaining(['ps', 'sleep', 'echo']));
  });

  it('extracts commands from if-then-else', () => {
    const result = parseCommand('if test -f foo.txt; then cat foo.txt; else echo missing; fi');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(false);
    expect(result.commands.map(c => c.command)).toEqual(expect.arrayContaining(['test', 'cat', 'echo']));
  });

  it('extracts commands from for loop', () => {
    const result = parseCommand('for f in a b c; do echo $f; done');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(false);
    expect(result.commands.map(c => c.command)).toContain('echo');
  });

  it('extracts commands from until loop', () => {
    const result = parseCommand('until test -f /tmp/ready; do sleep 1; done');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(false);
    expect(result.commands.map(c => c.command)).toEqual(expect.arrayContaining(['test', 'sleep']));
  });

  it('extracts commands from case statement', () => {
    const result = parseCommand('case $x in a) echo one;; b) echo two;; esac');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(false);
    expect(result.commands.map(c => c.command)).toContain('echo');
  });

  it('extracts commands from nested if inside while', () => {
    const result = parseCommand('while true; do if test -f done; then break; fi; sleep 1; done');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(false);
    expect(result.commands.map(c => c.command)).toEqual(expect.arrayContaining(['true', 'test', 'sleep']));
  });

  it('extracts commands from nested for inside if', () => {
    const result = parseCommand('if test -d src; then for f in a b; do echo $f; done; fi');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(false);
    expect(result.commands.map(c => c.command)).toEqual(expect.arrayContaining(['test', 'echo']));
  });

  it('extracts commands from while inside while', () => {
    const result = parseCommand('while true; do while false; do echo inner; done; echo outer; done');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(false);
    expect(result.commands.map(c => c.command)).toEqual(expect.arrayContaining(['true', 'false', 'echo']));
  });

  it('extracts commands from if-elif-else', () => {
    const result = parseCommand('if test -f a; then echo a; elif test -f b; then echo b; else echo c; fi');
    expect(result.parseError).toBe(false);
    expect(result.hasSubshell).toBe(false);
    expect(result.commands.map(c => c.command)).toEqual(expect.arrayContaining(['test', 'echo']));
  });
});

describe('chain cwd tracking', () => {
  it('stamps effectiveCwd from cd /absolute in chain', () => {
    const result = parseCommand('cd /tmp && ls');
    expect(result.parseError).toBe(false);
    const ls = result.commands.find(c => c.command === 'ls');
    expect(ls?.effectiveCwd).toBe('/tmp');
  });

  it('tracks nested cd in chain', () => {
    const result = parseCommand('cd /tmp && mkdir test && cd test && rm -rf .git');
    expect(result.parseError).toBe(false);
    const rm = result.commands.find(c => c.command === 'rm');
    expect(rm?.effectiveCwd).toBe('/tmp/test');
  });

  it('does not set effectiveCwd for cd with no prior absolute base', () => {
    const result = parseCommand('cd relative && ls');
    const ls = result.commands.find(c => c.command === 'ls');
    expect(ls?.effectiveCwd).toBeUndefined();
  });

  it('resolves chain-assigned variable in cd', () => {
    const result = parseCommand('DIR=/tmp/build && cd $DIR && ls');
    const ls = result.commands.find(c => c.command === 'ls');
    expect(ls?.effectiveCwd).toBe('/tmp/build');
  });

  it('resets effectiveCwd on cd with no args', () => {
    const result = parseCommand('cd /tmp && cd && ls');
    const ls = result.commands.find(c => c.command === 'ls');
    expect(ls?.effectiveCwd).toBeUndefined();
  });

  it('resets effectiveCwd on cd -', () => {
    const result = parseCommand('cd /tmp && cd - && ls');
    const ls = result.commands.find(c => c.command === 'ls');
    expect(ls?.effectiveCwd).toBeUndefined();
  });

  it('does not set effectiveCwd before first cd in chain', () => {
    const result = parseCommand('ls && cd /tmp && rm foo');
    const ls = result.commands.find(c => c.command === 'ls');
    const rm = result.commands.find(c => c.command === 'rm');
    expect(ls?.effectiveCwd).toBeUndefined();
    expect(rm?.effectiveCwd).toBe('/tmp');
  });

  it('does not propagate effectiveCwd across pipeline', () => {
    const result = parseCommand('cd /foo | ls');
    const ls = result.commands.find(c => c.command === 'ls');
    expect(ls?.effectiveCwd).toBeUndefined();
  });

  it('does not propagate effectiveCwd across separate statements', () => {
    const result = parseCommand('cd /tmp; ls');
    const ls = result.commands.find(c => c.command === 'ls');
    expect(ls?.effectiveCwd).toBeUndefined();
  });

  it('resolves relative cd when base is known', () => {
    const result = parseCommand('cd /tmp && cd subdir && ls');
    const ls = result.commands.find(c => c.command === 'ls');
    expect(ls?.effectiveCwd).toBe('/tmp/subdir');
  });

  it('preserves inner sh -c effectiveCwd over outer chain cwd', () => {
    const result = parseCommand('cd /tmp && bash -c "cd /home && rm -rf foo"');
    const rm = result.commands.find(c => c.command === 'rm');
    expect(rm?.effectiveCwd).toBe('/home');
  });

  it('inherits outer cwd when inner sh -c has no cd', () => {
    const result = parseCommand('cd /tmp && bash -c "rm -rf foo"');
    const rm = result.commands.find(c => c.command === 'rm');
    expect(rm?.effectiveCwd).toBe('/tmp');
  });

  it('preserves multiple inner cwd changes in sh -c', () => {
    const result = parseCommand('cd /tmp && bash -c "cd /home && ls && cd /var && rm -rf foo"');
    const cmds = result.commands.filter(c => c.command !== 'cd' && c.command !== 'bash');
    const ls = cmds.find(c => c.command === 'ls');
    const rm = cmds.find(c => c.command === 'rm');
    expect(ls?.effectiveCwd).toBe('/home');
    expect(rm?.effectiveCwd).toBe('/var');
  });
});
