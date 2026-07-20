export class ProgressBar {
  private total: number;
  private current: number = 0;
  private width: number = 24;
  private spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private frameIndex = 0;

  constructor(total: number) {
    this.total = Math.max(total, 1);
  }

  public update(completed: number, actionText: string) {
    this.current = completed;
    const ratio = Math.min(Math.max(this.current / this.total, 0), 1);
    const filledLength = Math.round(this.width * ratio);
    const emptyLength = this.width - filledLength;

    const spinner = this.spinnerFrames[this.frameIndex % this.spinnerFrames.length];
    this.frameIndex++;

    const filledBar = '█'.repeat(filledLength);
    const emptyBar = '░'.repeat(emptyLength);
    const percentage = Math.round(ratio * 100);

    const text = actionText.length > 35 ? actionText.slice(0, 32) + '...' : actionText;

    // Kolorowy i animowany pasek (ANSI escape codes)
    const cyan = '\x1b[36m';
    const green = '\x1b[32m';
    const gray = '\x1b[90m';
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';

    const barStr = `${green}${filledBar}${gray}${emptyBar}${reset}`;
    const spinnerStr = `${cyan}${spinner}${reset}`;
    const percentStr = `${bold}${percentage}%${reset}`;

    const message = `[dpn] ${spinnerStr} [${barStr}] ${percentStr} (${this.current}/${this.total}) ${text}`;

    if (process.stdout.isTTY) {
      process.stdout.write(`\r\x1b[K${message}`);
    } else {
      console.log(`[dpn] [${filledBar}${emptyBar}] ${percentage}% (${this.current}/${this.total}) ${text}`);
    }
  }

  public finish() {
    if (process.stdout.isTTY) {
      process.stdout.write(`\r\x1b[K`);
    }
  }
}
