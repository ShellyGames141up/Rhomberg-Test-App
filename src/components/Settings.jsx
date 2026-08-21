import { useEffect, useMemo, useState } from 'react';
import { isCustomerAccount, roleProfileFor } from '../domain/accessControl.js';
import {
  APPEARANCE_MODES,
  notificationGroupsForRole,
  normaliseUserSettings,
  settingsSectionsForRole,
  SOUND_CATEGORIES,
  HAPTIC_CATEGORIES,
  TUTORIALS,
  showsDefaultLandingPageForRole,
} from '../domain/userSettings.js';
import { CredentialChangePanel } from './Account.jsx';
import { runtimeConfig } from '../services/runtimeConfig.js';

const SECTION_META = Object.freeze({
  home: ['Settings', 'Choose a category for your Rhomberg Connect experience.', '⌘'],
  app: ['App Settings', 'Choose how Rhomberg Connect behaves for your account.', 'A'],
  sounds: ['Sounds & Vibration', 'Control restrained interaction feedback for this device.', '♪'],
  notifications: ['Notifications', 'Choose the updates and delivery channels relevant to you.', '!'],
  appearance: ['Appearance', 'Use the official Rhomberg Connect design in Light, Dark or System mode.', '◐'],
  accessibility: ['Accessibility', 'Reduce effects and improve reading or assistive-technology support.', 'AA'],
  security: ['Security & Sign-In', 'Review your session and change your sign-in details.', '◇'],
  tutorials: ['Help & Tutorials', 'Replay the complete customer journey or a focused feature guide.', '?'],
  privacy: ['Privacy and Data', 'Review privacy, access and record controls.', 'i'],
  about: ['About Rhomberg Connect', 'View the application version and platform scope.', 'R'],
});

const categoryLabel = value => value.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase());
const preferenceKey = label => label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function Settings({
  account,
  initialValue,
  notificationPreferences,
  serviceMode,
  credentialActions,
  onCredentialChanged,
  onSwitchWorkspace,
  onSignOut,
  onSave,
  onSaveNotifications,
  onReset,
  onReplayTutorial,
  onTestSound,
  onTestHaptic,
  onClose,
}) {
  const [section, setSection] = useState(account.forcePasswordChange ? 'security' : 'home');
  const [draft, setDraft] = useState(() => normaliseUserSettings(initialValue));
  const [notificationDraft, setNotificationDraft] = useState(notificationPreferences);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const sections = useMemo(() => settingsSectionsForRole(account.role), [account.role]);
  const notificationGroups = useMemo(() => notificationGroupsForRole(account.role), [account.role]);

  useEffect(() => setDraft(normaliseUserSettings(initialValue)), [initialValue]);
  useEffect(() => setNotificationDraft(notificationPreferences), [notificationPreferences]);

  const patch = (group, values) => setDraft(current => ({ ...current, [group]: { ...current[group], ...values } }));
  const toggleMap = (group, map, key) => patch(group, { [map]: { ...draft[group][map], [key]: !draft[group][map][key] } });
  const save = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const candidate = showsDefaultLandingPageForRole(account.role)
        ? draft
        : { ...draft, app: { ...draft.app, defaultLandingPage: 'role_default' } };
      const saved = await onSave(candidate);
      if (section === 'notifications') await onSaveNotifications(notificationDraft);
      setDraft(normaliseUserSettings(saved));
      setMessage('Settings saved for this account.');
    } catch (reason) { setError(reason?.message || 'The settings could not be saved.'); }
    finally { setBusy(false); }
  };
  const reset = async () => {
    setBusy(true); setError('');
    try { const saved = await onReset(); setDraft(normaliseUserSettings(saved)); setMessage('Official Rhomberg Connect defaults restored.'); }
    catch (reason) { setError(reason?.message || 'Defaults could not be restored.'); }
    finally { setBusy(false); }
  };
  const meta = SECTION_META[section];

  return <section className="app-screen settings-screen" aria-labelledby="settings-title">
    <header className="settings-hero"><button type="button" className="settings-back" onClick={onClose}>← Profile</button><span className="eyebrow">{roleProfileFor(account.role).label} settings</span><h1 id="settings-title">{meta[0]}</h1><p>{meta[1]}</p></header>
    <div className="settings-layout">
      <nav className="settings-sidebar" aria-label="Settings categories">{sections.map(id => <button key={id} type="button" className={section === id ? 'is-active' : ''} onClick={() => { setSection(id); setMessage(''); setError(''); }}><span>{SECTION_META[id][2]}</span><strong>{SECTION_META[id][0]}</strong></button>)}</nav>
      <div className="settings-content">
        {account.forcePasswordChange && <div className="operations-message is-warning" role="alert"><strong>First login security step required.</strong> Change the temporary password before continuing. Confirm your profile, branch, department and notification preferences with your Administrator if anything is incorrect.</div>}
        {section === 'home' && <SettingsHome sections={sections.filter(id => id !== 'home')} onOpen={setSection} />}
        {section === 'app' && <AppSettings value={draft.app} onChange={values => patch('app', values)} showDefaultLandingPage={showsDefaultLandingPageForRole(account.role)} onResetTutorial={isCustomerAccount(account) ? () => onReplayTutorial('reset') : null} />}
        {section === 'sounds' && <SoundSettings value={draft} onPatch={patch} onToggleMap={toggleMap} onTestSound={() => onTestSound(draft)} onTestHaptic={() => onTestHaptic(draft)} />}
        {section === 'notifications' && <NotificationSettings groups={notificationGroups} settings={draft} onSettings={setDraft} value={notificationDraft} onChange={setNotificationDraft} serviceMode={serviceMode} />}
        {section === 'appearance' && <AppearanceSettings value={draft.appearance} onChange={values => patch('appearance', values)} />}
        {section === 'accessibility' && <AccessibilitySettings value={draft} onPatch={patch} />}
        {section === 'security' && <SecuritySettings account={account} actions={credentialActions} serviceMode={serviceMode} onChanged={onCredentialChanged} onSwitchWorkspace={onSwitchWorkspace} onSignOut={onSignOut} />}
        {section === 'tutorials' && <TutorialSettings account={account} serviceMode={serviceMode} onReplay={onReplayTutorial} />}
        {section === 'privacy' && <PrivacySettings serviceMode={serviceMode} />}
        {section === 'about' && <AboutSettings serviceMode={serviceMode} />}
        {section !== 'security' && section !== 'home' && <footer className="settings-save-bar sticky-action-bar"><div>{(message || error) && <p className={error ? 'form-error' : 'settings-success'} role={error ? 'alert' : 'status'}>{error || message}</p>}<small>Changes apply to this account.</small></div><button className="text-button" type="button" disabled={busy} onClick={reset}>Restore defaults</button><button className="primary-button" type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save settings'}</button></footer>}
      </div>
    </div>
  </section>;
}

