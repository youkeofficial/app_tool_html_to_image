import puppeteer from 'puppeteer';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.setContent('<html><body><h1>Hello</h1></body></html>');

  const recorder = new PuppeteerScreenRecorder(page, {
      fps: 30,
      videoFrame: { width: 1280, height: 720 },
      videoCrf: 18,
      videoCodec: 'libx264',
      videoPreset: 'ultrafast',
      videoBitrate: 1000,
      autopad: { color: 'black' }
  });

  await recorder.start('test.mp4');
  await new Promise(resolve => setTimeout(resolve, 2000));
  await recorder.stop();

  await browser.close();
  console.log('done');
})();
