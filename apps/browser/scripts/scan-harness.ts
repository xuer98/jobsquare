/**
 * Field-identification harness: runs the extension's REAL collection + matching
 * pipeline (collectFields copy from content.ts + contextFor + matchContext)
 * against the live page and reports what each control resolved to.
 * Injected via the browser pane; results via window.__gzScan().
 */
import {
  controlVisible,
  controlVisibleStrict,
  deepQueryAll,
  isElementVisible,
  shadowContains,
  shadowParent,
} from '../src/lib/dom'
import {
  createEntryIndexer,
  matchContext,
  matchFileContext,
} from '../src/lib/fieldMatcher'
import { contextFor, type Fillable } from '../src/lib/filler'
import { WIDGET_CONTROL_SELECTOR } from '../src/lib/widgetFiller'
import { emptyProfile, type Profile } from '../src/lib/profile'

const FILLABLE_INPUT_TYPES = new Set(['text', 'email', 'tel', 'url', 'number', 'search', 'date', 'month', ''])

function isEditableControl(el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): boolean {
  return !el.disabled && !(el as HTMLInputElement).readOnly
}

function isSearchControl(el: HTMLElement): boolean {
  if (el.closest('[role="search"]')) return true
  if (el.getAttribute('role') === 'searchbox') return true
  return el.localName === 'input' && (el as HTMLInputElement).type === 'search'
}

// Verbatim copy of content.ts collectFields (content.ts can't be imported — it
// touches chrome.* at module scope).
function collectFields(root: ParentNode): Fillable[] {
  const fields: Fillable[] = []
  const radioGroups = new Map<string, HTMLInputElement[]>()
  const checkboxGroups = new Map<string, HTMLInputElement[]>()
  const unnamedRadioContainers = new Map<Element, number>()

  const widgets = deepQueryAll<HTMLElement>(root, WIDGET_CONTROL_SELECTOR).filter(
    (el) =>
      el.localName !== 'select' &&
      isElementVisible(el) &&
      !isSearchControl(el) &&
      !el.closest('[data-browser-overlay]'),
  )
  const widgetSet = new Set(widgets)
  const topWidgets = widgets.filter((w) => {
    let p = shadowParent(w)
    while (p) {
      if (widgetSet.has(p as HTMLElement)) return false
      p = shadowParent(p)
    }
    return true
  })
  const insideWidget = (el: HTMLElement) => topWidgets.some((w) => shadowContains(w, el))

  const controls = deepQueryAll<HTMLElement>(
    root,
    'input, textarea, select, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
  )

  for (const control of controls) {
    if (control.closest('[data-browser-overlay]')) continue
    const tag = control.localName

    if (tag === 'textarea') {
      const el = control as HTMLTextAreaElement
      if (!isEditableControl(el) || !controlVisibleStrict(el)) continue
      fields.push({ type: 'value', el })
      continue
    }

    if (tag === 'select') {
      const el = control as HTMLSelectElement
      if (!isEditableControl(el) || !controlVisible(el)) continue
      fields.push({ type: 'select', el })
      continue
    }

    if (tag === 'input') {
      const el = control as HTMLInputElement
      const type = (el.type || 'text').toLowerCase()
      if (!isEditableControl(el)) continue

      if (type === 'file') {
        fields.push({ type: 'file', el })
        continue
      }

      if (insideWidget(el)) continue

      if (type === 'radio') {
        if (!controlVisible(el)) continue
        const formId = el.form?.getAttribute('name') ?? el.form?.getAttribute('id') ?? 'noform'
        let groupId = el.name
        if (!groupId) {
          const container = el.closest('fieldset, [role="radiogroup"]') ?? el.parentElement ?? el
          let n = unnamedRadioContainers.get(container)
          if (n === undefined) {
            n = unnamedRadioContainers.size
            unnamedRadioContainers.set(container, n)
          }
          groupId = `unnamed#${n}`
        }
        const key = `${formId}::${groupId}`
        const group = radioGroups.get(key)
        if (group) group.push(el)
        else radioGroups.set(key, [el])
        continue
      }

      if (type === 'checkbox') {
        if (!controlVisible(el)) continue
        if (el.name) {
          const formId = el.form?.getAttribute('name') ?? el.form?.getAttribute('id') ?? 'noform'
          const key = `${formId}::${el.name}`
          const group = checkboxGroups.get(key)
          if (group) group.push(el)
          else checkboxGroups.set(key, [el])
        } else {
          fields.push({ type: 'checkbox', el })
        }
        continue
      }

      if (FILLABLE_INPUT_TYPES.has(type)) {
        if (!controlVisibleStrict(el) || isSearchControl(el)) continue
        fields.push({ type: 'value', el })
      }
      continue
    }

    if (control.isContentEditable && isElementVisible(control) && !insideWidget(control)) {
      fields.push({ type: 'contenteditable', el: control })
    }
  }

  for (const w of topWidgets) {
    fields.push({ type: 'widget', el: w })
  }

  for (const els of radioGroups.values()) {
    if (els.length) fields.push({ type: 'radio', els })
  }

  for (const els of checkboxGroups.values()) {
    if (els.length >= 2) fields.push({ type: 'radio', els })
    else fields.push({ type: 'checkbox', el: els[0] })
  }

  return fields
}

