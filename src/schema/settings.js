/* Settings as data.

   Panels declare a `kind` — form, table, switches, or custom — and the
   settings module renders them generically. Eighteen panels, no
   branching: adding one is a Registry.panel() call from any file,
   including a feature module that wants its own settings page. */

import { Registry } from '../core/registry.js';
import { Data } from '../core/store.js';

export function registerSettingsPanels() {
  const P = def => Registry.panel(def);

  /* ---------------- General ---------------- */
  P({ id: 'company', group: 'General', label: 'Company information', order: 10, kind: 'form',
      title: 'Company information', sub: 'Shown on every quote, contract and invoice you send.',
      config: 'company', save: 'settings.saveCompany',
      fields: [
        { key: 'name', label: 'Trading name', type: 'text' },
        { key: 'legal', label: 'Legal entity', type: 'text' },
        { key: 'email', label: 'Email', type: 'text' },
        { key: 'phone', label: 'Phone', type: 'text' },
        { key: 'site', label: 'Website', type: 'text' },
        { key: 'address', label: 'Street address', type: 'text' },
        { key: 'city', label: 'City', type: 'text' },
        { key: 'zip', label: 'Postal code', type: 'text' },
        { key: 'country', label: 'Country', type: 'text' },
        { key: 'vat', label: 'VAT / tax number', type: 'mono' },
        { key: 'registration', label: 'Registration', type: 'mono' }
      ] });

  P({ id: 'datetime', group: 'General', label: 'Date, time & locale', order: 20, kind: 'form',
      title: 'Date, time & locale', sub: 'Formatting rules applied everywhere in the account.',
      config: 'company', save: 'settings.saveCompany',
      note: { tone: 'info', html: '<b>Rental periods are inclusive of both ends.</b> A Friday 09:00 → Monday 09:00 booking is a 3-day charge, and the unit is unavailable for the whole span plus any buffer.' },
      fields: [
        { key: 'currency', label: 'Currency', type: 'select', options: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'] },
        { key: 'dateFormat', label: 'Date format', type: 'select', options: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] },
        { key: 'timeFormat', label: 'Time format', type: 'select', options: ['12h', '24h'] },
        { key: 'timezone', label: 'Time zone', type: 'select', options: ['America/Los_Angeles', 'America/New_York', 'Europe/Amsterdam'] },
        { key: 'weekStart', label: 'Week starts on', type: 'select', options: ['Monday', 'Sunday'] },
        { key: 'language', label: 'Language', type: 'select', options: ['English (US)', 'English (UK)', 'Nederlands', 'Deutsch', 'Français'] }
      ] });

  P({ id: 'labels', group: 'General', label: 'Account labels', order: 30, kind: 'form',
      title: 'Account labels', sub: 'Rename the objects so the app speaks your industry.',
      config: 'labels', save: 'settings.saveLabels',
      fields: [
        { key: 'customer', label: 'Customer is called', type: 'text', help: 'Party-rental companies often use "Client"; schools use "Student".' },
        { key: 'order', label: 'Order is called', type: 'text' },
        { key: 'product', label: 'Product is called', type: 'text' },
        { key: 'inventory', label: 'Inventory is called', type: 'text' }
      ] });

  P({ id: 'locations', group: 'General', label: 'Locations', order: 40, kind: 'table',
      title: 'Locations', sub: 'Where stock lives and where customers collect it.',
      entity: 'locations', rows: () => Data.locations(),
      columns: ['name', 'code', 'type', 'address', 'items'],
      add: 'Add location' });

  /* ---------------- Selling ---------------- */
  P({ id: 'pricing', group: 'Selling', label: 'Pricing defaults', order: 50, kind: 'custom',
      title: 'Pricing defaults', render: 'settings.pricing' });

  P({ id: 'tax', group: 'Selling', label: 'Tax rates & profiles', order: 60, kind: 'custom',
      title: 'Tax rates & profiles', render: 'settings.tax' });

  P({ id: 'coupons', group: 'Selling', label: 'Coupons', order: 70, kind: 'table',
      title: 'Coupons', entity: 'coupons', rows: () => Data.coupons(),
      columns: ['code', 'kind', 'value', 'uses', 'limit', 'active', 'note'],
      add: 'New coupon', addAction: 'coupon.new' });

  P({ id: 'payments', group: 'Selling', label: 'Payment providers', order: 80, kind: 'switches',
      title: 'Payment providers',
      items: () => Data.providers().map(p => ({
        id: p.id, on: p.on, label: p.name, help: `${p.methods} — ${p.note}`,
        badge: p.on ? { tone: 'good', label: 'Live' } : { tone: 'plain', label: 'Off' },
        action: 'provider.toggle'
      })),
      extra: [
        { label: 'Hold deposits as a pre-authorisation', on: true, help: "The customer's card is authorised but not charged. Valid for 7 days, then it must be captured or released." },
        { label: 'Release deposits automatically on return', on: true, help: 'Unless a damage amount is entered on the return screen.' }
      ] });

  /* ---------------- Operations ---------------- */
  P({ id: 'orders', group: 'Operations', label: 'Order defaults', order: 90, kind: 'form',
      title: 'Order defaults', config: 'orderDefaults', save: 'settings.saveDefaults',
      fields: [
        { key: 'pickupTime', label: 'Default pickup time', type: 'time' },
        { key: 'returnTime', label: 'Default return time', type: 'time' },
        { key: 'prefix', label: 'Order number prefix', type: 'text', placeholder: 'none' },
        { key: 'nextNumber', label: 'Next order number', type: 'mono' },
        { key: 'requireSignature', label: 'Require a signature before pickup', type: 'bool', style: 'switch',
          help: 'The pickup screen will not close without one.' },
        { key: 'warnShortage', label: 'Warn on shortages', type: 'bool', style: 'switch',
          help: 'Show a blocking warning when an order books more than is free.' },
        { key: 'autoArchive', label: 'Auto-archive returned orders after 30 days', type: 'bool', style: 'switch' }
      ] });

  P({ id: 'fields', group: 'Operations', label: 'Custom fields', order: 100, kind: 'table',
      title: 'Custom fields', sub: 'Extra data on orders, customers and products.',
      entity: 'customFields', rows: () => Data.customFields(),
      columns: ['label', 'entity', 'type', 'onDocs'], add: 'Add field' });

  P({ id: 'tags', group: 'Operations', label: 'Tags & collections', order: 110, kind: 'custom',
      title: 'Tags & collections', render: 'settings.tags' });

  /* ---------------- Communication ---------------- */
  P({ id: 'emails', group: 'Communication', label: 'Email templates', order: 120, kind: 'custom',
      title: 'Email templates', render: 'settings.emails' });

  P({ id: 'documents', group: 'Communication', label: 'Document templates', order: 130, kind: 'custom',
      title: 'Document templates', render: 'settings.documents' });

  /* ---------------- Account ---------------- */
  P({ id: 'team', group: 'Account', label: 'Team & permissions', order: 140, kind: 'custom',
      title: 'Team & permissions', render: 'settings.team' });

  P({ id: 'security', group: 'Account', label: 'Security', order: 150, kind: 'switches',
      title: 'Security',
      items: () => [
        { id: 'twofa', on: true, label: 'Enforce two-factor authentication',
          help: `Every team member must set up an authenticator app. ${Data.users().filter(u => !u.twofa).length} member(s) still need to.` },
        { id: 'sso', on: false, label: 'Single sign-on (SAML)', help: 'Available on Premium. Route logins through your identity provider.' },
        { id: 'ip', on: false, label: 'Restrict access by IP', help: 'Only allow the dashboard from listed addresses. The mobile POS is exempt.' },
        { id: 'exportlog', on: true, label: 'Log every data export', help: 'Who exported what, and when.' }
      ],
      note: () => {
        const n = Data.users().filter(u => !u.twofa).length;
        return n ? { tone: 'warn', html: `<b>${n} account without 2FA.</b> ${Data.users().find(u => !u.twofa).name} has not enrolled — enforcement will lock them out at next login until they do.` } : null;
      } });

  P({ id: 'api', group: 'Account', label: 'API & webhooks', order: 160, kind: 'custom',
      title: 'API & webhooks', render: 'settings.api' });

  P({ id: 'activity', group: 'Account', label: 'Activity log', order: 170, kind: 'custom',
      title: 'Activity log', sub: 'Every change made in this account, by whom and when.',
      render: 'settings.activity' });

  P({ id: 'billing', group: 'Account', label: 'Plan & billing', order: 180, kind: 'custom',
      title: 'Plan & billing', render: 'settings.billing' });
}

/* Panel groups, derived so a new group needs no separate declaration. */
export const panelGroups = () => {
  const out = [];
  Registry.panels().forEach(p => {
    const g = out.find(x => x.name === p.group);
    if (g) g.items.push(p); else out.push({ name: p.group, items: [p] });
  });
  return out;
};
