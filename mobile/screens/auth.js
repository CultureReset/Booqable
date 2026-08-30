/* Onboarding: splash → sign in → 2FA → workspace → permissions.
   Standalone screens hide the bottom navigation, as Android does
   before a user is inside the app graph. */

import { MobileRegistry, Nav } from '../core/nav.js';
import { Data } from '../../src/core/store.js';
import { esc } from '../../src/core/util.js';
import { icon, appbar, btn, textField, listItem, scroll, banner } from '../core/m3.js';

MobileRegistry.screen({
  id: 'splash', title: 'Splash', group: 'Onboarding', order: 10, standalone: true,
  describe: 'Android 12+ SplashScreen API: the adaptive icon animates on the branded background while the app warms up.',
  render: () => `
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--md-primary-container);gap:22px">
      <div style="width:104px;height:104px;border-radius:50%;background:var(--md-primary);display:grid;place-items:center;color:var(--md-on-primary);font-size:44px;font-weight:700;box-shadow:var(--el3)">N</div>
      <div style="text-align:center">
        <div class="headline-s" style="color:var(--md-on-primary-container)">Northlight</div>
        <div class="body-m" style="color:var(--md-on-primary-container);opacity:.75">Rental operations</div>
      </div>
      <div style="position:absolute;bottom:44px;width:60%"><div class="linear"><i style="width:70%"></i></div></div>
    </div>`
});

MobileRegistry.screen({
  id: 'signin', title: 'Sign in', group: 'Onboarding', order: 20, standalone: true,
  describe: 'Email + password with a visibility toggle, SSO, and a recovery path. Errors are inline, never a dialog.',
  render: () => scroll(`
    <div style="padding:44px 24px 24px">
      <div style="width:60px;height:60px;border-radius:18px;background:var(--md-primary);display:grid;place-items:center;color:var(--md-on-primary);font-size:26px;font-weight:700">N</div>
      <div class="headline-m" style="margin-top:26px">Welcome back</div>
      <div class="body-m on-var" style="margin-top:6px">Sign in to Northlight Rentals</div>
      <div style="margin-top:26px">
        ${textField({ label: 'Work email', value: 'maya@northlightrentals.com', type: 'email', outlined: true })}
        ${textField({ label: 'Password', value: '••••••••••', type: 'password', outlined: true, supporting: 'At least 12 characters' })}
      </div>
      <div class="spread" style="margin:6px 0 22px">
        <button class="li state" style="min-height:40px;padding:0;width:auto;gap:10px;background:none">
          <span class="checkbox on">${icon('check', 14, 3)}</span><span class="body-m">Keep me signed in</span></button>
        <button class="btn text state" data-act="auth.forgot">Forgot?</button>
      </div>
      ${btn({ label: 'Sign in', kind: 'filled', wide: true, act: 'auth.signin' })}
      <div class="rowc" style="margin:22px 0"><div style="flex:1;height:1px;background:var(--md-outline-variant)"></div>
        <span class="label-m on-var">OR</span><div style="flex:1;height:1px;background:var(--md-outline-variant)"></div></div>
      ${btn({ label: 'Continue with Google', kind: 'outlined', wide: true, act: 'auth.sso', icon: 'shield' })}
      <div class="sp16"></div>
      ${btn({ label: 'Use single sign-on (SAML)', kind: 'text', wide: true, act: 'auth.sso' })}
      <div class="body-s on-var" style="text-align:center;margin-top:30px;line-height:1.6">
        By signing in you accept the Terms of Service<br>and the Privacy Policy.</div>
    </div>`)
});

MobileRegistry.screen({
  id: 'twofa', title: 'Two-factor', group: 'Onboarding', order: 30, standalone: true,
  describe: 'Six-digit authenticator step. Enforced for every member when the account requires 2FA.',
  render: ({ params = {} }) => `
    ${appbar({ title: '', nav: 'back' })}
    ${scroll(`<div style="padding:8px 24px 24px">
      <div class="headline-m">Verify it's you</div>
      <div class="body-m on-var" style="margin-top:8px;line-height:1.6">Enter the 6-digit code from your authenticator app for <b>maya@northlightrentals.com</b>.</div>
      <div class="rowc" style="gap:8px;margin:32px 0 8px;justify-content:space-between">
        ${[4, 1, 9, 0, null, null].map((d, i) => `
          <div style="flex:1;height:60px;border:${i === 4 ? '2px solid var(--md-primary)' : '1px solid var(--md-outline)'};border-radius:var(--sh-sm);display:grid;place-items:center;font-size:24px;font-family:var(--font-mono)">${d ?? (i === 4 ? '<span style="width:1px;height:26px;background:var(--md-primary);display:block;animation:fade 1s infinite alternate"></span>' : '')}</div>`).join('')}
      </div>
      ${params.error ? banner('', 'That code has expired. Codes rotate every 30 seconds.') : ''}
      <div class="body-s on-var" style="margin:18px 0 26px">Code refreshes in 0:18</div>
      ${btn({ label: 'Verify', kind: 'filled', wide: true, act: 'auth.verify' })}
      <div class="sp16"></div>
      ${btn({ label: 'Use a recovery code', kind: 'text', wide: true, act: 'auth.recovery' })}
    </div>`)}`
});