/** Every profile value populated so no spec is skipped for lack of data. */
function fullProfile(): Profile {
  return {
    ...emptyProfile(),
    firstName: 'Alex',
    middleName: 'J',
    lastName: 'Rivera',
    preferredName: 'Al',
    email: 'alex@example.com',
    phone: '+1 415 555 0199',
    addressLine1: '500 Terry Francois Blvd',
    addressLine2: 'Suite 7',
    city: 'San Francisco',
    state: 'California',
    zip: '94158',
    country: 'United States',
    linkedin: 'https://linkedin.com/in/alex',
    github: 'https://github.com/alex',
    website: 'https://alex.dev',
    twitter: '@alex',
    currentCompany: 'Acme Corp',
    currentTitle: 'Senior Engineer',
    yearsExperience: '7',
    desiredSalary: '$180,000',
    noticePeriod: '2 weeks',
    earliestStartDate: '2026-08',
    workAuthorized: 'yes',
    requireSponsorship: 'no',
    willingToRelocate: 'yes',
    remotePreference: 'Remote',
    gender: 'Male',
    pronouns: 'He/Him',
    raceEthnicity: 'Asian',
    veteranStatus: 'I am not a veteran',
    disabilityStatus: 'No',
    hispanicLatino: 'no',
    coverLetter: 'I am excited about this role.',
    summary: 'Seasoned engineer.',
    howHeard: 'LinkedIn',
    experience: [
      { id: 'e1', company: 'Acme Corp', title: 'Senior Engineer', location: 'SF', startDate: 'Mar 2021', endDate: 'Present', description: 'Led the platform team.' },
      { id: 'e2', company: 'Globex', title: 'Engineer', location: 'Seattle', startDate: '2018', endDate: '2021', description: 'Built billing.' },
    ],
    education: [
      { id: 'ed1', school: 'UC Berkeley', degree: 'BSc', field: 'Computer Science', startDate: '2013', endDate: '2017', gpa: '3.8' },
    ],
  }
}

interface ScanRow {
  control: string
  label: string
  key: string
  value: string
  signal: string
}

function scan(): { url: string; total: number; matched: number; rows: ScanRow[] } {
  const profile = fullProfile()
  const indexer = createEntryIndexer()
  const fields = collectFields(document)
  const rows: ScanRow[] = []

  for (const field of fields) {
    const ctx = contextFor(field)
    const control =
      field.type === 'value'
        ? (field.el as HTMLInputElement).type || field.el.localName
        : field.type
    if (field.type === 'file') {
      const slot = matchFileContext(ctx)
      rows.push({
        control: 'file',
        label: ctx.displayLabel,
        key: slot ?? 'UNMATCHED',
        value: '',
        signal: ctx.signal.slice(0, 90),
      })
      continue
    }
    const match = matchContext(ctx, profile, [], { entryIndex: indexer.next })
    rows.push({
      control,
      label: ctx.displayLabel,
      key: match?.key ?? 'UNMATCHED',
      value: match?.value?.slice(0, 30) ?? '',
      signal: ctx.signal.slice(0, 90),
    })
  }

  return {
    url: location.href,
    total: rows.length,
    matched: rows.filter((r) => r.key !== 'UNMATCHED').length,
    rows,
  }
}

;(window as unknown as { __gzScan?: typeof scan }).__gzScan = scan
