import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { normaliseViewForRole } from '../src/domain/accessControl.js';
import {
  createDefaultUserSettings,
  notificationGroupsForRole,
  normaliseUserSettings,
  settingsSectionsForRole,
  tutorialDraftForStep,
  TUTORIAL_STEPS,
} from '../src/domain/userSettings.js';
import { playUiSound, triggerHaptic } from '../src/shared/experience/feedback.js';
import { createMockServices } from '../src/services/mock/createMockServices.js';
import { USER_ROLES } from '../src/services/contracts.js';

class TestStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const appSource = readFileSync('src/App.jsx', 'utf8');
const settingsSource = readFileSync('src/components/Settings.jsx', 'utf8');
const introSource = readFileSync('src/components/Intro.jsx', 'utf8');
const onboardingSource = readFileSync('src/components/CustomerOnboarding.jsx', 'utf8');
assert.equal(appSource.includes("from './apps/customer/CustomerPersonalisation"), false, 'the custom-theme wizard must not be mounted');
assert.equal(settingsSource.includes('type="color"'), false, 'official settings must not expose colour pickers');
assert.equal(settingsSource.includes('companyLogo'), false, 'customers must not replace official application branding');
assert.ok(settingsSource.includes('Sounds & Vibration'));
assert.ok(settingsSource.includes('Security & Sign-In'));
assert.ok(settingsSource.includes('Available after production integration'));
assert.ok(introSource.includes('animated-gauge'));
assert.ok(onboardingSource.includes('Tutorial Example'));
assert.equal(TUTORIAL_STEPS.length, 12);
for (const requiredAction of ['Start guided RFQ', 'Catalogue', 'Choose PBG', 'Configure this unit', 'Add configured unit to RFQ', 'Review fake RFQ', 'Submit fake RFQ', 'Track this fake RFQ', 'Finish tutorial']) {
  assert.ok(onboardingSource.includes(requiredAction), `interactive tutorial must include ${requiredAction}`);
}
assert.deepEqual(tutorialDraftForStep(0), { range: '', connection: '', application: '', fulfilment: '', consent: false });
assert.equal(tutorialDraftForStep(11).application, 'Water-line pressure monitoring tutorial');

for (const asset of [
  'rhomberg-connect-logo-master-transparent.png',
  'rhomberg-connect-logo-full-light.png',
  'rhomberg-connect-logo-full-dark.png',
  'rhomberg-connect-logo-compact.png',
  'rhomberg-connect-symbol.png',
  'rhomberg-connect-logo-splash.png',
  'rhomberg-connect-logo-loading.png',
  'rhomberg-connect-logo-email.png',
  'rhomberg-connect-logo-monochrome.png',
  'rhomberg-connect-icon-512.png',
  'rhomberg-connect-icon-192.png',
  'favicon.ico',
]) {
  const path = `assets/images/${asset}`;
  assert.ok(existsSync(path) && statSync(path).size > 100, `${asset} must be a usable brand asset`);
}

for (const role of Object.values(USER_ROLES)) {
  assert.equal(normaliseViewForRole(role, 'settings'), 'settings', `${role} must have a dedicated settings route`);
  assert.ok(settingsSectionsForRole(role).includes('sounds'));
  assert.ok(settingsSectionsForRole(role).includes('security'));
  assert.ok(notificationGroupsForRole(role).length > 0);
}
assert.equal(settingsSectionsForRole(USER_ROLES.CUSTOMER).includes('privacy'), true);
assert.equal(settingsSectionsForRole(USER_ROLES.DISPATCH).includes('privacy'), false);

const defaults = createDefaultUserSettings();
assert.deepEqual(defaults.appearance.mode, 'system');
assert.equal(defaults.sounds.enabled, true);
assert.ok(defaults.sounds.volume >= 0.45, 'default feedback should be clearly audible while remaining user-adjustable');
assert.equal(defaults.haptics.enabled, true);
assert.equal(playUiSound({ ...defaults, sounds: { ...defaults.sounds, enabled: false } }, 'success'), false);
assert.equal(triggerHaptic({ ...defaults, haptics: { ...defaults.haptics, enabled: false } }, 'success'), false);
const reduced = normaliseUserSettings({ accessibility: { reduceMotion: true }, sounds: { enabled: false } });
assert.equal(reduced.accessibility.reduceMotion, true);
assert.equal(reduced.sounds.enabled, false);

const storage = new TestStorage();
const services = createMockServices({ storage, now: () => new Date('2026-08-09T08:00:00.000Z') });
await services.initialize();
await services.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
const beforeRecords = await services.enquiries.list();
let saved = await services.userSettings.save({ ...defaults, appearance: { ...defaults.appearance, mode: 'dark', increasedText: true }, sounds: { ...defaults.sounds, enabled: false } });
saved = await services.userSettings.completeWelcome();
saved = await services.userSettings.saveTutorialProgress({ step: 7, tutorialKind: 'rfq', completed: false });
assert.equal(saved.onboarding.welcomeCompleted, true);
assert.equal(saved.onboarding.tutorialProgress, 7);
assert.equal(saved.appearance.mode, 'dark');
assert.equal(saved.sounds.enabled, false);
assert.equal((await services.enquiries.list()).length, beforeRecords.length, 'tutorial progress must not create an operational RFQ');
await services.auth.signOut();
await services.auth.signIn({ email: 'cape.demo@client.test', password: 'Demo123!' });
assert.equal((await services.userSettings.get()).onboarding.tutorialProgress, 7, 'settings must persist through the service layer');
await services.auth.signOut();
await services.auth.signIn({ email: 'dispatch.workflow@example.invalid', password: 'Dispatch123!' });
assert.equal((await services.userSettings.get()).appearance.mode, 'system', 'settings must remain account-isolated');
await services.userSettings.save({ ...defaults, haptics: { ...defaults.haptics, enabled: false } });
await services.auth.signOut();
await services.auth.signIn({ email: 'administrator.workflow@example.invalid', password: 'Admin123!' });
const audits = await services.audit.list();
assert.ok(audits.some(event => event.action === 'user.settings_saved'), 'settings changes must create immutable audit evidence');

console.log('Official branding, onboarding, role-aware settings, feedback and tutorial-isolation tests passed.');