function SettingsHome({ sections, onOpen }) {
  return <div className="settings-category-grid">{sections.map(id => <button type="button" key={id} onClick={() => onOpen(id)}><span>{SECTION_META[id][2]}</span><div><strong>{SECTION_META[id][0]}</strong><small>{SECTION_META[id][1]}</small></div><i>→</i></button>)}</div>;
}

function SettingToggle({ label, help, checked, disabled = false, onChange }) {
  return <label className="setting-toggle"><span><strong>{label}</strong>{help && <small>{help}</small>}</span><input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={event => onChange(event.target.checked)} /></label>;
}

function AppSettings({ value, onChange, showDefaultLandingPage, onResetTutorial }) {
  return <SettingsPanel title="Application behaviour">{showDefaultLandingPage && <label className="settings-field"><span>Default landing page</span><select value={value.defaultLandingPage} onChange={event => onChange({ defaultLandingPage: event.target.value })}><option value="role_default">Role default</option><option value="notifications">Notifications</option><option value="account">Profile</option></select></label>}<SettingToggle label="Remember last section" checked={value.rememberLastSection} onChange={checked => onChange({ rememberLastSection: checked })} /><SettingToggle label="Confirm important submissions" help="Business validation and authorisation always remain enforced." checked={value.confirmImportantSubmissions} onChange={checked => onChange({ confirmImportantSubmissions: checked })} /><SettingToggle label="Open downloaded documents automatically" checked={value.automaticDocumentOpening} onChange={checked => onChange({ automaticDocumentOpening: checked })} /><label className="settings-field"><span>Language</span><select value={value.language} onChange={event => onChange({ language: event.target.value })}><option value="en-ZA">English (South Africa)</option></select><small>English (South Africa) is currently available.</small></label><div className="settings-inline-actions">{onResetTutorial && <button type="button" className="secondary-button" onClick={onResetTutorial}>Reset tutorial progress</button>}<button type="button" className="secondary-button" disabled>Clear temporary app data</button></div><p className="settings-note">Download locations are controlled by your browser or installed application. Settings cannot bypass workflow rules.</p></SettingsPanel>;
}

