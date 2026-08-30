/* Google Play submission surface: the listing as users see it, the
   assets Play requires, the permissions and Data safety declarations,
   and the technical build targets. Screenshots are rendered from the
   live app, so they cannot go stale. */

import { MobileRegistry } from './core/nav.js';
import { esc } from '../src/core/util.js';
import { icon } from './core/m3.js';

const SHOTS = [
  ['today', 'Every pickup and return, in one screen'],
  ['order', 'The whole order, one thumb away'],
  ['pickup', 'Scan it out. Nothing gets missed'],
  ['scan', 'Answer "whose is this?" in a second'],
  ['catalog', 'Know what is free before you promise it'],
  ['return', 'Check it back in, settle the deposit'],
  ['calendar', 'The week ahead at a glance'],
  ['shopHome', 'Let customers book themselves']
];

const ASSETS = [
  ['App icon', '512 × 512 PNG, 32-bit, no alpha', 'Adaptive icon: 108dp foreground + background layers, safe zone 66dp'],
  ['Feature graphic', '1024 × 500 PNG or JPEG', 'No transparency; text kept inside the middle 80%'],
  ['Phone screenshots', '2–8, 16:9 or 9:16, min 320px', '1080 × 1920 recommended, from the 8 below'],
  ['7-inch tablet', 'Optional, up to 8', 'Required for a "designed for tablets" badge'],
  ['10-inch tablet', 'Optional, up to 8', 'Shows the two-pane layout'],
  ['Promo video', 'Optional YouTube URL', '30–120 seconds, first 10 seconds carry it']
];

const PERMISSIONS = [
  ['CAMERA', 'Runtime', 'Barcode and QR scanning at the counter', 'Requested when Scan is first opened, with rationale'],
  ['POST_NOTIFICATIONS', 'Runtime · API 33+', 'Overdue returns, new bookings, payment confirmations', 'Requested after the first successful sign-in'],
  ['INTERNET', 'Normal', 'Sync with the rental account', 'Granted at install'],
  ['ACCESS_NETWORK_STATE', 'Normal', 'Queue writes while offline', 'Granted at install'],
  ['NFC', 'Normal · optional', 'Tap to Pay on Android', 'Declared uses-feature required="false"'],
  ['VIBRATE', 'Normal', 'Scan confirmation haptics', 'Granted at install']
];

const DATA_SAFETY = [
  ['Name, email, phone', 'Collected · shared with payment processor', 'Account and order handling', 'Yes — deletable on request'],
  ['Payment info', 'Processed by Stripe, never stored in the app', 'Taking rental payments', 'Not retained on device'],
  ['Photos', 'Optional · damage photos on returns', 'Condition evidence', 'Deleted with the order'],
  ['App activity', 'Collected · not shared', 'Crash reporting and diagnostics', 'Opt-out in Settings'],
  ['Approximate location', 'Not collected', '—', '—']
];

const TECH = [
  ['Package', 'com.northlightrentals.operator'],
  ['Min SDK', '26 — Android 8.0 Oreo'],
  ['Target SDK', '35 — Android 15'],
  ['Compile SDK', '35'],
  ['Format', 'Android App Bundle (.aab)'],
  ['Architectures', 'arm64-v8a, armeabi-v7a, x86_64'],
  ['Signing', 'Play App Signing, upload key in the CI secret store'],
  ['Content rating', 'IARC — Everyone (business tool)'],
  ['Category', 'Business'],
  ['In-app purchases', 'None — billed through the web account'],
  ['Ads', 'None'],
  ['Accessibility', 'TalkBack labels on every control, 48dp targets, 4.5:1 contrast']
];

const RELEASE = [
  [true, 'Every screen reachable and rendering with real data'],
  [true, 'Light and dark themes, plus Material You dynamic colour'],
  [true, 'Per-tab back stacks and predictive back'],
  [true, 'Adaptive layouts for fold and tablet widths'],
  [true, 'Offline queue with a visible sync state'],
  [true, 'Store listing copy, screenshots and feature graphic sourced from the app'],
  [false, 'Signed release bundle — needs the Android SDK and an upload key'],
  [false, 'Instrumented tests on a device matrix — needs Firebase Test Lab or equivalent'],
  [false, 'Play Console account, privacy-policy URL and Data safety form submitted']
];