MobileRegistry.screen({
  id: 'workspace', title: 'Choose workspace', group: 'Onboarding', order: 40, standalone: true,
  describe: 'Account and home-location picker. Multi-location businesses pick the counter they are standing at — it filters every list that follows.',
  render: () => `
    ${appbar({ title: 'Choose workspace', nav: 'back' })}
    ${scroll(`
      <div class="section-h">Account</div>
      ${listItem({ lead: 'N', headline: 'Northlight Rentals', support: 'Pro plan · 4 members', trail: `<span class="radio on"></span>` })}
      ${listItem({ lead: 'C', headline: 'Cascade AV (demo)', support: 'Trial · expires in 6 days', trail: `<span class="radio"></span>` })}
      <div class="section-h">Home location</div>
      ${Data.locations().map((l, i) => listItem({
        lead: `<span class="label-l">${esc(l.code)}</span>`, square: true,
        headline: esc(l.name), support: esc(l.type),
        trail: `<span class="radio ${i === 0 ? 'on' : ''}"></span>`,
        act: 'auth.pickLocation', data: { value: l.id }
      })).join('')}
      <div style="padding:24px 16px">${btn({ label: 'Continue', kind: 'filled', wide: true, act: 'auth.continue' })}</div>
    `)}`
});

MobileRegistry.screen({
  id: 'permissions', title: 'Permissions', group: 'Onboarding', order: 50, standalone: true,
  describe: 'Rationale before the system prompts. Android 13+ requires an explicit notifications grant; the camera is only asked for when Scan is first opened.',
  render: () => `
    ${appbar({ title: '', nav: 'back' })}
    ${scroll(`<div style="padding:8px 24px 24px">
      <div class="headline-m">Two permissions</div>
      <div class="body-m on-var" style="margin-top:8px;line-height:1.6">Both are optional. The app works without them — these just make the counter faster.</div>
      <div style="margin-top:28px" class="gap">
        ${[
          ['camera', 'Camera', 'Scan barcodes and QR codes on cases, customer cards and order sheets. Nothing is uploaded — decoding happens on the device.'],
          ['bell', 'Notifications', 'Overdue returns, new online bookings, and payment confirmations. You choose which in Settings.']
        ].map(([ic, t, b]) => `<div class="card outlined card-pad">
          <div class="rowc" style="gap:14px;align-items:flex-start">
            <span style="width:44px;height:44px;border-radius:var(--sh-full);background:var(--md-secondary-container);color:var(--md-on-secondary-container);display:grid;place-items:center;flex:none">${icon(ic, 22, 2)}</span>
            <div><div class="title-m">${t}</div><div class="body-m on-var" style="margin-top:4px;line-height:1.55">${b}</div></div>
          </div></div>`).join('')}
      </div>
      <div style="margin-top:28px">${btn({ label: 'Allow both', kind: 'filled', wide: true, act: 'auth.allow' })}</div>
      <div class="sp8"></div>
      ${btn({ label: 'Not now', kind: 'text', wide: true, act: 'auth.continue' })}
    </div>`)}`
});

export const AUTH_ACTIONS = {
  'auth.signin': () => Nav.goto('twofa'),
  'auth.verify': () => Nav.goto('workspace'),
  'auth.pickLocation': () => Nav.toast('Home location set to Portland Warehouse'),
  'auth.continue': () => Nav.goto('permissions'),
  'auth.allow': () => { Nav.reset(); Nav.toast('You are signed in'); },
  'auth.sso': () => Nav.toast('Redirecting to your identity provider…'),
  'auth.forgot': () => Nav.toast('Reset link sent to your work email'),
  'auth.recovery': () => Nav.toast('Enter one of your 10 saved recovery codes')
};
