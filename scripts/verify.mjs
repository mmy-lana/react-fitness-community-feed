#!/usr/bin/env node
/**
 * Headless verification harness.
 *
 * Boots the app, drives it with headless Chrome and asserts real behaviour.
 * Two servers are used on purpose:
 *
 *   - `vite dev`      → module suite: TS sources are importable from the page,
 *                       so domain logic is asserted against the live bundle.
 *   - `vite preview`  → UI suites: the real production build, so what is
 *                       tested is what ships.
 *
 * Usage:
 *   node scripts/verify.mjs                    # every suite
 *   node scripts/verify.mjs --suite=ui         # one suite
 *   node scripts/verify.mjs --url=http://…     # test an already running server
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import puppeteer from 'puppeteer-core';

const ROOT = resolve(import.meta.dirname, '..');
const ARTIFACTS = join(ROOT, '.artifacts');
const DEV_PORT = 4318;
const PREVIEW_PORT = 4319;
const DEV_URL = `http://localhost:${DEV_PORT}/`;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}/`;

const args = process.argv.slice(2);
const suiteArg = args.find((a) => a.startsWith('--suite='))?.slice('--suite='.length);
const urlArg = args.find((a) => a.startsWith('--url='))?.slice('--url='.length);

const ALL_SUITES = ['modules', 'ui', 'responsive', 'interactions'];
const suites = suiteArg ? suiteArg.split(',') : ALL_SUITES;

/** Viewport matrix from the plan's acceptance criteria. */
const VIEWPORTS = [
  { name: '360-mobile', width: 360, height: 740 },
  { name: '390-mobile', width: 390, height: 844 },
  { name: '430-mobile', width: 430, height: 932 },
  { name: '768-tablet', width: 768, height: 1024 },
  { name: '1024-tablet', width: 1024, height: 768 },
  { name: '1440-desktop', width: 1440, height: 900 },
];

/**
 * Noise the harness provokes on purpose: the throwing-updater check drives the
 * store's catch block, which logs before it recovers.
 */
const EXPECTED_NOISE = [/Storage write error \(activities\):/];

/* ------------------------------------------------------------------ utils */

const failures = [];
const passes = [];
const consoleIssues = [];
const expectedIssues = [];

