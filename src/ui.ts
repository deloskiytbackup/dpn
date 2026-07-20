export class ProgressBar {
  private total: number;
  private current: number = 0;
  private width: number = 24;

  constructor(total: number) {
    this.total = Math.max(total, 1);
  }

  public update(completed: number, actionText: string) {
    this.current = completed;
    const ratio = Math.min(Math.max(this.current / this.total, 0), 1);
    const filledLength = Math.round(this.width * ratio);
    const emptyLength = this.width - filledLength;

    const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);
    const percentage = Math.round(ratio * 100);

    const text = actionText.length > 35 ? actionText.slice(0, 32) + '...' : actionText;
    const message = `[dpn] [${bar}] ${percentage}% (${this.current}/${this.total}) ${text}`;

    if (process.stdout.isTTY) {
      process.stdout.write(`\r\x1b[K${message}`);
    } else {
      console.log(message);
    }
  }

  public finish() {
    if (process.stdout.isTTY) {
      process.stdout.write(`\r\x1b[K`);
    }
  }
}