export function renderStore({ screenBody, deviceChrome }) {
  const mini = id => {
    const def = MobileRegistry.get(id);
    return def ? `<div class="mini m3">${deviceChrome(screenBody(def, def.demo ? def.demo() : {}, {}), { standalone: def.standalone, tab: def.tab })}</div>` : '';
  };

  return `
  <div class="storegrid" style="margin-bottom:20px">
    <div class="listing">
      <div class="listing-head">
        <div class="appicon adaptive">N</div>
        <div>
          <div style="font-size:20px;font-weight:600">Northlight Rentals</div>
          <div style="color:var(--page-accent);font-size:13px;margin-top:2px">Northlight Software</div>
          <div style="color:var(--page-dim);font-size:12px;margin-top:6px">Contains no ads · In-app purchases: none</div>
        </div>
      </div>
      <div style="display:flex;border-top:1px solid var(--page-line);border-bottom:1px solid var(--page-line)">
        ${[['4.8★', '212 reviews'], ['5K+', 'Downloads'], ['3+', 'Rated for']].map(([a, b]) => `
          <div style="flex:1;padding:12px;text-align:center;border-right:1px solid var(--page-line)">
            <div style="font-weight:600;font-size:15px">${a}</div>
            <div style="color:var(--page-dim);font-size:11px;margin-top:2px">${b}</div></div>`).join('')}
      </div>
      <div style="padding:16px 18px">
        <div style="font-weight:600;margin-bottom:8px">About this app</div>
        <div style="color:var(--page-dim);font-size:13.5px;line-height:1.65">
          Run your rental business from the counter. See every pickup and return for the day, scan gear out and back in,
          take payment on the spot with Tap to Pay, and know what is actually free before you promise it.
          <br><br>Built for equipment, event and party rental teams. Works with the same account as the web dashboard —
          anything you do here shows up there instantly, and queues safely when the warehouse Wi-Fi drops.
        </div>
        <div style="font-weight:600;margin:16px 0 8px">What's new · 4.12.2</div>
        <div style="color:var(--page-dim);font-size:13.5px;line-height:1.65">
          Faster barcode decoding · deposit capture on the return screen · Material You colour · fixes for foldables.
        </div>
      </div>
    </div>

    <div class="listing">
      <div style="padding:16px 18px 6px;font-weight:600">Store listing copy</div>
      <table class="storetable">
        <tr><td style="width:34%;color:var(--page-dim)">App name</td><td>Northlight Rentals <span style="color:var(--page-dim)">(19/30)</span></td></tr>
        <tr><td style="color:var(--page-dim)">Short description</td><td>Run rentals from the counter: scan gear out, take payment, know what's free. <span style="color:var(--page-dim)">(72/80)</span></td></tr>
        <tr><td style="color:var(--page-dim)">Category</td><td>Business</td></tr>
        <tr><td style="color:var(--page-dim)">Tags</td><td>rental, inventory, point of sale, barcode, equipment</td></tr>
        <tr><td style="color:var(--page-dim)">Contact</td><td>support@northlightrentals.com · northlightrentals.com</td></tr>
        <tr><td style="color:var(--page-dim)">Privacy policy</td><td><code>https://northlightrentals.com/privacy</code></td></tr>
        <tr><td style="color:var(--page-dim)">Countries</td><td>US, CA, GB, NL, DE, AU, NZ</td></tr>
        <tr><td style="color:var(--page-dim)">Release track</td><td>Internal → Closed (20 testers) → Production, staged 20%</td></tr>
      </table>
    </div>
  </div>

  <div class="listing" style="margin-bottom:20px">
    <div style="padding:16px 18px 0;font-weight:600">Phone screenshots</div>
    <div style="padding:4px 18px 0;color:var(--page-dim);font-size:12.5px">Captured from the live app — the caption is the store caption.</div>
    <div class="shotstrip">
      ${SHOTS.map(([id, cap]) => `
        <div class="s"><div class="sf" data-goto="${esc(id)}" style="cursor:pointer">${mini(id)}</div>
        <div class="sc">${esc(cap)}</div></div>`).join('')}
    </div>
  </div>

  <div class="storegrid">
    <div class="listing">
      <div style="padding:16px 18px 6px;font-weight:600">Graphic assets</div>
      <table class="storetable">
        <thead><tr><th>Asset</th><th>Spec</th><th>Note</th></tr></thead>
        ${ASSETS.map(r => `<tr><td style="font-weight:500">${esc(r[0])}</td><td><code>${esc(r[1])}</code></td><td style="color:var(--page-dim)">${esc(r[2])}</td></tr>`).join('')}
      </table>
    </div>
    <div class="listing">
      <div style="padding:16px 18px 6px;font-weight:600">Technical</div>
      <table class="storetable">
        ${TECH.map(r => `<tr><td style="width:40%;color:var(--page-dim)">${esc(r[0])}</td><td><code>${esc(r[1])}</code></td></tr>`).join('')}
      </table>
    </div>
  </div>

  <div class="listing" style="margin-top:20px">
    <div style="padding:16px 18px 6px;font-weight:600">Permissions</div>
    <div style="padding:0 18px 8px;color:var(--page-dim);font-size:12.5px">Every runtime permission is asked in context, with a rationale screen first. Nothing is requested at launch.</div>
    <table class="storetable">
      <thead><tr><th>Permission</th><th>Type</th><th>Why</th><th>When asked</th></tr></thead>
      ${PERMISSIONS.map(r => `<tr><td><code>${esc(r[0])}</code></td><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td style="color:var(--page-dim)">${esc(r[3])}</td></tr>`).join('')}
    </table>
  </div>

  <div class="listing" style="margin-top:20px">
    <div style="padding:16px 18px 6px;font-weight:600">Data safety declaration</div>
    <table class="storetable">
      <thead><tr><th>Data type</th><th>Handling</th><th>Purpose</th><th>Deletion</th></tr></thead>
      ${DATA_SAFETY.map(r => `<tr><td style="font-weight:500">${esc(r[0])}</td><td>${esc(r[1])}</td><td style="color:var(--page-dim)">${esc(r[2])}</td><td style="color:var(--page-dim)">${esc(r[3])}</td></tr>`).join('')}
    </table>
  </div>

  <div class="listing" style="margin-top:20px">
    <div style="padding:16px 18px 6px;font-weight:600">Release readiness</div>
    <div style="padding:0 18px 16px">
      ${RELEASE.map(([ok, label]) => `<div class="checkline">
        <span class="${ok ? 'tick' : 'cross'}">${ok ? '✓' : '○'}</span>
        <span>${esc(label)}</span></div>`).join('')}
      <div style="margin-top:14px;color:var(--page-dim);font-size:12.5px;line-height:1.6">
        The three open items all need an Android toolchain and a Play Console account — an SDK, a keystore and a device
        matrix. Everything that can be designed, specified and proven without them is done and visible above.
      </div>
    </div>
  </div>
  ${icon('info', 0)}`;
}