function check(label, condition, detail = '') {
  if (condition) {
    passes.push(label);
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function equal(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  check(label, ok, ok ? '' : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function resolveChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ].filter(Boolean);

  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(`No Chrome binary found. Set CHROME_PATH. Tried:\n${candidates.join('\n')}`);
  }
  return found;
}

async function waitForServer(url, timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not become ready: ${url}`);
}

function startServer(serverArgs, readyUrl) {
  const child = spawn('node', [join(ROOT, 'node_modules/vite/bin/vite.js'), ...serverArgs], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', () => {});
  child.stderr.on('data', (d) => consoleIssues.push({ type: 'server', text: String(d).trim() }));
  return { child, ready: waitForServer(readyUrl) };
}

function watchPage(page) {
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      const text = msg.text();
      if (text.includes('Download the React DevTools')) return;
      consoleIssues.push({ type, text });
    }
  });
  page.on('pageerror', (err) => consoleIssues.push({ type: 'pageerror', text: String(err) }));
  page.on('response', (res) => {
    if (res.status() >= 400) {
      consoleIssues.push({ type: 'http', text: `${res.status()} ${res.url()}` });
    }
  });
  page.on('requestfailed', (req) =>
    consoleIssues.push({
      type: 'requestfailed',
      text: `${req.url()} ${req.failure()?.errorText ?? ''}`,
    })
  );
}

async function launchBrowser() {
  return puppeteer.launch({
    executablePath: resolveChrome(),
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb'],
  });
}

async function newPage(browser, viewport) {
  const page = await browser.newPage();
  await page.setViewport({ deviceScaleFactor: 2, ...viewport });
  watchPage(page);
  return page;
}

async function shot(page, name) {
  mkdirSync(ARTIFACTS, { recursive: true });
  const path = join(ARTIFACTS, `${name}.png`);
  await page.screenshot({ path });
  return path;
}

/** Page-object helpers: everything resolves the *visible* match, never a hidden duplicate. */
function pageOps(page) {
  const resolveVisible = (selector, index = 0) =>
    page.evaluateHandle(
      (sel, idx) => {
        const visible = [...document.querySelectorAll(sel)].filter((el) => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        });
        return visible[idx] ?? null;
      },
      selector,
      index
    );

  const require = async (selector, index) => {
    const handle = await resolveVisible(selector, index);
    const element = handle.asElement();
    if (!element) throw new Error(`No visible element matches ${selector} (index ${index})`);
    await page.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }), element);
    return element;
  };

  return {
    click: async (selector, index = 0) => {
      const element = await require(selector, index);
      await element.click();
    },
    type: async (selector, text) => {
      const element = await require(selector);
      await element.click({ clickCount: 3 });
      await element.type(text, { delay: 4 });
    },
    select: async (selector, value) => {
      const element = await require(selector);
      await element.select(value);
    },
    clear: async (selector) => {
      const element = await require(selector);
      await element.focus();
      // Select the whole value explicitly: select-all shortcuts are unreliable headless.
      await element.evaluate((el) => el.setSelectionRange?.(0, el.value.length));
      await page.keyboard.press('Backspace');
    },
    attr: async (selector, name) =>
      page.evaluate(
        (sel, attrName) => document.querySelector(sel)?.getAttribute(attrName) ?? null,
        selector,
        name
      ),
    /** Live DOM property — `value` on inputs/selects is not an attribute. */
    prop: async (selector, name) =>
      page.evaluate((sel, propName) => {
        const el = document.querySelector(sel);
        return el ? Reflect.get(el, propName) ?? null : null;
      }, selector, name),
    clickText: async (containerSelector, label) => {
      const handle = await page.evaluateHandle(
        (sel, text) => {
          const root = document.querySelector(sel);
          if (!root) return null;
          return (
            [...root.querySelectorAll('button, a[href]')].find(
              (el) =>
                (el.textContent ?? '').trim() === text &&
                el.checkVisibility({ visibilityProperty: true })
            ) ?? null
          );
        },
        containerSelector,
        label
      );
      const element = handle.asElement();
      if (!element) throw new Error(`No visible "${label}" inside ${containerSelector}`);
      await element.click();
      return element;
    },
    count: (selector) => page.$$eval(selector, (els) => els.length).catch(() => 0),
    exists: async (selector) => (await page.$(selector)) !== null,
  };
}

/** Presses and releases on the dialog itself, the way a backdrop tap arrives. */
async function tapBackdrop(page) {
  await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]');
    if (!dialog) return;
    dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    dialog.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/* ----------------------------------------------------------- module suite */

async function runModuleSuite(browser, baseUrl) {
  console.log('\n▸ modules (vite dev, live TS imports)');
  const page = await newPage(browser, { width: 1280, height: 900 });
  await page.goto(baseUrl, { waitUntil: 'networkidle2' });

  const result = await page.evaluate(async () => {
    const [telemetry, formatters, routes, dates, athletes, store, social] = await Promise.all([
      import('/src/utils/telemetryMath.ts'),
      import('/src/utils/formatters.ts'),
      import('/src/utils/routeGenerator.ts'),
      import('/src/utils/dateHelpers.ts'),
      import('/src/utils/seedAthletes.ts'),
      import('/src/services/storageStore.ts'),
      import('/src/hooks/useSocial.ts'),
    ]);

    const out = {};
    const latSpan = (pts) => {
      let min = Infinity;
      let max = -Infinity;
      for (const p of pts) {
        if (p.latitude < min) min = p.latitude;
        if (p.latitude > max) max = p.latitude;
      }
      return max - min;
    };

    /* --- projection ---------------------------------------------------- */
    const emptyProjection = telemetry.projectCoordinates([], 480, 220);
    out.emptyProjection = emptyProjection;

    const track = routes.generateSyntheticRoute('climb', 10000, 300, 7);
    const proj = telemetry.projectCoordinates(track, 480, 220, 24);
    out.pathStartsWithMove = proj.pathD.startsWith('M ');
    out.allPointsInViewport = proj.points.every((p) => p.x >= 0 && p.x <= 480 && p.y >= 0 && p.y <= 220);
    out.hasStartEnd = Boolean(proj.startPoint && proj.endPoint);
    out.segmentCount = proj.points.length;

    // A single degenerate point must not produce NaN.
    const single = telemetry.projectCoordinates(
      [{ latitude: 10, longitude: 10, elevationMeters: 0, timestampOffsetSeconds: 0 }],
      480,
      220
    );
    out.singlePointFinite = single.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    /* --- haversine ----------------------------------------------------- */
    out.zeroDistance = telemetry.haversineMeters(37.7749, -122.4194, 37.7749, -122.4194);
    out.oneDegreeLat = telemetry.haversineMeters(0, 0, 1, 0);

    /* --- elevation profile --------------------------------------------- */
    const profile = telemetry.deriveElevationProfile(track);
    out.profileFirst = profile[0];
    out.profileMatchesTrackLength = profile.length === track.length;
    out.profileMonotonicDistance = profile.every(
      (p, i) => i === 0 || p.distanceMeters >= profile[i - 1].distanceMeters
    );
    out.profileEmptyForEmptyTrack = telemetry.deriveElevationProfile([]).length;

    /* --- calories ------------------------------------------------------ */
    out.caloriesZeroDuration = telemetry.calculateCalories(0, 'run');
    out.caloriesZeroWeight = telemetry.calculateCalories(3600, 'run', 0);
    out.caloriesRunHour = telemetry.calculateCalories(3600, 'run');
    out.caloriesRideHour = telemetry.calculateCalories(3600, 'ride');

    /* --- routes -------------------------------------------------------- */
    out.stationary = routes.generateSyntheticRoute('stationary', 5000, 0, 1).length;
    out.zeroDistanceRoute = routes.generateSyntheticRoute('loop', 0, 0, 1).length;
    const a = routes.generateSyntheticRoute('loop', 20000, 400, 99);
    out.deterministic =
      JSON.stringify(a) === JSON.stringify(routes.generateSyntheticRoute('loop', 20000, 400, 99));
    out.loopCloseDelta = Math.max(
      Math.abs(a[0].latitude - a[a.length - 1].latitude),
      Math.abs(a[0].longitude - a[a.length - 1].longitude)
    );
    out.maxPoints = routes.generateSyntheticRoute('loop', 500000, 0, 5).length;
    out.minPoints = routes.generateSyntheticRoute('loop', 10, 0, 5).length;
    out.distanceScales = {
      short: latSpan(routes.generateSyntheticRoute('climb', 5000, 0, 3)),
      long: latSpan(routes.generateSyntheticRoute('climb', 50000, 0, 3)),
    };
    out.timestampsMonotonic = a.every(
      (p, i) => i === 0 || p.timestampOffsetSeconds >= a[i - 1].timestampOffsetSeconds
    );
    out.noNegativeElevation = a.every((p) => p.elevationMeters >= 0);

    /* --- dates --------------------------------------------------------- */
    const weekStart = dates.getStartOfWeek(new Date(2026, 0, 7, 13, 45)); // Wednesday
    out.weekStartDay = new Date(weekStart).getDay();
    out.weekStartClock = [new Date(weekStart).getHours(), new Date(weekStart).getMinutes()];
    out.sundayStartDay = new Date(dates.getStartOfWeek(new Date(2026, 0, 4, 13, 45))).getDay(); // Sunday
    out.mondayStartDay = new Date(dates.getStartOfWeek(new Date(2026, 0, 5, 13, 45))).getDay(); // Monday
    out.monthStartIso = new Date(dates.getStartOfMonth(new Date(2026, 1, 17, 9))).toString().slice(0, 15);
    out.weekIsMonotonic = dates.getStartOfWeek() <= dates.getStartOfMonth();

    /* --- directory ----------------------------------------------------- */
    out.knownAthlete = athletes.getAthlete('user-02').fullName;
    out.unknownAthlete = athletes.getAthlete('nope');
    out.currentUserId = athletes.CURRENT_USER_ID;

    /* --- formatters ---------------------------------------------------- */
    out.fmt = {
      swim0: formatters.formatDistance(0, 'swim'),
      run0: formatters.formatDistance(0, 'run'),
      swim: formatters.formatDistance(1834, 'swim'),
      run: formatters.formatDistance(10450, 'run'),
      dur0: formatters.formatDuration(0),
      durShort: formatters.formatDuration(3120),
      durLong: formatters.formatDuration(10800),
      paceRun: formatters.calculatePaceOrSpeed(3120, 10450, 'run'),
      paceZero: formatters.calculatePaceOrSpeed(0, 0, 'run'),
      paceHikeZero: formatters.calculatePaceOrSpeed(0, 0, 'hike'),
      speedRide: formatters.calculatePaceOrSpeed(6840, 52300, 'ride'),
      paceSwim: formatters.calculatePaceOrSpeed(2280, 1800, 'swim'),
      paceWorkout: formatters.calculatePaceOrSpeed(2700, 0, 'workout'),
      paceWorkoutZero: formatters.calculatePaceOrSpeed(0, 0, 'workout'),
      relativeNow: formatters.formatRelativeTime(new Date(Date.now() - 3 * 3600 * 1000).toISOString()),
      relativeOld: formatters.formatRelativeTime(new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()),
      relativeFuture: formatters.formatRelativeTime(new Date(Date.now() + 2 * 3600 * 1000).toISOString()),
      relativeInvalid: formatters.formatRelativeTime('not-a-date'),
    };

    /* --- storage store ------------------------------------------------- */
    store.resetDemoData();
    const snapshotA = store.getActivitiesSnapshot();
    const snapshotB = store.getActivitiesSnapshot();
    out.snapshotStable = snapshotA === snapshotB;
    out.seededActivities = snapshotA.length;
    out.seededChallenges = store.getChallengesSnapshot().length;
    out.seededUser = store.getUserSnapshot().username;
    out.seedKeys = Object.keys(window.localStorage).filter((k) => k.startsWith('fitness:')).sort();
    out.payloadBytes = JSON.stringify(snapshotA).length;

    const originalId = snapshotA[0].id;
    store.updateActivities((prev) => prev.filter((x) => x.id !== originalId));
    out.afterDelete = store.getActivitiesSnapshot().length;

    // Corrupt storage must degrade, never throw.
    window.localStorage.setItem('fitness:activities', '{not json');
    out.afterCorruption = store.getActivitiesSnapshot().length;
    out.corruptionUserSurvives = Boolean(store.getUserSnapshot().id);

    out.updaterThrewHandled = store.updateActivities(() => {
      throw new Error('boom');
    }) === false;
    // The stored value must be exactly what it was before the failed write.
    out.untouchedAfterThrow = window.localStorage.getItem('fitness:activities');

    store.resetDemoData();
    const restored = store.getActivitiesSnapshot();
    out.afterReset = restored.length;
    out.commentLinkageOk = restored.every((act) => act.comments.every((c) => c.activityId === act.id));
    out.idsUnique = new Set(restored.map((x) => x.id)).size === restored.length;
    out.coordsBounded = restored.every((x) => x.coordinates.length <= 120);
    out.derivedProfileMatchesSeed = restored.every(
      (x) => telemetry.deriveElevationProfile(x.coordinates).length === x.coordinates.length
    );
    out.recomputedCaloriesMatch = restored
      .filter((x) => x.sportType !== 'workout')
      .every((x) => x.calories === telemetry.calculateCalories(x.durationSeconds, x.sportType));
    out.privacyDistribution = restored.reduce((acc, x) => {
      acc[x.privacy] = (acc[x.privacy] ?? 0) + 1;
      return acc;
    }, {});

    /* --- MATH-01: antipodal and near-antipodal points ---------------------- */
    out.antipodal = telemetry.haversineMeters(0, 0, 0, 180);
    out.nearAntipodal = telemetry.haversineMeters(0, 0, 0, 179.9999999);
    out.poleToPole = telemetry.haversineMeters(-90, 0, 90, 0);
    out.antipodalFinite = [out.antipodal, out.nearAntipodal, out.poleToPole].every(
      (v) => Number.isFinite(v) && v > 0
    );
    out.nearAntipodalDistance = telemetry.deriveElevationProfile([
      { latitude: 0, longitude: 0, elevationMeters: 0, timestampOffsetSeconds: 0 },
      { latitude: 0, longitude: 179.9999999, elevationMeters: 0, timestampOffsetSeconds: 1 },
    ])[1].distanceMeters;

    /* --- MATH-02: unmapped sport ------------------------------------------ */
    out.caloriesUnmappedSport = telemetry.calculateCalories(3600, 'quidditch');

    /* --- DATA-01: shape validation ---------------------------------------- */
    out.sanitizeNull = store.sanitizeActivity(null);
    out.sanitizeGarbage = store.sanitizeActivity({ title: 'no id' });
    const repaired = store.sanitizeActivity({
      id: 'act-repair',
      userId: 'athlete-me-01',
      title: 'Repaired',
      sportType: 'teleport',
      distanceMeters: 'far',
      durationSeconds: null,
      coordinates: [{ latitude: 999, longitude: 0 }, { latitude: 10, longitude: 10 }, 'nope'],
      kudos: [{ username: 'no id' }, { userId: 'u1', username: 'u' }],
      comments: [{ id: 'c1', content: '   ' }, { id: 'c2', content: 'keep me' }],
      privacy: 'nonsense',
      startTime: 'not-a-date',
    });
    out.repaired = repaired;
    out.sanitizeChallengeGarbage = store.sanitizeChallenge({ title: 'no id' });
    out.sanitizeChallengeNoSports = store.sanitizeChallenge({ id: 'ch', sportTypes: ['quidditch'] });
    out.sanitizeProfileGarbage = store.sanitizeUserProfile('nope', { id: 'fallback-id' });

    // Structurally wrong but syntactically valid payloads must not reach React.
    const wrongShapes = [
      '{"not":"an array"}',
      '"a bare string"',
      '[null, 42, {"noId":true}, {"id":"act-ok","sportType":"ride"}]',
      '[[[[[]]]]]',
      'null',
    ];
    out.wrongShapes = wrongShapes.map((raw) => {
      window.localStorage.setItem('fitness:activities', raw);
      return store.getActivitiesSnapshot().length;
    });
    window.localStorage.setItem('fitness:challenges', '{"not":"an array"}');
    out.wrongShapeChallenges = store.getChallengesSnapshot().length;
    window.localStorage.setItem('fitness:user', '["array","not","object"]');
    out.wrongShapeUser = store.getUserSnapshot().fullName;
    store.resetDemoData();

    /* --- DATA-04: reset clears cached snapshots ---------------------------- */
    store.getActivitiesSnapshot();
    store.getChallengesSnapshot();
    store.resetDemoData();
    const afterResetA = store.getActivitiesSnapshot();
    out.resetIsFresh = afterResetA.length === 5 && afterResetA[0].id === store.getActivitiesSnapshot()[0].id;

    /* --- SEC-01: kudos carries the username, not the display name ---------- */
    const target = store.getActivitiesSnapshot()[0];
    social.toggleKudos(target.id);
    const myKudos = store
      .getActivitiesSnapshot()
      .flatMap((a) => a.kudos)
      .filter((k) => k.userId === 'athlete-me-01');
    out.kudosUsername = myKudos[myKudos.length - 1]?.username ?? null;
    out.seedKudosUsernames = store
      .getActivitiesSnapshot()
      .flatMap((a) => a.kudos)
      .map((k) => k.username);
    social.toggleKudos(target.id);
    store.resetDemoData();

    // Cross-tab contract: a foreign storage event must not notify subscribers.
    let notified = 0;
    const unsubscribe = store.subscribeToStore(() => {
      notified += 1;
    });
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated-app:key' }));
    const notifiedByForeign = notified;
    window.dispatchEvent(new StorageEvent('storage', { key: 'fitness:activities' }));
    const notifiedByOwn = notified - notifiedByForeign;
    unsubscribe();

    return {
      ...out,
      notifiedByForeign,
      notifiedByOwn,
    };
  });

  check('empty track projects to an empty path', result.emptyProjection.pathD === '' && result.emptyProjection.points.length === 0);
  check('projected path is an SVG move/line chain', result.pathStartsWithMove);
  check('single degenerate point projects finitely', result.singlePointFinite);
  check('projected points stay inside the viewBox', result.allPointsInViewport);
  check('start and end markers are returned', result.hasStartEnd);
  check('one segment per GPS sample', result.segmentCount === track0Points(result));
  check('haversine returns 0 for identical points', result.zeroDistance === 0);
  check(
    'haversine matches ~111.2 km per degree of latitude',
    Math.abs(result.oneDegreeLat - 111195) < 200,
    `got ${result.oneDegreeLat}`
  );
  check('elevation profile starts at zero distance', result.profileFirst.distanceMeters === 0);
  check('elevation profile has one point per GPS sample', result.profileMatchesTrackLength);
  check('elevation distance never decreases', result.profileMonotonicDistance);
  check('elevation profile of an empty track is empty', result.profileEmptyForEmptyTrack === 0);
  check('calories are 0 for zero duration', result.caloriesZeroDuration === 0);
  check('calories are 0 for zero weight', result.caloriesZeroWeight === 0);
  check('run calories ≈ MET × 72 kg × 1 h', result.caloriesRunHour === 706, `got ${result.caloriesRunHour}`);
  check('ride calories differ from run calories', result.caloriesRideHour !== result.caloriesRunHour);
  check('stationary pattern yields no track', result.stationary === 0);
  check('zero distance yields no track', result.zeroDistanceRoute === 0);
  check('same seed reproduces the same track', result.deterministic);
  check('loop route returns to its start', result.loopCloseDelta < 0.0007, `delta ${result.loopCloseDelta}`);
  check('track length stays under 120 points', result.maxPoints <= 120, `got ${result.maxPoints}`);
  check('short tracks still get a usable point count', result.minPoints >= 30, `got ${result.minPoints}`);
  check('sample timestamps never decrease', result.timestampsMonotonic);
  check('elevation is never negative', result.noNegativeElevation);
  check(
    'longer distance produces a longer span',
    result.distanceScales.long > result.distanceScales.short * 5,
    JSON.stringify(result.distanceScales)
  );
  check('week starts on Monday at midnight', result.weekStartDay === 1 && result.weekStartClock[0] === 0 && result.weekStartClock[1] === 0, `day ${result.weekStartDay} ${result.weekStartClock}`);
  check('Sunday resolves to the preceding Monday', result.sundayStartDay === 1);
  check('Monday resolves to itself', result.mondayStartDay === 1);
  check('month boundary lands on day 1', result.monthStartIso.includes('Feb 01'), result.monthStartIso);
  check('week boundary is never after month boundary', result.weekIsMonotonic);
  check('directory resolves a known athlete', result.knownAthlete === 'Elena Rostova');
  check('directory falls back for unknown ids', result.unknownAthlete.fullName === 'Community Athlete');
  equal('formatters: zero swim distance', result.fmt.swim0, '0 m');
  equal('formatters: zero run distance', result.fmt.run0, '0.00 km');
  equal('formatters: swim distance in meters', result.fmt.swim, '1834 m');
  equal('formatters: run distance in km', result.fmt.run, '10.45 km');
  equal('formatters: zero duration', result.fmt.dur0, '00:00');
  equal('formatters: sub-hour duration', result.fmt.durShort, '52:00');
  equal('formatters: multi-hour duration', result.fmt.durLong, '3h 00m');
  equal('formatters: run pace min/km', result.fmt.paceRun, { value: '4:59', unit: '/km' });
  equal('formatters: zero-input pace', result.fmt.paceZero, { value: '0:00', unit: '/km' });
  equal('formatters: zero-input hike pace', result.fmt.paceHikeZero, { value: '0:00', unit: '/km' });
  equal('formatters: ride speed km/h', result.fmt.speedRide, { value: '27.5', unit: 'km/h' });
  equal('formatters: swim pace per 100m', result.fmt.paceSwim, { value: '2:07', unit: '/100m' });
  equal('formatters: workout has no pace', result.fmt.paceWorkout, { value: 'Active', unit: 'status' });
  equal('formatters: zero-length workout degrades', result.fmt.paceWorkoutZero, { value: '--', unit: 'pace' });
  equal('formatters: relative hours', result.fmt.relativeNow, '3 hours ago');
  check(
    'formatters: relative dates beyond a week go absolute',
    /^[A-Z][a-z]{2} \d{1,2}$/.test(result.fmt.relativeOld),
    result.fmt.relativeOld
  );
  equal('formatters: future timestamps stay relative', result.fmt.relativeFuture, 'in 2 hours');
  equal('formatters: invalid input degrades', result.fmt.relativeInvalid, 'unknown date');
  check('snapshots keep reference identity', result.snapshotStable);
  check('seed data writes 5 activities', result.seededActivities === 5, `got ${result.seededActivities}`);
  check('seed data writes 3 challenges', result.seededChallenges === 3, `got ${result.seededChallenges}`);
  check('seed data writes the current profile', result.seededUser === 'marathoner_alex');
  equal(
    'storage keys are namespaced',
    result.seedKeys,
    ['fitness:activities', 'fitness:challenges', 'fitness:seeded', 'fitness:user']
  );
  check('seed payload stays small', result.payloadBytes < 200000, `${result.payloadBytes} bytes`);
  check('delete mutation persists', result.afterDelete === 4, `got ${result.afterDelete}`);
  check('corrupted JSON degrades to an empty list', result.afterCorruption === 0);
  check('corrupted activities do not break the profile snapshot', result.corruptionUserSurvives);
  check('a throwing updater is caught, not propagated', result.updaterThrewHandled === true);
  check('a throwing updater leaves storage untouched', result.untouchedAfterThrow === '{not json', result.untouchedAfterThrow);
  check('reset restores the full seed', result.afterReset === 5, `got ${result.afterReset}`);
  check('comments point at their own activity', result.commentLinkageOk);
  check('seed ids are unique', result.idsUnique);
  check('seeded tracks respect the 120-point cap', result.coordsBounded);
  check('elevation profile derives from every seeded track', result.derivedProfileMatchesSeed);
  check('seeded calories match the estimator', result.recomputedCaloriesMatch);
  equal('seed data covers all three privacy levels', result.privacyDistribution, { public: 3, followers: 1, private: 1 });
  check('foreign storage events are ignored', result.notifiedByForeign === 0, `${result.notifiedByForeign} notifications`);

  /* --- remediation regression assertions ---------------------------------- */
  check(
    'antipodal coordinates stay finite',
    result.antipodalFinite && Math.abs(result.antipodal - 20015086) < 5000,
    `antipodal ${result.antipodal}`
  );
  check(
    'a near-antipodal point does not produce NaN',
    Number.isFinite(result.nearAntipodalDistance) && result.nearAntipodalDistance > 0,
    `${result.nearAntipodalDistance}`
  );
  check(
    'an unmapped sport falls back to a default MET',
    result.caloriesUnmappedSport === 360,
    `${result.caloriesUnmappedSport} kcal`
  );
  check('a null record is rejected', result.sanitizeNull === null);
  check('a record without an id is rejected', result.sanitizeGarbage === null);
  check('a challenge without an id is rejected', result.sanitizeChallengeGarbage === null);
  check(
    'a challenge with no known sport still has one',
    result.sanitizeChallengeNoSports?.sportTypes?.length === 1,
    JSON.stringify(result.sanitizeChallengeNoSports?.sportTypes)
  );
  check('a malformed profile falls back', result.sanitizeProfileGarbage?.id === 'fallback-id', JSON.stringify(result.sanitizeProfileGarbage));
  check(
    'non-numeric metrics are coerced to zero',
    result.repaired?.distanceMeters === 0 && result.repaired?.durationSeconds === 0,
    JSON.stringify({ d: result.repaired?.distanceMeters, t: result.repaired?.durationSeconds })
  );
  check(
    'out-of-range coordinates are dropped and missing arrays are initialised',
    result.repaired?.coordinates.length === 1 && result.repaired.coordinates[0].latitude === 10,
    JSON.stringify(result.repaired?.coordinates)
  );
  check(
    'kudos and comments are sanitized',
    result.repaired?.kudos.length === 1 && result.repaired.comments.length === 1,
    JSON.stringify({ k: result.repaired?.kudos.length, c: result.repaired?.comments.length })
  );
  check(
    'unknown enums fall back to safe values',
    result.repaired?.sportType === 'run' && result.repaired?.privacy === 'public',
    JSON.stringify({ s: result.repaired?.sportType, p: result.repaired?.privacy })
  );
  check(
    'an invalid timestamp falls back to now',
    typeof result.repaired?.startTime === 'string' && !Number.isNaN(new Date(result.repaired.startTime).getTime()),
    String(result.repaired?.startTime)
  );
  // Only the one payload containing a record with a usable id survives; the rest
  // degrade to an empty feed instead of throwing inside a render.
  equal(
    'structurally wrong payloads keep only the repairable records',
    result.wrongShapes,
    [0, 0, 1, 0, 0]
  );
  check('structurally wrong challenges yield none', result.wrongShapeChallenges === 0, String(result.wrongShapeChallenges));
  check('structurally wrong profile falls back', result.wrongShapeUser === 'Alex Reynolds', String(result.wrongShapeUser));
  check('reset rebuilds fresh snapshots', result.resetIsFresh === true);
  check('kudos stores the username, not the display name', result.kudosUsername === 'marathoner_alex', String(result.kudosUsername));
  check(
    'seed kudos use usernames',
    result.seedKudosUsernames.every((u) => u === u.toLowerCase().replace(/\s/g, '_')),
    JSON.stringify(result.seedKudosUsernames)
  );
  check('own-namespace storage events notify subscribers', result.notifiedByOwn > 0, `${result.notifiedByOwn} notifications`);

  await page.close();
}

function track0Points() {
  // The climb track used above is deterministic: 10,000 m / 150 m per sample.
  return Math.min(120, Math.max(30, Math.round(10000 / 150)));
}

/* --------------------------------------------------------------- ui suite */

async function runUiSuite(browser, baseUrl) {
  console.log('\n▸ ui (production build)');
  const page = await newPage(browser, { width: 1440, height: 900 });
  const ui = pageOps(page);
  await page.goto(baseUrl, { waitUntil: 'networkidle2' });

  const boot = await page.evaluate(() => ({
    title: document.title,
    hasRoot: Boolean(document.querySelector('#root')?.firstElementChild),
    storageKeys: Object.keys(window.localStorage).filter((k) => k.startsWith('fitness:')).length,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));

  check('document renders into #root', boot.hasRoot);
  check('page title is set', boot.title.length > 0, boot.title);
  check('seed data is persisted on first load', boot.storageKeys === 4, `${boot.storageKeys} keys`);
  check(
    'no horizontal overflow at 1440px',
    boot.scrollWidth <= boot.innerWidth + 1,
    `${boot.scrollWidth} > ${boot.innerWidth}`
  );

  const cards = await ui.count('[data-testid="activity-card"]');
  check('feed renders seeded activity cards', cards === 5, `${cards} cards`);

  const cardData = await page.$$eval('[data-testid="activity-card"]', (els) =>
    els.map((el) => ({
      sport: el.getAttribute('data-sport'),
      owner: el.getAttribute('data-owner'),
      title: el.querySelector('[data-testid="activity-title-text"]')?.textContent?.trim() ?? '',
      stats: (el.querySelector('[data-testid="activity-stats"]')?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      hasSvg: Boolean(el.querySelector('svg')),
    }))
  );

  check('every card is tagged with its sport', cardData.every((c) => typeof c.sport === 'string' && c.sport.length > 0));
  check('every card names its author', cardData.every((c) => typeof c.owner === 'string' && c.owner.length > 0));
  check('feed is ordered newest first', cardData[0]?.title === 'Sunrise Ridge Trail Run', cardData.map((c) => c.title).join(' | '));
  check('every card renders stats', cardData.every((c) => c.stats.length > 10));
  check('every card renders an icon or chart', cardData.every((c) => c.hasSvg));

  const expectedStats = {
    run: { title: 'Sunrise Ridge Trail Run', text: '10.45 km', unit: '/km' },
    ride: { title: 'Marin Headlands Coastal Loop', text: '52.30 km', unit: 'km/h' },
    swim: { title: 'Aquatic Park Open Water Laps', text: '1800 m', unit: '/100m' },
    hike: { title: 'Mount Tamalpais Summit Scramble', text: '14.20 km', unit: '/km' },
    workout: { title: 'Core & Kettlebell Conditioning', text: '45:00', unit: 'kcal' },
  };
  for (const [, expected] of Object.entries(expectedStats)) {
    const card = cardData.find((c) => c.title === expected.title);
    check(`stats for "${expected.title}"`, card?.stats.includes(expected.text) && card.stats.includes(expected.unit), card?.stats ?? 'missing');
  }

  // The expanded-route dialog keeps its own copy mounted, so count visible ones only.
  const routeCount = await page.$$eval(
    '[data-testid="route-map"]',
    (els) => els.filter((el) => !el.closest('dialog:not([open])')).length
  );
  check('route maps render for tracked activities', routeCount === 4, `${routeCount} route maps`);
  const elevationCount = await page.$$eval(
    '[data-testid="elevation-chart"]',
    (els) => els.filter((el) => !el.closest('dialog:not([open])')).length
  );
  check('elevation charts render for tracked activities', elevationCount === 4, `${elevationCount} charts`);

  const gradientIds = await page.$$eval('linearGradient', (els) => els.map((e) => e.id));
  check('every SVG gradient id is unique', new Set(gradientIds).size === gradientIds.length, gradientIds.join(','));
  check('gradient ids contain no invalid characters', gradientIds.every((id) => /^[\w-]+$/.test(id)));

  const routePaths = await page.$$eval('[data-testid="route-path"]', (els) =>
    els
      .filter((el) => !el.closest('dialog:not([open])'))
      .map((el) => ({
        d: el.getAttribute('d') ?? '',
        stroke: getComputedStyle(el).stroke,
      }))
  );
  check(
    'route paths carry multi-segment geometry',
    routePaths.length === 4 && routePaths.every((p) => /^M [\d.-]+ [\d.-]+( L [\d.-]+ [\d.-]+)+$/.test(p.d)),
    JSON.stringify(routePaths.map((p) => p.d.slice(0, 24)))
  );
  check(
    'routes stroke with their sport colour, not the default',
    routePaths.every((p) => p.stroke.startsWith('url(')),
    JSON.stringify(routePaths.map((p) => p.stroke))
  );

  const weekly = await page.evaluate(
    () => document.querySelector('[data-testid="weekly-goal"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  );
  check('weekly goal panel renders with a percentage', /\d+%/.test(weekly), weekly.slice(0, 80));

  const challengeCount = await ui.count('[data-testid="challenge-card"]');
  check('challenge cards render', challengeCount >= 3, `${challengeCount} challenges`);

  const a11y = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('button')];
    const unlabelled = buttons.filter(
      (b) => !b.textContent?.trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')
    );
    return {
      buttonCount: buttons.length,
      unlabelled: unlabelled.length,
      dialogsWithoutName: [...document.querySelectorAll('dialog')].filter(
        (d) => !d.querySelector('h2, h3, [role="heading"]')
      ).length,
      h1Count: document.querySelectorAll('h1').length,
      lang: document.documentElement.lang,
    };
  });
  check('every button has an accessible name', a11y.unlabelled === 0, `${a11y.unlabelled} of ${a11y.buttonCount}`);
  check('dialogs carry a heading', a11y.dialogsWithoutName === 0, `${a11y.dialogsWithoutName} unnamed`);
  check('page exposes a single h1', a11y.h1Count === 1, `${a11y.h1Count} h1 elements`);
  check('document declares a language', a11y.lang === 'en', a11y.lang);

  /* --- theme tokens and contrast ---------------------------------------- */
  const theme = await page.evaluate(() => {
    const parse = (value) => {
      const parts = String(value).match(/[\d.]+/g)?.map(Number) ?? [];
      return parts.slice(0, 3);
    };
    const luminance = ([r, g, b]) => {
      const channel = (v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const contrast = (fg, bg) => {
      const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
      return (hi + 0.05) / (lo + 0.05);
    };

    const probe = document.createElement('div');
    probe.style.color = 'rgb(18,18,20)';
    document.body.appendChild(probe);
    const pageBg = parse(getComputedStyle(document.body).backgroundColor);
    probe.remove();

    const themeSample = (selector) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const style = getComputedStyle(el);
      let bgEl = el;
      // Walk up until a non-transparent background is found.
      while (bgEl && (getComputedStyle(bgEl).backgroundColor === 'rgba(0, 0, 0, 0)' || getComputedStyle(bgEl).backgroundColor === 'transparent')) {
        bgEl = bgEl.parentElement;
      }
      return {
        color: parse(style.color),
        bg: parse(bgEl ? getComputedStyle(bgEl).backgroundColor : 'rgb(18,18,20)'),
        fontSize: parseFloat(style.fontSize),
      };
    };

    // Every emitted rule, so we can prove Tailwind saw the static classes.
    let css = '';
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) css += rule.cssText;
      } catch {
        // cross-origin sheet: nothing to inspect
      }
    }

    return {
      pageBg,
      badgeBg: [...document.querySelectorAll('[data-testid="sport-badge"]')].map((el) => getComputedStyle(el).backgroundColor),
      badgeText: [...document.querySelectorAll('[data-testid="sport-badge"]')].map((el) => getComputedStyle(el).color),
      smallTextColor: (() => {
        const el = document.querySelector('[data-testid="activity-card"] [data-testid="activity-stats"] span');
        return el ? getComputedStyle(el).color : null;
      })(),
      svgCount: document.querySelectorAll('svg').length,
      // Icons in a hidden subtree (closed dialog, desktop-hidden nav) are
      // legitimately zero-sized; only rendered ones must have a real box.
      zeroSizeSvgs: [...document.querySelectorAll('svg')]
        .filter((svg) => svg.checkVisibility({ visibilityProperty: true }))
        .filter((svg) => {
          const r = svg.getBoundingClientRect();
          return r.width === 0 || r.height === 0;
        }).length,
      cssLength: css.length,
      hasStravaOrange: /\.bg-strava-orange(?![-\w])/.test(css),
      hasSportText: /\.text-sport-swim(?![-\w])/.test(css),
      hasSportBorder: /\.border-sport-run\\\/30(?![-\w])/.test(css),
      hasSurface: /\.bg-surface-700(?![-\w])/.test(css),
      hasXsBreakpoint: /@media\s*\(width\s*>=\s*390px\)/.test(css),
      hasThemeVars: css.includes('--color-strava-orange'),
      ratios: {
        primary: contrastOf(themeSample('h1')),
        secondary: contrastOf(themeSample('[data-testid="activity-stats"] label, label')),
        tertiary: contrastOf(themeSample('[data-testid="weekly-goal"] p')),
      },
    };

    function contrastOf(sample) {
      if (!sample) return null;
      const [hi, lo] = [luminance(sample.color), luminance(sample.bg)].sort((a, b) => b - a);
      return Number(((hi + 0.05) / (lo + 0.05)).toFixed(2));
    }
  });

  check('page paints the surface-900 token', theme.pageBg.join(',') === '18,18,20', theme.pageBg.join(','));
  check('Tailwind emitted the custom color variables', theme.hasThemeVars);
  check('Tailwind emitted bg-strava-orange', theme.hasStravaOrange);
  check('Tailwind emitted sport text colors', theme.hasSportText);
  check('Tailwind emitted opacity-modified sport borders', theme.hasSportBorder);
  check('Tailwind emitted surface tokens', theme.hasSurface);
  check('Tailwind emitted the 390px xs breakpoint', theme.hasXsBreakpoint, 'no @media (width >= 390px)');
  check('heading contrast ≥ 7:1', theme.ratios.primary >= 7, `${theme.ratios.primary}:1`);
  check('secondary text contrast ≥ 4.5:1', theme.ratios.secondary >= 4.5, `${theme.ratios.secondary}:1`);
  check('tertiary text contrast ≥ 4.5:1', theme.ratios.tertiary >= 4.5, `${theme.ratios.tertiary}:1`);
  check(
    'each sport badge renders a distinct tint',
    new Set(theme.badgeBg).size >= 5,
    JSON.stringify(theme.badgeBg)
  );
  check(
    'each sport badge renders a distinct accent colour',
    new Set(theme.badgeText).size >= 5,
    JSON.stringify(theme.badgeText)
  );
  check('icons render at a non-zero size', theme.zeroSizeSvgs === 0 && theme.svgCount > 0, `${theme.zeroSizeSvgs}/${theme.svgCount} empty`);

  await shot(page, 'ui-1440-feed');
  await page.close();
}

/* --------------------------------------------------------- responsive suite */

async function runResponsiveSuite(browser, baseUrl) {
  console.log('\n▸ responsive (production build)');
  for (const vp of VIEWPORTS) {
    const page = await newPage(browser, vp);
    const ui = pageOps(page);
    await page.goto(baseUrl, { waitUntil: 'networkidle2' });

    const metrics = await page.evaluate(() => {
      const offenders = [...document.querySelectorAll('body *')]
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return { tag: el.tagName, cls: String(el.className).slice(0, 40), right: Math.round(rect.right) };
        })
        .filter((x) => x.right > window.innerWidth + 1)
        .slice(0, 4);
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        cards: document.querySelectorAll('[data-testid="activity-card"]').length,
        offenders,
      };
    });

    check(
      `${vp.width}px: no horizontal overflow`,
      metrics.scrollWidth <= metrics.innerWidth + 1,
      `${metrics.scrollWidth} > ${metrics.innerWidth}; offenders ${JSON.stringify(metrics.offenders)}`
    );
    check(`${vp.width}px: feed renders all cards`, metrics.cards === 5, `${metrics.cards} cards`);

    // The five-metric grid must not leave an orphan cell on a 2-column phone.
    const metricGrid = await page.evaluate(() => {
      const stats = document.querySelector('[data-testid="activity-card"] [data-testid="activity-stats"]');
      if (!stats) return null;
      const cells = [...stats.children];
      const first = cells[0].getBoundingClientRect();
      const last = cells[cells.length - 1].getBoundingClientRect();
      return {
        columns: getComputedStyle(stats).gridTemplateColumns.split(' ').length,
        cells: cells.length,
        firstWidth: Math.round(first.width),
        lastWidth: Math.round(last.width),
        overflows: Math.round(last.right - stats.getBoundingClientRect().right),
      };
    });

    if (metricGrid) {
      const spansTwo = metricGrid.lastWidth > metricGrid.firstWidth * 1.5;
      check(
        `${vp.width}px: metric grid uses ${vp.width < 390 ? 2 : 3} columns`,
        metricGrid.columns === (vp.width < 390 ? 2 : 3),
        `${metricGrid.columns} columns`
      );
      check(
        `${vp.width}px: trailing metric ${vp.width < 390 ? 'spans' : 'does not span'} the orphan cell`,
        vp.width < 390 ? spansTwo : !spansTwo,
        `first ${metricGrid.firstWidth}px, last ${metricGrid.lastWidth}px`
      );
      check(
        `${vp.width}px: metric grid stays inside its card`,
        metricGrid.overflows <= 1,
        `${metricGrid.overflows}px past the edge`
      );
    }

    // Layout assertions only apply once the shell renders its chrome; the feed
    // itself is checked at every width.
    const shell = await page.evaluate(() => {
      const visible = (selector) =>
        document.querySelector(selector)?.checkVisibility({ visibilityProperty: true }) ?? false;
      return {
        bottomNav: visible('[data-testid="bottom-nav"]'),
        headerSearch: Boolean(document.querySelector('[data-testid="header-search"]')),
      };
    });

    check(
      `${vp.width}px: ${vp.width < 768 ? 'bottom navigation is shown' : 'bottom navigation is hidden'}`,
      (vp.width < 768) === shell.bottomNav
    );

    if (shell.headerSearch) {
      const searchWidth = await page.evaluate(
        () => document.querySelector('[data-testid="header-search"]')?.getBoundingClientRect().width ?? 0
      );
      check(
        `${vp.width}px: ${vp.width < 768 ? 'header collapses the search field' : 'header shows the search field'}`,
        (vp.width < 768 ? searchWidth === 0 : searchWidth > 0),
        `width ${Math.round(searchWidth)}`
      );
    }

    if (vp.width < 768) {
      const smallTargets = await page.$$eval('button:not([disabled]), a[href]', (els) =>
        els
          .map((el) => {
            const rect = el.getBoundingClientRect();
            return {
              label: (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().slice(0, 24),
              w: Math.round(rect.width),
              h: Math.round(rect.height),
            };
          })
          .filter((t) => t.w > 0 && t.h > 0 && (t.h < 40 || t.w < 40))
      );
      check(`${vp.width}px: touch targets are at least 40px`, smallTargets.length === 0, JSON.stringify(smallTargets.slice(0, 5)));

      const footerClearance = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('[data-testid="activity-card"]')];
        const last = cards[cards.length - 1];
        const nav = document.querySelector('[data-testid="bottom-nav"]');
        if (!last || !nav) return null;
        const scrollY = window.scrollY;
        window.scrollTo(0, document.documentElement.scrollHeight);
        const cardBottom = last.getBoundingClientRect().bottom + window.scrollY;
        const navTop = nav.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, scrollY);
        return Math.round(navTop - cardBottom);
      });
      if (footerClearance !== null) {
        check(
          `${vp.width}px: bottom navigation clears the last card when scrolled`,
          footerClearance >= 0,
          `overlap ${footerClearance}px`
        );
      }
    }

    await shot(page, `responsive-${vp.name}`);
    await page.close();
  }
}

/* ------------------------------------------------------- interactions suite */

async function runInteractionSuite(browser, baseUrl) {
  console.log('\n▸ interactions (production build)');
  const page = await newPage(browser, { width: 390, height: 844 });
  const ui = pageOps(page);

  const readStorage = () =>
    page.evaluate(() => ({
      activities: JSON.parse(window.localStorage.getItem('fitness:activities') ?? '[]'),
      challenges: JSON.parse(window.localStorage.getItem('fitness:challenges') ?? '[]'),
    }));

  await page.goto(baseUrl, { waitUntil: 'networkidle2' });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: 'networkidle2' });

  /* --- kudos ----------------------------------------------------------- */
  const kudosBefore = await ui.attr('[data-testid="kudos-button"]', 'data-kudos-count');
  const kudosActiveBefore = await ui.attr('[data-testid="kudos-button"]', 'data-kudos-active');
  await ui.click('[data-testid="kudos-button"]');
  await new Promise((r) => setTimeout(r, 200));
  const kudosAfter = await ui.attr('[data-testid="kudos-button"]', 'data-kudos-count');
  const kudosActiveAfter = await ui.attr('[data-testid="kudos-button"]', 'data-kudos-active');
  check(
    'kudos toggles on and increments the count',
    kudosActiveBefore === 'false' && kudosActiveAfter === 'true' && Number(kudosAfter) === Number(kudosBefore) + 1,
    `${kudosBefore}/${kudosActiveBefore} → ${kudosAfter}/${kudosActiveAfter}`
  );

  await ui.click('[data-testid="kudos-button"]');
  await new Promise((r) => setTimeout(r, 200));
  const kudosToggledBack = await ui.attr('[data-testid="kudos-button"]', 'data-kudos-active');
  check('kudos toggles back off', kudosToggledBack === 'false', String(kudosToggledBack));

  await ui.click('[data-testid="kudos-button"]');
  await new Promise((r) => setTimeout(r, 200));

  const kudosInStorage = (await readStorage()).activities.reduce((n, a) => n + a.kudos.length, 0);
  check('kudos persist to storage', kudosInStorage === 5, `${kudosInStorage} kudos`);

  /* --- comments -------------------------------------------------------- */
  await ui.click('[data-testid="comment-button"]');
  await new Promise((r) => setTimeout(r, 250));
  check('comment dialog opens', await page.evaluate(() => Boolean(document.querySelector('dialog[open]'))));

  const focusState = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]');
    const active = document.activeElement;
    return {
      tag: active?.tagName ?? null,
      inside: Boolean(dialog && active && dialog !== active && dialog.contains(active)),
      onDialog: active === dialog,
    };
  });
  check(
    'the open dialog takes focus',
    focusState.inside || focusState.onDialog,
    JSON.stringify(focusState)
  );

  await ui.type('[data-testid="comment-input"]', 'Strong finish on that last climb.');
  await ui.click('[data-testid="comment-submit"]');
  await new Promise((r) => setTimeout(r, 250));
  const comments = (await readStorage()).activities.flatMap((a) => a.comments).map((c) => c.content);
  check('comment is created', comments.includes('Strong finish on that last climb.'), JSON.stringify(comments));
  check(
    'comment input clears after submit',
    (await page.$eval('[data-testid="comment-input"]', (el) => el.value)) === ''
  );
  check(
    'comment count updates on the card',
    (await ui.attr('[data-testid="comment-button"]', 'data-comment-count')) === '2'
  );

  // DATA-02: the first tap must not destroy anything.
  await ui.click('[data-testid="comment-delete"]');
  await new Promise((r) => setTimeout(r, 200));
  const afterFirstDeleteTap = (await readStorage()).activities.flatMap((a) => a.comments);
  check(
    'the first delete tap only asks for confirmation',
    afterFirstDeleteTap.length === 2 && (await ui.count('[data-testid="comment-delete-confirm-row"]')) === 1,
    `${afterFirstDeleteTap.length} comments`
  );

  await ui.click('[data-testid="comment-delete-cancel"]');
  await new Promise((r) => setTimeout(r, 200));
  check(
    'cancelling a delete keeps the comment',
    (await readStorage()).activities.flatMap((a) => a.comments).length === 2 &&
      (await ui.count('[data-testid="comment-delete-confirm-row"]')) === 0
  );

  await ui.click('[data-testid="comment-delete"]');
  await new Promise((r) => setTimeout(r, 150));
  await ui.click('[data-testid="comment-delete-confirm"]');
  await new Promise((r) => setTimeout(r, 250));
  const afterDeleteComment = (await readStorage()).activities.flatMap((a) => a.comments);
  check(
    'only your own comment can be deleted',
    afterDeleteComment.length === 1 && afterDeleteComment[0].userId !== 'athlete-me-01',
    JSON.stringify(afterDeleteComment.map((c) => c.userId))
  );

  check(
    'an open dialog locks page scrolling',
    await page.evaluate(() => document.documentElement.classList.contains('overflow-hidden'))
  );

  // UI-01: a text selection that begins inside the dialog and ends on the
  // backdrop fires a click whose target is the dialog. It must not dismiss.
  await page.evaluate(() => {
    const dialog = document.querySelector('dialog[open]');
    const heading = dialog?.querySelector('h2');
    heading?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    dialog?.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    dialog?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 250));
  check(
    'selecting text and releasing on the backdrop keeps the dialog open',
    await page.evaluate(() => Boolean(document.querySelector('dialog[open]')))
  );

  await tapBackdrop(page);
  await new Promise((r) => setTimeout(r, 250));
  check('backdrop click closes the dialog', await page.evaluate(() => !document.querySelector('dialog[open]')));
  check(
    'backdrop dismissal restores page scrolling',
    await page.evaluate(() => !document.documentElement.classList.contains('overflow-hidden'))
  );

  await ui.click('[data-testid="comment-button"]');
  await new Promise((r) => setTimeout(r, 250));
  await page.keyboard.press('Escape');
  await new Promise((r) => setTimeout(r, 250));
  check('Escape closes the dialog', await page.evaluate(() => !document.querySelector('dialog[open]')));
  check(
    'closing the dialog restores page scrolling',
    await page.evaluate(() => !document.documentElement.classList.contains('overflow-hidden'))
  );

  /* --- log activity ---------------------------------------------------- */
  await ui.click('[aria-label="Log activity"]');
  await new Promise((r) => setTimeout(r, 250));
  check('log activity modal opens', await page.evaluate(() => Boolean(document.querySelector('dialog[open]'))));

  const emptySubmitDisabled = await ui.attr('[data-testid="activity-submit"]', 'disabled');
  check('submit is disabled for an empty form', emptySubmitDisabled !== null, String(emptySubmitDisabled));

  await ui.type('[data-testid="activity-title"]', 'Evening Tempo Intervals');
  await ui.type('[data-testid="activity-description"]', 'Track session. Six reps at threshold.');
  await ui.select('[data-testid="activity-sport"]', 'run');
  await new Promise((r) => setTimeout(r, 150));
  check('submit stays disabled while metrics are missing', (await ui.attr('[data-testid="activity-submit"]', 'disabled')) !== null);

  await ui.type('[data-testid="activity-duration-minutes"]', '42');
  await ui.type('[data-testid="activity-duration-seconds"]', '10');
  await ui.type('[data-testid="activity-distance"]', '9.4');
  await ui.type('[data-testid="activity-elevation"]', '120');
  await new Promise((r) => setTimeout(r, 200));
  check('submit enables once the form is valid', (await ui.attr('[data-testid="activity-submit"]', 'disabled')) === null);

  await ui.select('[data-testid="activity-route-pattern"]', 'out_and_back');
  await ui.select('[data-testid="activity-privacy"]', 'public');
  await ui.click('[data-testid="activity-submit"]');
  await new Promise((r) => setTimeout(r, 350));

  const created = (await readStorage()).activities;
  const newest = created[0];
  check('new activity is persisted', created.length === 6, `${created.length} activities`);
  check('new activity is owned by the current athlete', newest?.userId === 'athlete-me-01');
  check('new activity title is trimmed', newest?.title === 'Evening Tempo Intervals');
  check('new activity stores duration in seconds', newest?.durationSeconds === 2530, `${newest?.durationSeconds}`);
  check('new activity converts km to meters', newest?.distanceMeters === 9400, `${newest?.distanceMeters}`);
  check('new activity computes calories', newest?.calories > 0, `${newest?.calories}`);
  check('new activity gets a generated route', (newest?.coordinates?.length ?? 0) > 0);
  check('new activity sorts to the top of the feed', (await ui.count('[data-testid="activity-card"]')) === 6);

  /* --- delete ---------------------------------------------------------- */
  await ui.click('[aria-label="Delete activity"]');
  await new Promise((r) => setTimeout(r, 250));
  check(
    'the first activity delete tap only asks for confirmation',
    (await readStorage()).activities.length === 6 && (await ui.count('[data-testid="activity-delete-confirm-row"]')) === 1,
    `${(await readStorage()).activities.length} activities`
  );

  await ui.click('[data-testid="activity-delete-cancel"]');
  await new Promise((r) => setTimeout(r, 200));
  check(
    'cancelling an activity delete keeps it',
    (await readStorage()).activities.length === 6 && (await ui.count('[data-testid="activity-delete-confirm-row"]')) === 0
  );

  await ui.click('[aria-label="Delete activity"]');
  await new Promise((r) => setTimeout(r, 150));
  await ui.click('[data-testid="activity-delete-confirm"]');
  await new Promise((r) => setTimeout(r, 300));
  check('activity can be deleted', (await readStorage()).activities.length === 5);

  /* --- filters --------------------------------------------------------- */
  await page.evaluate(() => window.scrollTo(0, 0));
  await ui.click('[aria-label="Filter by Ride"]');
  await new Promise((r) => setTimeout(r, 250));
  const rideOnly = await page.$$eval('[data-testid="activity-card"]', (els) => els.map((e) => e.getAttribute('data-sport')));
  check('sport filter narrows the feed', rideOnly.length === 1 && rideOnly[0] === 'ride', JSON.stringify(rideOnly));

  await ui.click('[aria-label="Filter by All"]');
  await new Promise((r) => setTimeout(r, 200));
  check('clearing the filter restores the feed', (await ui.count('[data-testid="activity-card"]')) === 5);

  await ui.select('[data-testid="filter-sort"]', 'kudos');
  await new Promise((r) => setTimeout(r, 250));
  const sortedByKudos = await page.$$eval('[data-testid="activity-card"]', (els) => els.map((e) => Number(e.getAttribute('data-kudos'))));
  check(
    'sort by kudos orders descending',
    sortedByKudos.every((v, i) => i === 0 || sortedByKudos[i - 1] >= v),
    JSON.stringify(sortedByKudos)
  );

  await ui.click('[aria-label="Search activities"]');
  await ui.type('[data-testid="feed-search"]', 'Headlands');
  await new Promise((r) => setTimeout(r, 300));
  check('search narrows the feed', (await ui.count('[data-testid="activity-card"]')) === 1);

  await ui.clear('[data-testid="feed-search"]');
  await new Promise((r) => setTimeout(r, 300));
  check('clearing search restores the feed', (await ui.count('[data-testid="activity-card"]')) === 5);

  /* --- challenges ------------------------------------------------------ */
  const joinedBefore = (await readStorage()).challenges.map((c) => c.joined);
  await ui.click('[data-testid="challenge-toggle"]', 1);
  await new Promise((r) => setTimeout(r, 250));
  const joinedAfter = (await readStorage()).challenges.map((c) => c.joined);
  check(
    'challenge join toggles and persists',
    joinedBefore[1] !== joinedAfter[1] && joinedAfter.filter(Boolean).length === joinedBefore.filter(Boolean).length + (joinedAfter[1] ? 1 : -1),
    `${JSON.stringify(joinedBefore)} → ${JSON.stringify(joinedAfter)}`
  );

  /* --- reset ----------------------------------------------------------- */
  await ui.click('[aria-label="Reset demo data"]');
  await new Promise((r) => setTimeout(r, 400));
  const afterReset = await readStorage();
  check(
    'reset restores the seed dataset',
    afterReset.activities.length === 5 && afterReset.challenges.length === 3,
    `${afterReset.activities.length}/${afterReset.challenges.length}`
  );
  check('reset restores the default challenge joins', afterReset.challenges.filter((c) => c.joined).length === 2);
  check('reset repaints the feed', (await ui.count('[data-testid="activity-card"]')) === 5);

  /* --- entry form rules -------------------------------------------------- */
  console.log('  · validation rules');

  const openModal = async () => {
    await ui.click('[aria-label="Log activity"]');
    await new Promise((r) => setTimeout(r, 250));
  };
  const closeModal = async () => {
    await page.keyboard.press('Escape');
    await new Promise((r) => setTimeout(r, 250));
  };
  const submitDisabled = () => ui.attr('[data-testid="activity-submit"]', 'disabled');
  const firstError = () =>
    page.evaluate(() => document.querySelector('[data-testid="activity-form"] [role="alert"]')?.textContent ?? null);

  // A short title blocks submission and explains why.
  await openModal();
  await ui.type('[data-testid="activity-title"]', 'ab');
  await new Promise((r) => setTimeout(r, 150));
  check('short titles block submission', (await submitDisabled()) !== null);
  check(
    'the invalid field is marked aria-invalid',
    (await ui.attr('[data-testid="activity-title"]', 'aria-invalid')) === 'true'
  );
  check('the offending field explains itself', (await firstError())?.includes('at least 3') === true, String(await firstError()));
  await closeModal();

  // Minutes are capped at two digits and validated against 59.
  await openModal();
  await ui.type('[data-testid="activity-title"]', 'Minute Overflow');
  await ui.type('[data-testid="activity-duration-minutes"]', '99');
  await new Promise((r) => setTimeout(r, 150));
  check('minutes above 59 are rejected', (await submitDisabled()) !== null);
  check('minutes error names the range', (await firstError())?.includes('0 and 59') === true, String(await firstError()));
  await closeModal();

  // A start time in the future is not a real activity yet.
  await openModal();
  await ui.type('[data-testid="activity-title"]', 'Tomorrow Long Run');
  await ui.type('[data-testid="activity-duration-minutes"]', '30');
  const tomorrow = await page.evaluate(() => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  await ui.type('[data-testid="activity-date"]', '');
  await page.evaluate((value) => {
    const input = document.querySelector('[data-testid="activity-date"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, tomorrow);
  await new Promise((r) => setTimeout(r, 200));
  check('a future start date blocks submission', (await submitDisabled()) !== null);
  check('the date error explains the rule', (await firstError())?.includes('future') === true, String(await firstError()));
  await closeModal();

  // Swimming is entered in meters and locks the km toggle.
  await openModal();
  await ui.select('[data-testid="activity-sport"]', 'swim');
  await new Promise((r) => setTimeout(r, 150));
  const swimUnit = await page.evaluate(() => {
    const group = document.querySelector('[data-testid="activity-distance-unit"]');
    return [...group.querySelectorAll('button')].map((b) => ({ label: b.textContent.trim(), disabled: b.disabled }));
  });
  check('swimming locks the unit toggle to meters', swimUnit.find((b) => b.label === 'km')?.disabled === true && swimUnit.find((b) => b.label === 'm')?.disabled === false, JSON.stringify(swimUnit));

  await ui.type('[data-testid="activity-title"]', 'Yard Session');
  await ui.type('[data-testid="activity-duration-minutes"]', '40');
  await ui.type('[data-testid="activity-duration-seconds"]', '00');
  await ui.type('[data-testid="activity-distance"]', '1800');
  await ui.type('[data-testid="activity-elevation"]', '0');
  await new Promise((r) => setTimeout(r, 200));
  check('a swim form becomes valid', (await submitDisabled()) === null);
  await ui.click('[data-testid="activity-submit"]');
  await new Promise((r) => setTimeout(r, 300));
  const swimActivity = (await readStorage()).activities[0];
  check('swim distance is stored in meters', swimActivity?.distanceMeters === 1800, `${swimActivity?.distanceMeters}`);
  check('a swim route is still generated', (swimActivity?.coordinates?.length ?? 0) > 0);

  // Workouts are duration only.
  await openModal();
  await ui.select('[data-testid="activity-sport"]', 'workout');
  await new Promise((r) => setTimeout(r, 150));
  const workoutState = await page.evaluate(() => ({
    distanceDisabled: document.querySelector('[data-testid="activity-distance"]')?.disabled,
    elevationDisabled: document.querySelector('[data-testid="activity-elevation"]')?.disabled,
    pattern: document.querySelector('[data-testid="activity-route-pattern"]')?.value,
  }));
  check('workouts disable distance and elevation', workoutState.distanceDisabled === true && workoutState.elevationDisabled === true, JSON.stringify(workoutState));
  check('workouts force a stationary pattern', workoutState.pattern === 'stationary', String(workoutState.pattern));

  await ui.type('[data-testid="activity-title"]', 'Mobility Session');
  await ui.type('[data-testid="activity-duration-minutes"]', '25');
  await new Promise((r) => setTimeout(r, 200));
  check('a duration-only workout is valid', (await submitDisabled()) === null);
  await ui.click('[data-testid="activity-submit"]');
  await new Promise((r) => setTimeout(r, 300));
  const workoutActivity = (await readStorage()).activities[0];
  check('a workout stores no distance or elevation', workoutActivity?.distanceMeters === 0 && workoutActivity?.elevationGainMeters === 0, JSON.stringify({ d: workoutActivity?.distanceMeters, e: workoutActivity?.elevationGainMeters }));
  check('a workout stores no route', (workoutActivity?.coordinates?.length ?? -1) === 0);

  // A stationary run keeps its distance out of the record.
  await openModal();
  await ui.select('[data-testid="activity-route-pattern"]', 'stationary');
  await ui.type('[data-testid="activity-title"]', 'Mobility Run');
  await ui.type('[data-testid="activity-duration-minutes"]', '20');
  await ui.type('[data-testid="activity-elevation"]', '0');
  await new Promise((r) => setTimeout(r, 200));
  check('a stationary run needs no distance', (await submitDisabled()) === null);
  await ui.click('[data-testid="activity-submit"]');
  await new Promise((r) => setTimeout(r, 300));
  const stationary = (await readStorage()).activities[0];
  check('a stationary activity stores no distance', stationary?.distanceMeters === 0, `${stationary?.distanceMeters}`);
  check('a stationary activity stores no route', (stationary?.coordinates?.length ?? -1) === 0);

  // Privacy round-trip: the modal closed on save, so open it again.
  await openModal();
  const privacy = await ui.prop('[data-testid="activity-privacy"]', 'value');
  await ui.select('[data-testid="activity-privacy"]', 'private');
  await ui.type('[data-testid="activity-title"]', 'Private Ride');
  await ui.select('[data-testid="activity-sport"]', 'ride');
  await ui.select('[data-testid="activity-route-pattern"]', 'loop');
  await ui.type('[data-testid="activity-duration-minutes"]', '55');
  await ui.type('[data-testid="activity-distance"]', '25');
  await ui.type('[data-testid="activity-elevation"]', '300');
  await new Promise((r) => setTimeout(r, 200));
  await ui.click('[data-testid="activity-submit"]');
  await new Promise((r) => setTimeout(r, 300));
  const privateActivity = (await readStorage()).activities[0];
  check('privacy default is public', privacy === 'public', String(privacy));
  check('privacy is stored on the activity', privateActivity?.privacy === 'private', `${privateActivity?.privacy}`);

  // Restore the seed so the run ends on a known state.
  await ui.click('[aria-label="Reset demo data"]');
  await new Promise((r) => setTimeout(r, 400));
  const finalState = await readStorage();
  check(
    'demo reset still works after a busy session',
    finalState.activities.length === 5 && finalState.challenges.length === 3,
    `${finalState.activities.length}/${finalState.challenges.length}`
  );

  /* --- shell navigation -------------------------------------------------- */
  console.log('  · shell navigation');

  // The header search collapses to an icon below md and expands on tap.
  const wasExpanded = await page.evaluate(
    () => (document.querySelector('[data-testid="header-search"]')?.getBoundingClientRect().width ?? 0) > 0
  );
  if (wasExpanded) {
    await ui.click('[aria-label="Close search"]');
    await new Promise((r) => setTimeout(r, 250));
  }
  const collapsedWidth = await page.evaluate(
    () => document.querySelector('[data-testid="header-search"]')?.getBoundingClientRect().width ?? -1
  );
  check('mobile header search starts collapsed', collapsedWidth === 0, `${collapsedWidth}px`);
  await ui.click('[aria-label="Search activities"]');
  await new Promise((r) => setTimeout(r, 250));
  const expandedWidth = await page.evaluate(
    () => document.querySelector('[data-testid="header-search"]')?.getBoundingClientRect().width ?? 0
  );
  check('tapping the search icon expands the field', expandedWidth > 0, `${expandedWidth}px`);
  const togglePressed = await ui.attr('[aria-label="Close search"]', 'aria-expanded');
  check('the toggle reports its state', togglePressed === 'true', String(togglePressed));
  await ui.click('[aria-label="Close search"]');
  await new Promise((r) => setTimeout(r, 250));

  // Bottom nav destinations scroll their section under the sticky header.
  for (const [label, target] of [
    ['Weekly', 'weekly'],
    ['Clubs', 'clubs'],
    ['Feed', 'feed'],
  ]) {
    await ui.clickText('[data-testid="bottom-nav"]', label);
    await new Promise((r) => setTimeout(r, 600));
    const reached = await page.evaluate((navTarget) => {
      const section = document.querySelector(`[data-nav-target="${navTarget}"]`);
      if (!section) return { found: false };
      const rect = section.getBoundingClientRect();
      return {
        found: true,
        top: Math.round(rect.top),
        scrolled: window.scrollY,
        viewport: window.innerHeight,
        // The last section cannot scroll to the top; the page just runs out.
        atEnd:
          window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2,
        visible: rect.top < window.innerHeight && rect.bottom > 0,
      };
    }, target);
    check(`bottom nav scrolls to ${label}`, reached.found && reached.visible === true, JSON.stringify(reached));
    if (label !== 'Feed') {
      check(
        `${label} lands below the sticky header, not under it`,
        reached.top >= 0 && (reached.top <= 120 || reached.atEnd),
        `top ${reached.top}px after scrolling ${reached.scrolled}px`
      );
    }
  }

  /* --- empty state ------------------------------------------------------- */
  console.log('  · empty state');
  await ui.type('[data-testid="feed-search"]', 'no-such-activity-xyz');
  await new Promise((r) => setTimeout(r, 300));
  const emptyState = await page.evaluate(() => {
    const feed = document.querySelector('[data-testid="activity-feed"]');
    return {
      cards: document.querySelectorAll('[data-testid="activity-card"]').length,
      text: (feed?.textContent ?? '').replace(/\s+/g, ' ').trim(),
      hasClear: Boolean(feed?.querySelector('button')),
    };
  });
  check('an unmatched search shows no cards', emptyState.cards === 0);
  check('the empty feed explains itself', emptyState.text.includes('No activities match these filters'), emptyState.text.slice(0, 80));
  check('the empty state offers a way out', emptyState.hasClear);

  await page.evaluate(() => {
    const feed = document.querySelector('[data-testid="activity-feed"]');
    const button = [...(feed?.querySelectorAll('button') ?? [])].find((b) => b.textContent.includes('Clear filters'));
    button?.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  const afterClear = await page.evaluate(() => ({
    cards: document.querySelectorAll('[data-testid="activity-card"]').length,
    search: document.querySelector('[data-testid="feed-search"]')?.value ?? null,
    headerSearch: document.querySelector('[data-testid="header-search-input"]')?.value ?? null,
  }));
  check('clearing from the empty state restores the feed', afterClear.cards === 5, `${afterClear.cards} cards`);
  check('clearing from the empty state clears the search box', afterClear.search === '' && afterClear.headerSearch === '', JSON.stringify(afterClear));

  await shot(page, 'interactions-390-after');
  await page.close();
}

/* -------------------------------------------------------------------- run */

async function main() {
  if (existsSync(ARTIFACTS)) rmSync(ARTIFACTS, { recursive: true, force: true });
  mkdirSync(ARTIFACTS, { recursive: true });

  const servers = [];
  if (!urlArg && suites.includes('modules')) {
    servers.push(startServer(['dev', '--port', String(DEV_PORT), '--strictPort'], DEV_URL));
  }
  if (!urlArg && suites.some((s) => s !== 'modules')) {
    servers.push(startServer(['preview', '--port', String(PREVIEW_PORT), '--strictPort'], PREVIEW_URL));
  }
  await Promise.all(servers.map((s) => s.ready));

  const browser = await launchBrowser();
  try {
    if (suites.includes('modules')) await runModuleSuite(browser, urlArg ?? DEV_URL);
    if (suites.includes('ui')) await runUiSuite(browser, urlArg ?? PREVIEW_URL);
    if (suites.includes('responsive')) await runResponsiveSuite(browser, urlArg ?? PREVIEW_URL);
    if (suites.includes('interactions')) await runInteractionSuite(browser, urlArg ?? PREVIEW_URL);
  } finally {
    await browser.close();
    for (const s of servers) s.child.kill('SIGTERM');
  }

  const noisy = consoleIssues.filter(
    (i) =>
      !(i.type === 'server' && /Debugger listening|Press h|ready in|Local:|Network:/i.test(i.text)) &&
      !(i.type === 'warning' && /Third-party cookie|Sourcemap/i.test(i.text))
  );
  const unexpected = [];
  for (const issue of noisy) {
    if (EXPECTED_NOISE.some((re) => re.test(issue.text))) expectedIssues.push(issue);
    else unexpected.push(issue);
  }

  console.log('\n─── browser console ───');
  if (expectedIssues.length === 0) {
    console.log('  no console output');
  } else {
    expectedIssues.forEach((i) => console.log(`  (expected) [${i.type}] ${i.text}`));
  }
  if (unexpected.length === 0) console.log('  clean: no console errors, page errors or failed requests');
  else unexpected.forEach((i) => console.log(`  [${i.type}] ${i.text}`));
  check('browser console is clean', unexpected.length === 0, `${unexpected.length} issue(s)`);

  console.log(`\n─── result ───\n  ${passes.length} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
