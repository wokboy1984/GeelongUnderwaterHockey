const { chromium } = require('playwright');

const BASE = 'http://localhost:8731';
const ROUTES = [
  '/#/',
  '/#/new-player',
  '/#/how-it-works',
  '/#/wednesday-games',
  '/#/about',
  '/#/news',
  '/#/portal',
];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox', '--proxy-server=http://127.0.0.1:40143', '--ignore-certificate-errors'] });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push('[console] ' + msg.text()); });
  page.on('pageerror', (err) => errors.push('[pageerror] ' + err.message));

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    const title = await page.title();
    console.log('OK', route, '->', title);
  }

  // Screenshot home desktop
  await page.goto(BASE + '/#/', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/home/claude/guwh-concept/test/shot-home-desktop.png', fullPage: true });

  // New player form fill + submit
  await page.goto(BASE + '/#/new-player', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/home/claude/guwh-concept/test/shot-newplayer-desktop.png', fullPage: true });

  // Member portal: log in as player
  await page.goto(BASE + '/#/portal', { waitUntil: 'networkidle' });
  await page.getByText('Alex Chen').click();
  await page.waitForTimeout(200);
  console.log('after login url:', page.url());
  await page.screenshot({ path: '/home/claude/guwh-concept/test/shot-dashboard-desktop.png', fullPage: true });

  // Book a game
  await page.goto(BASE + '/#/portal/book', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/home/claude/guwh-concept/test/shot-book-desktop.png', fullPage: true });

  // Game board
  await page.goto(BASE + '/#/portal/board', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/home/claude/guwh-concept/test/shot-board-desktop.png', fullPage: true });

  // Bring a mate
  await page.goto(BASE + '/#/portal/bring-a-mate', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/home/claude/guwh-concept/test/shot-bam-desktop.png', fullPage: true });

  // Profile
  await page.goto(BASE + '/#/portal/profile', { waitUntil: 'networkidle' });
  await page.screenshot({ path: '/home/claude/guwh-concept/test/shot-profile-desktop.png', fullPage: true });

  // Logout, log in as organiser
  await page.evaluate(() => { GUWH.Store.logout(); });
  await page.goto(BASE + '/#/portal', { waitUntil: 'networkidle' });
  await page.getByText('Stu McCallum').click();
  await page.waitForTimeout(200);
  console.log('organiser url:', page.url());
  await page.screenshot({ path: '/home/claude/guwh-concept/test/shot-organiser-attendance.png', fullPage: true });

  await page.goto(BASE + '/#/organiser/teams', { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  await page.screenshot({ path: '/home/claude/guwh-concept/test/shot-organiser-teams.png', fullPage: true });

  // Try the "Suggest balanced teams" button
  await page.getByText('Suggest balanced teams').click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: '/home/claude/guwh-concept/test/shot-organiser-teams-suggested.png', fullPage: true });

  await page.goto(BASE + '/#/organiser/publish', { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  await page.screenshot({ path: '/home/claude/guwh-concept/test/shot-organiser-publish.png', fullPage: true });

  // Mobile viewport pass on a few key pages
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mpage = await mobile.newPage();
  mpage.on('console', (msg) => { if (msg.type() === 'error') errors.push('[mobile console] ' + msg.text()); });
  mpage.on('pageerror', (err) => errors.push('[mobile pageerror] ' + err.message));
  await mpage.goto(BASE + '/#/', { waitUntil: 'networkidle' });
  await mpage.screenshot({ path: '/home/claude/guwh-concept/test/shot-home-mobile.png', fullPage: true });
  await mpage.goto(BASE + '/#/new-player', { waitUntil: 'networkidle' });
  await mpage.screenshot({ path: '/home/claude/guwh-concept/test/shot-newplayer-mobile.png', fullPage: true });
  await mpage.goto(BASE + '/#/wednesday-games', { waitUntil: 'networkidle' });
  await mpage.screenshot({ path: '/home/claude/guwh-concept/test/shot-board-mobile.png', fullPage: true });

  await browser.close();

  console.log('\n--- ERRORS (' + errors.length + ') ---');
  errors.forEach((e) => console.log(e));
  process.exit(errors.length ? 1 : 0);
})();
