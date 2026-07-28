import { useMemo, useState } from 'react';
import {
  APPEARANCE_MODES,
  createDefaultCustomerPersonalisation,
  CUSTOMER_DENSITIES,
  CUSTOMER_FONT_SIZES,
  CUSTOMER_THEME_PRESETS,
  customerPersonalisationCss,
  DEFAULT_CUSTOM_COLOURS,
  foregroundForColour,
  normaliseCustomerPersonalisation,
  NOTIFICATION_PREFERENCE_CATEGORIES,
  validateCustomerPersonalisation,
} from '../../shared/personalisation/personalisation.js';

const STEPS = Object.freeze([
  ['Welcome', 'Personalise Rhomberg Connect'],
  ['Theme', 'Choose your starting style'],
  ['Colours', 'Fine-tune a custom theme'],
  ['Images', 'Add your identity'],
  ['Text', 'Choose a comfortable font size'],
  ['Density', 'Control screen spacing'],
  ['Appearance', 'Light, dark or system'],
  ['Alerts', 'Choose optional updates'],
  ['Preview', 'Review the complete experience'],
  ['Complete', 'Save your Rhomberg Connect setup'],
]);

const firstError = errors => Object.values(errors)[0] || '';

export function CustomerPersonalisation({
  account,
  initialValue,
  mode = 'wizard',
  onSave,
  onCancel,
  onDefer,
  onUploadImage,
  onRemoveImage,
}) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => normaliseCustomerPersonalisation(initialValue));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState('');
  const [uploadedImageIds, setUploadedImageIds] = useState([]);
  const [previewAppearance, setPreviewAppearance] = useState('light');
  const isSettings = mode === 'settings';
  const css = useMemo(() => customerPersonalisationCss(draft), [draft]);

  const update = patch => {
    setDraft(current => normaliseCustomerPersonalisation({ ...current, ...patch }));
    setError('');
  };

  const updateColours = (name, value) => update({ customColours: { ...draft.customColours, [name]: value } });
  const updateNotification = (name, value) => update({ notificationPreferences: { ...draft.notificationPreferences, [name]: value } });

  const validateBeforeSave = () => {
    const errors = validateCustomerPersonalisation(draft);
    if (!Object.keys(errors).length) return true;
    setError(firstError(errors));
    const key = Object.keys(errors)[0];
    if (key.startsWith('customColours')) setStep(2);
    else if (key.startsWith('notificationPreferences')) setStep(7);
    return false;
  };

  const save = async ({ defaults = false } = {}) => {
    const candidate = defaults
      ? { ...createDefaultCustomerPersonalisation(), setupCompleted: true }
      : { ...draft, setupCompleted: true };
    if (!defaults && !validateBeforeSave()) return;
    setSaving(true);
    setError('');
    try {
      const retainedImageIds = new Set([candidate.profileImage?.id, candidate.companyLogo?.id].filter(Boolean));
      await Promise.all(uploadedImageIds.filter(id => !retainedImageIds.has(id)).map(id => onRemoveImage(id)));
      await onSave(candidate);
    } catch (saveError) {
      setError(saveError?.message || 'Your settings could not be saved. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const upload = async (event, kind) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(kind);
    setError('');
    try {
      const image = await onUploadImage(file, kind, draft[kind]?.position || { x: 50, y: 50 });
      setUploadedImageIds(current => [...new Set([...current, image.id])]);
      update({ [kind]: image });
    } catch (uploadError) {
      setError(uploadError?.message || 'The image could not be added.');
    } finally {
      setUploading('');
      event.target.value = '';
    }
  };

  const removeImage = kind => {
    const image = draft[kind];
    if (!image) return;
    update({ [kind]: null });
  };

  const cancel = async () => {
    setSaving(true);
    await Promise.allSettled(uploadedImageIds.map(id => onRemoveImage(id)));
    onCancel?.();
  };

  const defer = async () => {
    setSaving(true);
    await Promise.allSettled(uploadedImageIds.map(id => onRemoveImage(id)));
    onDefer?.();
  };

  const resetStep = () => {
    const defaults = createDefaultCustomerPersonalisation();
    const patches = [
      {},
      { themePreset: defaults.themePreset },
      { customColours: defaults.customColours },
      { profileImage: null, companyLogo: null },
      { fontSize: defaults.fontSize },
      { density: defaults.density },
      { appearanceMode: defaults.appearanceMode },
      { notificationPreferences: defaults.notificationPreferences },
      {},
      {},
    ];
    update(patches[step]);
  };

  return (
    <main
      className={`personalisation-view ${isSettings ? 'is-settings' : 'is-wizard'} preview-${previewAppearance}`}
      style={css}
      aria-labelledby="personalisation-title"
    >
      <header className="personalisation-header">
        <div><span className="eyebrow">{isSettings ? 'Rhomberg Connect settings' : `Welcome, ${account.contact.split(/\s+/)[0]}`}</span><h1 id="personalisation-title">{STEPS[step][1]}</h1><p>{isSettings ? 'Preview and save a complete valid set of customer preferences.' : 'A one-time setup keeps your customer experience clear, comfortable and recognisably yours.'}</p></div>
        <span className="personalisation-progress"><strong>{step + 1}</strong><small>of {STEPS.length}</small></span>
      </header>

      <nav className="personalisation-steps" aria-label="Personalisation steps">
        {STEPS.map(([label], index) => <button type="button" key={label} className={index === step ? 'is-active' : index < step ? 'is-complete' : ''} onClick={() => setStep(index)} aria-label={`Step ${index + 1}: ${label}`}><i>{index < step ? '✓' : index + 1}</i><span>{label}</span></button>)}
      </nav>

      <section className="personalisation-card">
        {step === 0 && <WelcomeStep account={account} />}
        {step === 1 && <ThemeStep draft={draft} update={update} />}
        {step === 2 && <ColourStep draft={draft} updateColours={updateColours} update={update} />}
        {step === 3 && <ImageStep draft={draft} upload={upload} removeImage={removeImage} update={update} uploading={uploading} />}
        {step === 4 && <ChoiceStep title="Font size" help="This scale applies across customer mobile and desktop views." options={CUSTOMER_FONT_SIZES} selected={draft.fontSize} onSelect={fontSize => update({ fontSize })}><TypePreview /></ChoiceStep>}
        {step === 5 && <ChoiceStep title="Display density" help="Compact mode retains safe mobile touch targets." options={CUSTOMER_DENSITIES} selected={draft.density} onSelect={density => update({ density })}><DensityPreview density={draft.density} /></ChoiceStep>}
        {step === 6 && <ChoiceStep title="Appearance mode" help="System Default follows this device while retaining your selected colours." options={APPEARANCE_MODES} selected={draft.appearanceMode} onSelect={appearanceMode => update({ appearanceMode })}><div className="appearance-preview-toggle"><button type="button" className={previewAppearance === 'light' ? 'is-active' : ''} onClick={() => setPreviewAppearance('light')}>Preview light</button><button type="button" className={previewAppearance === 'dark' ? 'is-active' : ''} onClick={() => setPreviewAppearance('dark')}>Preview dark</button></div></ChoiceStep>}
        {step === 7 && <NotificationStep draft={draft} updateNotification={updateNotification} />}
        {step === 8 && <LivePreview account={account} draft={draft} />}
        {step === 9 && <CompleteStep draft={draft} />}

        {error && <p className="personalisation-error" role="alert">{error}</p>}

        <footer className="personalisation-actions">
          <div>
            {step > 0 && <button className="secondary-button" type="button" onClick={() => setStep(value => value - 1)}>Back</button>}
            {isSettings && <button className="text-button" type="button" onClick={resetStep}>Reset this section</button>}
            {isSettings && <button className="text-button" type="button" onClick={() => update({ ...createDefaultCustomerPersonalisation(), setupCompleted: true })}>Restore all defaults</button>}
          </div>
          <div>
            {isSettings && onCancel && <button className="text-button" type="button" disabled={saving} onClick={cancel}>Cancel changes</button>}
            {isSettings && step !== 8 && <button className="secondary-button" type="button" onClick={() => setStep(8)}>Preview changes</button>}
            {!isSettings && step === 0 && onDefer && <button className="secondary-button" type="button" disabled={saving} onClick={defer}>Complete later</button>}
            {step === 0 && !isSettings && <button className="text-button" type="button" disabled={saving} onClick={() => save({ defaults: true })}>Use Rhomberg defaults</button>}
            {step < STEPS.length - 1
              ? <button className="primary-button" type="button" onClick={() => setStep(value => value + 1)}>Continue <span>→</span></button>
              : <button className="primary-button" type="button" disabled={saving} onClick={() => save()}>{saving ? 'Saving…' : isSettings ? 'Save changes' : 'Complete setup'} <span>{saving ? '•••' : '→'}</span></button>}
          </div>
        </footer>
      </section>
    </main>
  );
}

function WelcomeStep({ account }) {
  return <div className="personalisation-welcome"><span className="personalisation-gauge">R</span><div><small>Rhomberg Connect</small><h2>Made clearer for you and {account.company}.</h2><p>Choose a theme, text size, spacing and the updates you want to see. Every setting can be changed later from your profile.</p></div></div>;
}

function ThemeStep({ draft, update }) {
  return <div><SectionIntro title="Professionally balanced presets" help="Rhomberg Default is always available as the safe starting point." /><div className="theme-preset-grid">{CUSTOMER_THEME_PRESETS.map(preset => <button type="button" key={preset.id} className={draft.themePreset === preset.id ? 'is-selected' : ''} onClick={() => update({ themePreset: preset.id })}><span>{preset.colours ? Object.values(preset.colours).slice(0, 3).map(colour => <i key={colour} style={{ background: colour }} />) : <i className="custom-swatch">+</i>}</span><strong>{preset.label}</strong><small>{preset.description}</small></button>)}</div></div>;
}

function ColourStep({ draft, updateColours, update }) {
  if (draft.themePreset !== 'custom') return <div className="custom-colour-inactive"><span>✓</span><h2>{CUSTOMER_THEME_PRESETS.find(item => item.id === draft.themePreset)?.label} is protected.</h2><p>Its colours have already been checked for readable light and dark appearances.</p><button className="secondary-button" type="button" onClick={() => update({ themePreset: 'custom' })}>Create a custom theme</button></div>;
  return <div><SectionIntro title="Your five-colour system" help="Text colour is calculated automatically. Error styling remains protected." /><div className="custom-colour-grid">{Object.entries(draft.customColours).map(([name, colour]) => { const foreground = foregroundForColour(colour); return <label key={name}><span><strong>{name}</strong><small style={{ background: colour, color: foreground }}>Aa</small></span><input type="color" value={colour} onChange={event => updateColours(name, event.target.value)} /><input value={colour} onChange={event => updateColours(name, event.target.value)} aria-label={`${name} hexadecimal colour`} /><button type="button" onClick={() => updateColours(name, DEFAULT_CUSTOM_COLOURS[name])}>Reset</button></label>; })}</div><button className="text-button" type="button" onClick={() => update({ customColours: { ...DEFAULT_CUSTOM_COLOURS } })}>Reset entire custom theme</button></div>;
}

function ImageStep({ draft, upload, removeImage, update, uploading }) {
  return <div><SectionIntro title="Profile picture and company logo" help="JPG, PNG or WebP · maximum 1 MB each · stored only in this browser during testing." /><div className="image-upload-grid">{[['profileImage', 'Profile picture'], ['companyLogo', 'Company logo']].map(([kind, label]) => { const image = draft[kind]; return <article key={kind}><div className="image-crop-preview">{image?.previewUrl ? <img src={image.previewUrl} alt={`${label} preview`} style={{ objectPosition: `${image.position?.x || 50}% ${image.position?.y || 50}%` }} /> : <span>{kind === 'profileImage' ? 'YOU' : 'LOGO'}</span>}</div><h3>{label}</h3>{image ? <><label className="position-control">Horizontal position<input type="range" min="0" max="100" value={image.position?.x || 50} onChange={event => update({ [kind]: { ...image, position: { ...image.position, x: Number(event.target.value) } } })} /></label><label className="position-control">Vertical position<input type="range" min="0" max="100" value={image.position?.y || 50} onChange={event => update({ [kind]: { ...image, position: { ...image.position, y: Number(event.target.value) } } })} /></label><button className="text-button danger-text" type="button" disabled={uploading === kind} onClick={() => removeImage(kind)}>Remove image</button></> : <label className="image-file-button">{uploading === kind ? 'Reading image…' : `Choose ${label.toLowerCase()}`}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => upload(event, kind)} /></label>}</article>; })}</div></div>;
}

