const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    console.log('Browser launched successfully!');
    await browser.close();
})();
