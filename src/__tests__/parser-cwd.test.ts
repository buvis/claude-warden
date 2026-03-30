import { describe, it, expect } from 'vitest';
import { parseCommand } from '../parser';

describe('parseCommand', () => {
  describe('chain cwd tracking', () => {
    // --- Basic cd /absolute → effectiveCwd ---

    it('stamps effectiveCwd on commands after cd /absolute in chain', () => {
      const result = parseCommand('cd /tmp && rm -rf foo');
      expect(result.parseError).toBe(false);
      const rm = result.commands.find(c => c.command === 'rm');
      expect(rm?.effectiveCwd).toBe('/tmp');
      // Also verify the cd command itself does NOT get effectiveCwd
      // (it runs before the cwd changes take effect for subsequent commands)
      const cd = result.commands.find(c => c.command === 'cd');
      expect(cd?.effectiveCwd).toBeUndefined();
    });

    it('stamps effectiveCwd on all commands after cd, not just the next one', () => {
      const result = parseCommand('cd /tmp && mkdir test && rm -rf .git');
      expect(result.parseError).toBe(false);
      const mkdir = result.commands.find(c => c.command === 'mkdir');
      const rm = result.commands.find(c => c.command === 'rm');
      expect(mkdir?.effectiveCwd).toBe('/tmp');
      expect(rm?.effectiveCwd).toBe('/tmp');
    });

    // --- Sequential cd commands (nested cd) ---

    it('resolves nested cd commands by stacking paths', () => {
      const result = parseCommand('cd /tmp && mkdir test && cd test && rm -rf .git');
      expect(result.parseError).toBe(false);
      const mkdir = result.commands.find(c => c.command === 'mkdir');
      const rm = result.commands.find(c => c.command === 'rm');
      // mkdir runs after first cd but before second cd
      expect(mkdir?.effectiveCwd).toBe('/tmp');
      // rm runs after cd test (relative to /tmp)
      expect(rm?.effectiveCwd).toBe('/tmp/test');
    });

    it('handles second absolute cd overriding first', () => {
      const result = parseCommand('cd /tmp && cd /var && ls');
      const ls = result.commands.find(c => c.command === 'ls');
      expect(ls?.effectiveCwd).toBe('/var');
    });

    // --- Relative cd ---

    it('resolves relative cd when base is known from prior absolute cd', () => {
      const result = parseCommand('cd /tmp && cd subdir && ls');
      const ls = result.commands.find(c => c.command === 'ls');
      expect(ls?.effectiveCwd).toBe('/tmp/subdir');
    });

    it('does not set effectiveCwd when first cd is relative with no known base', () => {
      const result = parseCommand('cd relative && ls');
      const ls = result.commands.find(c => c.command === 'ls');
      expect(ls?.effectiveCwd).toBeUndefined();
    });

    it('resolves deeply nested relative paths', () => {
      const result = parseCommand('cd /home && cd user && cd project && ls');
      const ls = result.commands.find(c => c.command === 'ls');
      expect(ls?.effectiveCwd).toBe('/home/user/project');
    });

    // --- cd with chain-assigned variable ---

    it('resolves cd $VAR where VAR is a chain-assigned absolute path', () => {
      const result = parseCommand('DIR=/tmp/build && cd $DIR && rm -rf foo');
      const rm = result.commands.find(c => c.command === 'rm');
      expect(rm?.effectiveCwd).toBe('/tmp/build');
    });

    it('resolves cd ${VAR} brace syntax for chain-assigned variable', () => {
      const result = parseCommand('DIR=/opt/app && cd ${DIR} && ls');
      const ls = result.commands.find(c => c.command === 'ls');
      expect(ls?.effectiveCwd).toBe('/opt/app');
    });

    it('resolves cd $VAR as relative when variable value is relative', () => {
      const result = parseCommand('cd /tmp && SUBDIR=mydir && cd $SUBDIR && ls');
      const ls = result.commands.find(c => c.command === 'ls');
      expect(ls?.effectiveCwd).toBe('/tmp/mydir');
    });

    // --- cd with no args / dynamic args / - → reset ---

    it('resets effectiveCwd on cd with no args', () => {
      const result = parseCommand('cd /tmp && cd && rm -rf foo');
      const rm = result.commands.find(c => c.command === 'rm');
      expect(rm?.effectiveCwd).toBeUndefined();
    });

    it('resets effectiveCwd on cd -', () => {
      const result = parseCommand('cd /tmp && cd - && rm -rf foo');
      const rm = result.commands.find(c => c.command === 'rm');
      expect(rm?.effectiveCwd).toBeUndefined();
    });

    it('resets effectiveCwd on cd with dynamic variable', () => {
      const result = parseCommand('DEST=$(pwd) && cd $DEST && ls');
      const ls = result.commands.find(c => c.command === 'ls');
      // DEST is dynamic (from command substitution), so cd target is unknown
      expect(ls?.effectiveCwd).toBeUndefined();
    });

    // --- No cd in chain ---

    it('leaves effectiveCwd undefined when no cd in chain', () => {
      const result = parseCommand('rm -rf foo');
      const rm = result.commands.find(c => c.command === 'rm');
      expect(rm?.effectiveCwd).toBeUndefined();
    });

    it('leaves effectiveCwd undefined for all commands when no cd present', () => {
      const result = parseCommand('mkdir -p dir && touch dir/file && ls dir');
      for (const cmd of result.commands) {
        expect(cmd.effectiveCwd).toBeUndefined();
      }
    });

    // --- Commands before cd should not get effectiveCwd ---

    it('does not set effectiveCwd on commands before the cd', () => {
      const result = parseCommand('ls && cd /tmp && rm foo');
      const ls = result.commands.find(c => c.command === 'ls');
      const rm = result.commands.find(c => c.command === 'rm');
      expect(ls?.effectiveCwd).toBeUndefined();
      expect(rm?.effectiveCwd).toBe('/tmp');
    });

    // --- Scope boundaries: only within AndOr chains ---

    it('does not propagate effectiveCwd across semicolon-separated statements', () => {
      const result = parseCommand('cd /tmp; ls');
      const ls = result.commands.find(c => c.command === 'ls');
      expect(ls?.effectiveCwd).toBeUndefined();
    });

    it('does not propagate effectiveCwd across pipeline boundaries', () => {
      const result = parseCommand('cd /foo | ls');
      const ls = result.commands.find(c => c.command === 'ls');
      expect(ls?.effectiveCwd).toBeUndefined();
    });

    // --- Intermediate commands get correct effectiveCwd at their point ---

    it('gives intermediate commands the effectiveCwd at their point in the chain', () => {
      const result = parseCommand('cd /tmp && echo hello && cd /var && echo world');
      // Find echos by position since both have command 'echo'
      const echos = result.commands.filter(c => c.command === 'echo');
      expect(echos).toHaveLength(2);
      expect(echos[0].effectiveCwd).toBe('/tmp');
      expect(echos[1].effectiveCwd).toBe('/var');
    });

    // --- Recovery after reset ---

    it('allows re-establishing effectiveCwd after reset', () => {
      const result = parseCommand('cd /tmp && cd && cd /var && ls');
      const ls = result.commands.find(c => c.command === 'ls');
      expect(ls?.effectiveCwd).toBe('/var');
    });

    it('relative cd after reset does not set effectiveCwd', () => {
      const result = parseCommand('cd /tmp && cd - && cd subdir && ls');
      const ls = result.commands.find(c => c.command === 'ls');
      // After cd - the base is unknown, so cd subdir can't resolve
      expect(ls?.effectiveCwd).toBeUndefined();
    });

    // --- cd itself should not carry the new cwd (it runs before the change) ---

    it('cd commands themselves do not get their own target as effectiveCwd', () => {
      const result = parseCommand('cd /tmp && cd /var && ls');
      const cds = result.commands.filter(c => c.command === 'cd');
      // First cd has no prior cwd
      expect(cds[0].effectiveCwd).toBeUndefined();
      // Second cd runs while cwd is /tmp
      expect(cds[1].effectiveCwd).toBe('/tmp');
    });

    // --- Or-chains (||) should also track cwd ---

    it('tracks cwd across || chains', () => {
      const result = parseCommand('cd /tmp && false || ls');
      // This is an AndOr chain - ls should still see the cwd from cd
      const ls = result.commands.find(c => c.command === 'ls');
      expect(ls?.effectiveCwd).toBe('/tmp');
    });

    // --- Path with trailing slash ---

    it('handles cd to path with trailing slash', () => {
      const result = parseCommand('cd /tmp/ && ls');
      const ls = result.commands.find(c => c.command === 'ls');
      // Trailing slash preserved as-is from the argument
      expect(ls?.effectiveCwd).toBe('/tmp/');
    });
  });
});
