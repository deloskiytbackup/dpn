export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export class Spinner {
  private text: string;
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private frameIndex = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(text: string) {
    this.text = text;
  }

  public start() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const spinner = this.spinnerFrames[this.frameIndex % this.spinnerFrames.length];
      this.frameIndex++;
      const cyan = '\x1b[36m';
      const reset = '\x1b[0m';
      if (process.stdout.isTTY) {
        process.stdout.write(`\r\x1b[K[dpn] ${cyan}${spinner}${reset} ${this.text}`);
      }
    }, 80);
  }

  public updateText(text: string) {
    this.text = text;
  }

  public stop(successMessage?: string) {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (process.stdout.isTTY) {
      if (successMessage) {
        process.stdout.write(`\r\x1b[K[dpn] \x1b[32m✔\x1b[0m ${successMessage}\n`);
      } else {
        process.stdout.write(`\r\x1b[K`);
      }
    }
  }
}

export class ProgressBar {
  private total: number;
  private current: number = 0;
  private width: number = 20;
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private frameIndex = 0;

  constructor(total: number) {
    this.total = Math.max(total, 1);
  }

  public update(completed: number, actionText: string, downloadedBytes: number = 0, speedBps: number = 0) {
    this.current = completed;
    const ratio = Math.min(Math.max(this.current / this.total, 0), 1);
    const filledLength = Math.round(this.width * ratio);
    const emptyLength = this.width - filledLength;

    const spinner = this.spinnerFrames[this.frameIndex % this.spinnerFrames.length];
    this.frameIndex++;

    const filledBar = '█'.repeat(filledLength);
    const emptyBar = '░'.repeat(emptyLength);
    const percentage = Math.round(ratio * 100);

    const text = actionText.length > 30 ? actionText.slice(0, 27) + '...' : actionText;

    const cyan = '\x1b[36m';
    const green = '\x1b[32m';
    const gray = '\x1b[90m';
    const yellow = '\x1b[33m';
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';

    const barStr = `${green}${filledBar}${gray}${emptyBar}${reset}`;
    const spinnerStr = `${cyan}${spinner}${reset}`;
    const percentStr = `${bold}${percentage}%${reset}`;

    let statsStr = '';
    if (downloadedBytes > 0) {
      const bytesStr = formatBytes(downloadedBytes);
      const speedStr = speedBps > 0 ? `${formatBytes(speedBps)}/s` : '';
      statsStr = ` | ${yellow}${bytesStr}${reset} (${cyan}${speedStr}${reset})`;
    }

    const message = `[dpn] ${spinnerStr} [${barStr}] ${percentStr} (${this.current}/${this.total})${statsStr} ${text}`;

    if (process.stdout.isTTY) {
      process.stdout.write(`\r\x1b[K${message}`);
    } else {
      console.log(`[dpn] [${filledBar}${emptyBar}] ${percentage}% (${this.current}/${this.total}) ${text}`);
    }
  }

  public finish(successText?: string, totalBytes: number = 0) {
    const green = '\x1b[32m';
    const yellow = '\x1b[33m';
    const reset = '\x1b[0m';
    const filledBar = '█'.repeat(this.width);
    if (process.stdout.isTTY) {
      const bytesInfo = totalBytes > 0 ? ` | Rozmiar: ${yellow}${formatBytes(totalBytes)}${reset}` : '';
      const msg = successText || `Pobieranie zakończone (${this.total}/${this.total})`;
      process.stdout.write(`\r\x1b[K[dpn] ${green}✔ [${filledBar}] 100% (${this.total}/${this.total})${bytesInfo} ${msg}${reset}\n`);
    } else if (successText) {
      console.log(`[dpn] ✔ ${successText}`);
    }
  }
}