function ChoiceStep({ title, help, options, selected, onSelect, children }) {
  return <div><SectionIntro title={title} help={help} /><div className="personalisation-choice-grid">{options.map(option => <button type="button" key={option.id} className={selected === option.id ? 'is-selected' : ''} onClick={() => onSelect(option.id)}><strong>{option.label}</strong>{option.description && <small>{option.description}</small>}</button>)}</div><div className="personalisation-inline-preview">{children}</div></div>;
}

function NotificationStep({ draft, updateNotification }) {
  return <div><SectionIntro title="Notification preferences" help="These controls affect in-app mock notifications. Email, mobile push and desktop notifications require the future secure backend." /><div className="notification-preference-list">{NOTIFICATION_PREFERENCE_CATEGORIES.map(category => <label key={category.id}><span><strong>{category.label}</strong><small>{category.critical ? 'Required transactional or security update' : 'Optional customer update'}</small></span><input type="checkbox" checked={Boolean(draft.notificationPreferences[category.id])} disabled={category.critical} onChange={event => updateNotification(category.id, event.target.checked)} /></label>)}</div></div>;
}

function LivePreview({ account, draft }) {
  return <div><SectionIntro title="Live Rhomberg Connect sample" help="Review cards, controls, forms, tracking and notifications before saving." /><div className="customer-live-preview" style={customerPersonalisationCss(draft)}><header><span className="preview-avatar">{draft.profileImage?.previewUrl ? <img src={draft.profileImage.previewUrl} alt="" /> : account.contact[0]}</span><span><small>Good day</small><strong>{account.contact}</strong></span><i>Live sample</i></header><section><h2>Customer dashboard</h2><p>Your configured instruments and order updates stay clear at every selected text size.</p><button>Request a quotation</button></section><div className="sample-card-grid"><article><small>PRODUCT</small><strong>PBG Pressure Gauge</strong><p>Configured product card with safe wrapping.</p></article><article><small>RFQ</small><strong>RQ-PREVIEW-0042</strong><p>Quotation review required.</p></article><article><small>ORDER UPDATE</small><strong>Quality check complete</strong><p>Your instruments are moving to paperwork preparation.</p></article><article><small>NOTIFICATION</small><strong>Order progress updated</strong><p>Open the order to view its customer-safe timeline.</p></article></div><label>Application<input value="Water pressure monitoring" readOnly /></label></div></div>;
}

