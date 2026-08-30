/* Android navigation.

   Real per-tab back stacks (the Android pattern: each bottom-nav
   destination keeps its own history), a system back button that pops
   the current stack and falls back to the start destination, and
   sheets/dialogs/snackbars that also participate in back.

   Screens register themselves; the gallery, the flow walkthroughs and
   the Play Store screenshot strip all enumerate the same registry. */

const screens = new Map();
const order = [];

export const MobileRegistry = {
  screen(def) {
    if (!def.id) throw new Error('screen needs an id');
    screens.set(def.id, def);
    order.push(def.id);
    return def;
  },
  get: id => screens.get(id),
  all: () => order.map(id => screens.get(id)).sort((a, b) => (a.order ?? 100) - (b.order ?? 100)),
  byGroup() {
    const groups = [];
    MobileRegistry.all().forEach(s => {
      const g = groups.find(x => x.name === s.group);
      if (g) g.items.push(s); else groups.push({ name: s.group, items: [s] });
    });
    return groups;
  },
  count: () => screens.size
};

export const TABS = [
  { id: 'today', label: 'Today', icon: 'today', start: 'today' },
  { id: 'orders', label: 'Orders', icon: 'orders', start: 'orders' },
  { id: 'scan', label: 'Scan', icon: 'scan', start: 'scan' },
  { id: 'catalog', label: 'Catalog', icon: 'catalog', start: 'catalog' },
  { id: 'more', label: 'More', icon: 'more', start: 'more' }
];

const freshStacks = () => Object.fromEntries(TABS.map(t => [t.id, [{ id: t.start, params: {} }]]));

export const Nav = {
  tab: 'today',
  stacks: freshStacks(),
  overlay: null,          // { kind:'sheet'|'dialog'|'menu', ... }
  snack: null,
  direction: 'fwd',
  signedIn: true,
  onChange: () => {},

  stack() { return Nav.stacks[Nav.tab]; },
  top() { return Nav.stack()[Nav.stack().length - 1]; },
  screen() { return MobileRegistry.get(Nav.top().id); },
  depth() { return Nav.stack().length; },

  push(id, params = {}) {
    if (!MobileRegistry.get(id)) return Nav.toast(`No screen registered for "${id}"`);
    Nav.stack().push({ id, params });
    Nav.direction = 'fwd';
    Nav.overlay = null;
    Nav.onChange();
  },
  replace(id, params = {}) {
    Nav.stack()[Nav.stack().length - 1] = { id, params };
    Nav.direction = 'fwd';
    Nav.onChange();
  },
  /* System back: overlays first, then the stack, then the tab's start. */
  back() {
    if (Nav.overlay) { Nav.overlay = null; return Nav.onChange(); }
    if (Nav.depth() > 1) { Nav.stack().pop(); Nav.direction = 'back'; return Nav.onChange(); }
    if (Nav.tab !== 'today') { Nav.tab = 'today'; Nav.direction = 'back'; return Nav.onChange(); }
    Nav.toast('Press back again to leave the app');
  },
  switchTab(id) {
    if (Nav.tab === id) { Nav.stacks[id] = [{ id: TABS.find(t => t.id === id).start, params: {} }]; }
    Nav.tab = id;
    Nav.direction = 'fwd';
    Nav.overlay = null;
    Nav.onChange();
  },
  /* Jump straight to any screen — used by the gallery and deep links. */
  goto(id, params = {}) {
    const def = MobileRegistry.get(id);
    if (!def) return;
    const tab = def.tab || 'today';
    if (TABS.some(t => t.id === tab)) {
      Nav.tab = tab;
      const start = TABS.find(t => t.id === tab).start;
      Nav.stacks[tab] = id === start ? [{ id, params }] : [{ id: start, params: {} }, { id, params }];
    } else {
      Nav.stacks[Nav.tab] = [{ id, params }];
    }
    Nav.overlay = null;
    Nav.direction = 'fwd';
    Nav.onChange();
  },
  reset() { Nav.stacks = freshStacks(); Nav.tab = 'today'; Nav.overlay = null; Nav.onChange(); },

  sheet(cfg) { Nav.overlay = { kind: 'sheet', ...cfg }; Nav.onChange(); },
  dialog(cfg) { Nav.overlay = { kind: 'dialog', ...cfg }; Nav.onChange(); },
  menu(cfg) { Nav.overlay = { kind: 'menu', ...cfg }; Nav.onChange(); },
  dismiss() { Nav.overlay = null; Nav.onChange(); },

  toast(message, action) {
    Nav.snack = { message, action, at: Date.now() };
    Nav.onChange();
    clearTimeout(Nav._snackTimer);
    Nav._snackTimer = setTimeout(() => { Nav.snack = null; Nav.onChange(); }, 3200);
  },

  /* Breadcrumb of the live stack, shown beside the device. */
  trail() {
    return Nav.stack().map((e, i) => {
      const s = MobileRegistry.get(e.id);
      return (i === Nav.stack().length - 1 ? `<b>${s ? s.title : e.id}</b>` : (s ? s.title : e.id));
    }).join(' › ');
  }
};
