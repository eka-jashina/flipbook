/**
 * BACKGROUND MANAGER
 * Управление фоновыми изображениями с кроссфейдом.
 */

export class BackgroundManager {
  constructor() {
    this.backgrounds = document.querySelectorAll(".chapter-bg .bg");
    this.currentBg = null;
    this.activeIndex = 0;
  }

  setBackground(url) {
    if (this.currentBg === url) return;
    this.currentBg = url;

    const nextIndex = (this.activeIndex + 1) % this.backgrounds.length;
    const incoming = this.backgrounds[nextIndex];
    const outgoing = this.backgrounds[this.activeIndex];

    incoming.style.backgroundImage = `url(${url})`;
    incoming.dataset.active = "true";
    outgoing.dataset.active = "false";

    this.activeIndex = nextIndex;
  }

  destroy() {
    this.backgrounds = null;
    this.currentBg = null;
  }
}