function CompleteStep({ draft }) {
  const theme = CUSTOMER_THEME_PRESETS.find(item => item.id === draft.themePreset)?.label;
  const font = CUSTOMER_FONT_SIZES.find(item => item.id === draft.fontSize)?.label;
  const density = CUSTOMER_DENSITIES.find(item => item.id === draft.density)?.label;
  const appearance = APPEARANCE_MODES.find(item => item.id === draft.appearanceMode)?.label;
  return <div className="personalisation-complete"><span>✓</span><h2>Your setup is ready.</h2><p>Saving applies one complete, validated preference set to Rhomberg Connect.</p><dl><div><dt>Theme</dt><dd>{theme}</dd></div><div><dt>Font</dt><dd>{font}</dd></div><div><dt>Density</dt><dd>{density}</dd></div><div><dt>Appearance</dt><dd>{appearance}</dd></div></dl></div>;
}

function SectionIntro({ title, help }) {
  return <div className="personalisation-section-intro"><span className="eyebrow">Customer appearance</span><h2>{title}</h2><p>{help}</p></div>;
}

function TypePreview() {
  return <div className="type-preview"><h3>Heading example</h3><p>A readable paragraph scales across every customer screen.</p><button>Button label</button><label>Form field<input value="Configured instrument" readOnly /></label><nav>Home · Catalogue · Orders</nav><article><strong>Order status</strong><small>Expediting in progress</small></article></div>;
}

function DensityPreview({ density }) {
  return <div className={`density-preview density-${density}`}><span>Product catalogue card</span><span>RFQ status card</span><span>Order tracking card</span></div>;
}