function SoundSettings({ value, onPatch, onToggleMap, onTestSound, onTestHaptic }) {
  return <div className="settings-stack"><SettingsPanel title="Master controls"><SettingToggle label="Enable UI Sounds" checked={value.sounds.enabled} onChange={enabled => onPatch('sounds', { enabled })} /><label className="settings-field"><span>UI Sound Volume · {Math.round(value.sounds.volume * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={value.sounds.volume} onChange={event => onPatch('sounds', { volume: Number(event.target.value) })} /></label><SettingToggle label="Enable Haptic Feedback" help="Unsupported browsers fail silently." checked={value.haptics.enabled} onChange={enabled => onPatch('haptics', { enabled })} /><label className="settings-field"><span>Haptic strength</span><select value={value.haptics.strength} onChange={event => onPatch('haptics', { strength: event.target.value })}><option value="light">Light</option><option value="medium">Medium</option></select></label><div className="settings-inline-actions"><button className="secondary-button" type="button" onClick={onTestSound}>Test Sound</button><button className="secondary-button" type="button" onClick={onTestHaptic}>Test Vibration</button></div></SettingsPanel><SettingsPanel title="Sound categories">{SOUND_CATEGORIES.map(key => <SettingToggle key={key} label={categoryLabel(key)} checked={value.sounds.categories[key]} onChange={() => onToggleMap('sounds', 'categories', key)} />)}</SettingsPanel><SettingsPanel title="Haptic categories">{HAPTIC_CATEGORIES.map(key => <SettingToggle key={key} label={categoryLabel(key)} checked={value.haptics.categories[key]} onChange={() => onToggleMap('haptics', 'categories', key)} />)}</SettingsPanel></div>;
}

function NotificationSettings({ groups, settings, onSettings, value, onChange, serviceMode }) {
  const setRolePreference = key => onSettings(current => ({ ...current, roleNotifications: { ...current.roleNotifications, [key]: current.roleNotifications[key] === false } }));
  const channel = (key, enabled) => onChange({ ...value, channels: { ...value.channels, [key]: enabled } });
  return <div className="settings-stack"><SettingsPanel title="Delivery channels"><SettingToggle label="In-App" help="Required for transactional workflow notices." checked disabled onChange={() => {}} /><SettingToggle label="Email" help={serviceMode === 'mock' ? 'Available after production integration · simulated in this demo.' : ''} checked={value.channels.email} onChange={enabled => channel('email', enabled)} /><SettingToggle label="Push" help={serviceMode === 'mock' ? 'Available after production integration · simulated in this demo.' : ''} checked={value.channels.push} onChange={enabled => channel('push', enabled)} /><SettingToggle label="Desktop Notifications" help="Available after production integration." checked={false} disabled onChange={() => {}} /></SettingsPanel>{groups.map(group => <SettingsPanel title={group.label} key={group.id}>{group.items.map(item => { const key = preferenceKey(item); return <SettingToggle key={item} label={item} checked={settings.roleNotifications[key] !== false} disabled={['security_alerts', 'maintenance_notices'].includes(key)} onChange={() => setRolePreference(key)} />; })}</SettingsPanel>)}</div>;
}

function AppearanceSettings({ value, onChange }) {
  return <div className="settings-stack"><SettingsPanel title="Colour mode"><div className="appearance-choice-grid">{APPEARANCE_MODES.map(mode => <button type="button" className={value.mode === mode ? 'is-selected' : ''} key={mode} onClick={() => onChange({ mode })}><span className={`appearance-swatch is-${mode}`} /><strong>{categoryLabel(mode)}</strong></button>)}</div><p className="settings-note">Official Rhomberg Connect colours are protected and cannot be replaced.</p></SettingsPanel><SettingsPanel title="Approved display options"><SettingToggle label="High Contrast" checked={value.highContrast} onChange={highContrast => onChange({ highContrast })} /><SettingToggle label="Increased Text Size" checked={value.increasedText} onChange={increasedText => onChange({ increasedText })} /><SettingToggle label="Reduced Transparency" checked={value.reducedTransparency} onChange={reducedTransparency => onChange({ reducedTransparency })} /></SettingsPanel></div>;
}

function AccessibilitySettings({ value, onPatch }) {
  return <SettingsPanel title="Accessibility preferences"><SettingToggle label="Reduce Motion" help="Replaces movement with simple fades and disables the gauge sweep." checked={value.accessibility.reduceMotion} onChange={reduceMotion => onPatch('accessibility', { reduceMotion })} /><SettingToggle label="Disable Decorative Animations" checked={!value.accessibility.decorativeAnimations} onChange={disabled => onPatch('accessibility', { decorativeAnimations: !disabled })} /><SettingToggle label="Increase Text Size" checked={value.appearance.increasedText} onChange={increasedText => onPatch('appearance', { increasedText })} /><SettingToggle label="High Contrast" checked={value.appearance.highContrast} onChange={highContrast => onPatch('appearance', { highContrast })} /><SettingToggle label="Reduce Transparency" checked={value.appearance.reducedTransparency} onChange={reducedTransparency => onPatch('appearance', { reducedTransparency })} /><SettingToggle label="Disable UI Sounds" checked={!value.sounds.enabled} onChange={disabled => onPatch('sounds', { enabled: !disabled })} /><SettingToggle label="Disable Haptic Feedback" checked={!value.haptics.enabled} onChange={disabled => onPatch('haptics', { enabled: !disabled })} /><SettingToggle label="Screen Reader Optimisation" checked={value.accessibility.screenReaderOptimisation} onChange={screenReaderOptimisation => onPatch('accessibility', { screenReaderOptimisation })} /></SettingsPanel>;
}

function SecuritySettings({ account, actions, serviceMode, onChanged, onSwitchWorkspace, onSignOut }) {
  const roles = account.roles || [account.role];
  return <div className="settings-stack"><SettingsPanel title="Active session"><dl className="settings-session"><div><dt>Signed in as</dt><dd>{account.email || account.signInName}</dd></div><div><dt>Authentication realm</dt><dd>{account.authRealm === 'customer' ? 'Customer' : 'Internal staff'}</dd></div><div><dt>Account status</dt><dd>{humaniseStatus(account.status)}</dd></div><div><dt>First-login onboarding</dt><dd>{account.forcePasswordChange ? 'Password change required' : 'Complete'}</dd></div><div><dt>Multi-factor authentication</dt><dd>Future production integration</dd></div></dl></SettingsPanel>{roles.length > 1 && <SettingsPanel title="Switch Workspace"><p>Use one identity for every role assigned to you.</p><div className="settings-inline-actions">{roles.map(role => <button type="button" className={role === account.role ? 'primary-button' : 'secondary-button'} disabled={role === account.role} key={role} onClick={() => onSwitchWorkspace(role)}>{humaniseStatus(role)}</button>)}</div></SettingsPanel>}{actions && <CredentialChangePanel account={account} actions={actions} serviceMode={serviceMode} onChanged={onChanged} />}<button className="sign-out" type="button" onClick={onSignOut}>Sign out of Rhomberg Connect</button></div>;
}

const humaniseStatus = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());

function TutorialSettings({ account, serviceMode, onReplay }) {
  const customer = isCustomerAccount(account);
  return <div className="settings-stack"><SettingsPanel title="Guided tutorials">{customer ? <div className="tutorial-launch-grid">{TUTORIALS.map(item => <button type="button" className="secondary-button" key={item.id} onClick={() => onReplay(item.id)}>{item.label}</button>)}</div> : <p className="settings-note">Role-specific guidance is available from workspace help. The customer RFQ tutorial is shown only to customer accounts.</p>}</SettingsPanel><SettingsPanel title="More help"><div className="settings-link-list"><button type="button">Frequently Asked Questions <small>Help articles</small></button>{customer && <button type="button">Contact Assigned Representative <small>Use your authorised account contact</small></button>}<button type="button">Report a Problem <small>Contact support</small></button><button type="button">View App Version <small>Rhomberg Connect 5.2.0</small></button>{__PUBLIC_PREVIEW__ && <button type="button">Demonstration limits <small>{serviceMode === 'mock' ? 'Fabricated data · same-device storage · demo delivery' : 'Not applicable'}</small></button>}</div></SettingsPanel></div>;
}

function PrivacySettings({ serviceMode }) { return <SettingsPanel title="Privacy and data"><p>Customer and internal identities remain in separate authentication realms. Company-isolation and role permissions are enforced by the service boundary.</p><p>{__PUBLIC_PREVIEW__ && serviceMode === 'mock' ? 'This demonstration stores fabricated data on this device. Do not enter real customer, pricing, credential or infrastructure information.' : 'Production data rights, retention and access requests must use the approved backend process.'}</p><p>Operational records, audit history and signed documents cannot be erased from this settings page.</p></SettingsPanel>; }
function AboutSettings({ serviceMode }) { const environment = __PUBLIC_PREVIEW__ && serviceMode === 'mock' ? 'Fabricated demonstration' : runtimeConfig.environmentName === 'internal-staging' ? 'Internal Staging' : 'Private company service'; return <SettingsPanel title="Rhomberg Connect"><img className="settings-about-logo" src="assets/images/rhomberg-connect-logo-full-dark.png" alt="Rhomberg Connect" /><dl className="settings-session"><div><dt>Version</dt><dd>{runtimeConfig.applicationVersion}</dd></div><div><dt>Environment</dt><dd>{environment}</dd></div><div><dt>Shared platform</dt><dd>Customer, Sales, Technical and Operations</dd></div></dl></SettingsPanel>; }
function SettingsPanel({ title, children }) { return <section className="settings-panel"><h2>{title}</h2>{children}</section>; }
