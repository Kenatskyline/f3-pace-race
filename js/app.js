import { UIController } from './ui/ui-controller.js';

document.addEventListener('DOMContentLoaded', () => {
  const controller = new UIController();
  controller.init();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
  }
});
