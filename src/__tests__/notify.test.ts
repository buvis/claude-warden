import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBundleId, buildNotifyCommand, sendNotification, _resetCache } from '../notify';
import * as cp from 'child_process';

vi.mock('child_process', () => ({
  execFileSync: vi.fn(),
  spawn: vi.fn(() => ({ unref: vi.fn() })),
}));

const mockedExecFileSync = vi.mocked(cp.execFileSync);
const mockedSpawn = vi.mocked(cp.spawn);

beforeEach(() => {
  _resetCache();
  vi.clearAllMocks();
});

describe('getBundleId', () => {
  const originalEnv = process.env.TERM_PROGRAM;
  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TERM_PROGRAM = originalEnv;
    } else {
      delete process.env.TERM_PROGRAM;
    }
  });

  it('returns iTerm2 bundle ID', () => {
    process.env.TERM_PROGRAM = 'iTerm.app';
    expect(getBundleId()).toBe('com.googlecode.iterm2');
  });

  it('returns Terminal.app bundle ID', () => {
    process.env.TERM_PROGRAM = 'Apple_Terminal';
    expect(getBundleId()).toBe('com.apple.Terminal');
  });

  it('returns Alacritty bundle ID', () => {
    process.env.TERM_PROGRAM = 'Alacritty';
    expect(getBundleId()).toBe('com.github.alacritty.Alacritty');
  });

  it('returns WezTerm bundle ID', () => {
    process.env.TERM_PROGRAM = 'WezTerm';
    expect(getBundleId()).toBe('io.wezfurlong.wezterm');
  });

  it('returns undefined for unknown terminal', () => {
    process.env.TERM_PROGRAM = 'SomeTerminal';
    expect(getBundleId()).toBeUndefined();
  });

  it('returns undefined when TERM_PROGRAM is not set', () => {
    delete process.env.TERM_PROGRAM;
    expect(getBundleId()).toBeUndefined();
  });
});

describe('buildNotifyCommand', () => {
  const originalPlatform = process.platform;
  const originalEnv = process.env.TERM_PROGRAM;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    if (originalEnv !== undefined) {
      process.env.TERM_PROGRAM = originalEnv;
    } else {
      delete process.env.TERM_PROGRAM;
    }
  });

  describe('macOS with terminal-notifier', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      mockedExecFileSync.mockReturnValue(Buffer.from('/usr/local/bin/terminal-notifier'));
    });

    it('builds terminal-notifier command with activate flag', () => {
      process.env.TERM_PROGRAM = 'iTerm.app';
      const result = buildNotifyCommand('Title', 'Message');
      expect(result).toEqual({
        cmd: 'terminal-notifier',
        args: ['-title', 'Title', '-message', 'Message', '-activate', 'com.googlecode.iterm2'],
      });
    });

    it('builds terminal-notifier command without activate for unknown terminal', () => {
      delete process.env.TERM_PROGRAM;
      const result = buildNotifyCommand('Title', 'Message');
      expect(result).toEqual({
        cmd: 'terminal-notifier',
        args: ['-title', 'Title', '-message', 'Message'],
      });
    });
  });

  describe('macOS with osascript fallback', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'darwin' });
      mockedExecFileSync.mockImplementation(() => { throw new Error('not found'); });
    });

    it('builds osascript command', () => {
      const result = buildNotifyCommand('Title', 'Message');
      expect(result).toEqual({
        cmd: 'osascript',
        args: ['-e', 'display notification "Message" with title "Title"'],
      });
    });
  });

  describe('Linux', () => {
    beforeEach(() => {
      Object.defineProperty(process, 'platform', { value: 'linux' });
    });

    it('builds notify-send command', () => {
      const result = buildNotifyCommand('Title', 'Message');
      expect(result).toEqual({
        cmd: 'notify-send',
        args: ['Title', 'Message'],
      });
    });
  });

  describe('unsupported platform', () => {
    it('returns null on Windows', () => {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const result = buildNotifyCommand('Title', 'Message');
      expect(result).toBeNull();
    });
  });
});

describe('sendNotification', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('spawns notification process detached', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    sendNotification('Title', 'Msg', { notifyOnAsk: true, notifyOnDeny: true });
    expect(mockedSpawn).toHaveBeenCalledWith('notify-send', ['Title', 'Msg'], {
      detached: true,
      stdio: 'ignore',
    });
  });

  it('does not throw on spawn error', () => {
    Object.defineProperty(process, 'platform', { value: 'linux' });
    mockedSpawn.mockImplementation(() => { throw new Error('spawn failed'); });
    expect(() => {
      sendNotification('Title', 'Msg', { notifyOnAsk: true, notifyOnDeny: true });
    }).not.toThrow();
  });

  it('does nothing on unsupported platform', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });
    sendNotification('Title', 'Msg', { notifyOnAsk: true, notifyOnDeny: true });
    expect(mockedSpawn).not.toHaveBeenCalled();
  });

  it('caches terminal-notifier detection', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    mockedExecFileSync.mockImplementation(() => { throw new Error('not found'); });

    buildNotifyCommand('T1', 'M1');
    buildNotifyCommand('T2', 'M2');

    // which should only be called once due to caching
    expect(mockedExecFileSync).toHaveBeenCalledTimes(1);
  });
});
