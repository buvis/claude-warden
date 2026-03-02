import { spawn, execFileSync } from 'child_process';

export interface NotifyConfig {
  notifyOnAsk: boolean;
  notifyOnDeny: boolean;
}

const TERMINAL_BUNDLE_IDS: Record<string, string> = {
  'iTerm.app': 'com.googlecode.iterm2',
  'Apple_Terminal': 'com.apple.Terminal',
  'Alacritty': 'com.github.alacritty.Alacritty',
  'WezTerm': 'io.wezfurlong.wezterm',
};

let terminalNotifierAvailable: boolean | null = null;

function hasTerminalNotifier(): boolean {
  if (terminalNotifierAvailable !== null) return terminalNotifierAvailable;
  try {
    execFileSync('which', ['terminal-notifier'], { stdio: 'ignore' });
    terminalNotifierAvailable = true;
  } catch {
    terminalNotifierAvailable = false;
  }
  return terminalNotifierAvailable;
}

export function getBundleId(): string | undefined {
  const termProgram = process.env.TERM_PROGRAM;
  if (!termProgram) return undefined;
  return TERMINAL_BUNDLE_IDS[termProgram];
}

export function buildNotifyCommand(title: string, message: string): { cmd: string; args: string[] } | null {
  const platform = process.platform;

  if (platform === 'darwin') {
    if (hasTerminalNotifier()) {
      const args = ['-title', title, '-message', message];
      const bundleId = getBundleId();
      if (bundleId) {
        args.push('-activate', bundleId);
      }
      return { cmd: 'terminal-notifier', args };
    }
    // osascript fallback
    const script = `display notification ${JSON.stringify(message)} with title ${JSON.stringify(title)}`;
    return { cmd: 'osascript', args: ['-e', script] };
  }

  if (platform === 'linux') {
    return { cmd: 'notify-send', args: [title, message] };
  }

  return null;
}

export function sendNotification(title: string, message: string, config: NotifyConfig): void {
  try {
    const notifyCmd = buildNotifyCommand(title, message);
    if (!notifyCmd) return;

    const child = spawn(notifyCmd.cmd, notifyCmd.args, {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();
  } catch {
    // Notification failure must never affect the hook decision
  }
}

/** Reset cached terminal-notifier detection (for testing) */
export function _resetCache(): void {
  terminalNotifierAvailable = null;
}
