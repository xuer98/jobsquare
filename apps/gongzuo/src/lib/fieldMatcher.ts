import { fullName, type CustomAnswer, type Profile } from './profile'

export type FieldKind = 'text' | 'longtext' | 'yesno'

/** Sensitive-data category a spec belongs to; user can disable per category. */
export type SpecCategory = 'eeo' | 'disability' | 'salary'

export interface MatchedField {
  /** Profile key or custom id, for debugging. */
  key: string
  /** Human-readable label, e.g. "Email". */
  label: string
  /** The raw stored value (may contain "a | b" alternatives). */
  value: string
  /** Values to try, in order: dropdowns/radios try each until one matches an
   * option; text inputs use the first. */
  candidates: string[]
  kind: FieldKind
}

const MAX_CANDIDATE_LEN = 60

/**
 * Split "BSc | Bachelor of Science" into ordered alternatives. Only short
 * segments are treated as an alternatives list — prose that merely contains a
 * "|" (a cover letter, a long answer) stays intact.
 */
export function parseCandidates(raw: string): string[] {
  const trimmed = raw.trim()
  if (!trimmed.includes('|')) return [trimmed]
  const parts = trimmed
    .split('|')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length >= 2 && parts.every((p) => p.length <= MAX_CANDIDATE_LEN)) return parts
  return [trimmed]
}

/** All the textual signals we can read off a form field. */
export interface FieldContext {
  /** Normalized, lowercased, separator-collapsed blob of every signal. */
  signal: string
  /** Raw autocomplete token, e.g. "given-name". */
  autocomplete: string
  /** A short label suitable for display in the popup. */
  displayLabel: string
  /** Normalized text of surrounding section headings/legends/automation ids. */
  sectionSignal: string
}

/** camelCase / snake_case / kebab / letter-digit → space-separated lowercase. */
export function normalize(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])([0-9])/g, '$1 $2')
    .replace(/([0-9])([a-zA-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Whole-word / contiguous-phrase match. Tokens in a normalized signal are
 * single-space separated, so padding both sides lets us match on word
 * boundaries — "unit" no longer matches "united", "city" not "ethnicity".
 */
function hasPhrase(signal: string, phrase: string): boolean {
  return (' ' + signal + ' ').includes(' ' + phrase + ' ')
}

function text(el: Element | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * Find the text of headings that precede/contain this element — fieldset
 * legends, nearby h1–h6, ARIA group labels, and Workday-style
 * data-automation-id tokens on ancestors. Lets specs distinguish a
 * "Start date" inside an Education section from one under "When can you start?".
 */
function sectionText(el: HTMLElement): string {
  const parts: string[] = []
  let node: HTMLElement | null = el
  let depth = 0
  while (node && depth < 8) {
    const automation = node.getAttribute('data-automation-id')
    if (automation) parts.push(automation)
    if (node.matches('fieldset,section,[role="group"],[role="region"]')) {
      const aria = node.getAttribute('aria-label')
      if (aria) parts.push(aria)
    }
    // Nearest preceding sibling heading at this level.
    let sib = node.previousElementSibling
    let steps = 0
    while (sib && steps < 6) {
      if (/^H[1-6]$/.test(sib.tagName) || sib.matches('legend,[role="heading"]')) {
        parts.push(text(sib))
        break
      }
      steps++
      sib = sib.previousElementSibling
    }
    node = node.parentElement
    depth++
  }
  return normalize(parts.join(' '))
}

const CONTROL_ISH = 'input, textarea, select, button, [role="combobox"], [contenteditable]'

/** Nearest short preceding-sibling text of the control or its wrappers. */
function precedingSiblingText(el: HTMLElement): string {
  let node: HTMLElement | null = el
  for (let depth = 0; depth < 3 && node; depth++) {
    let sib = node.previousElementSibling
    let steps = 0
    while (sib && steps < 3) {
      // Stop at anything holding another control — its text isn't our label.
      if (sib.matches(CONTROL_ISH) || sib.querySelector(CONTROL_ISH)) break
      const t = text(sib)
      if (t && t.length >= 2 && t.length <= 140) return t
      sib = sib.previousElementSibling
      steps++
    }
    node = node.parentElement
  }
  return ''
}

/** Gather every readable label/attribute signal for an element. */
export function getContext(el: HTMLElement, groupQuestion?: string): FieldContext {
  const parts: string[] = []
  const display: string[] = []

  const input = el as HTMLInputElement
  const labels = input.labels ? Array.from(input.labels) : []
  for (const l of labels) {
    const t = text(l)
    if (t) {
      parts.push(t)
      display.push(t)
    }
  }

  const ariaLabel = el.getAttribute('aria-label')
  if (ariaLabel) {
    parts.push(ariaLabel)
    display.push(ariaLabel)
  }

  const labelledBy = el.getAttribute('aria-labelledby')
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      const t = text((el.getRootNode() as ParentNode as Document).getElementById?.(id) ?? document.getElementById(id))
      if (t) {
        parts.push(t)
        display.push(t)
      }
    }
  }

  const describedBy = el.getAttribute('aria-describedby')
  if (describedBy) {
    for (const id of describedBy.split(/\s+/)) {
      const t = text(document.getElementById(id))
      if (t) parts.push(t)
    }
  }

  for (const attr of ['placeholder', 'title']) {
    const v = el.getAttribute(attr)
    if (v) {
      parts.push(v)
      display.push(v)
    }
  }

  for (const attr of ['name', 'id', 'data-automation-id', 'data-qa', 'data-testid', 'data-field']) {
    const v = el.getAttribute(attr)
    if (v) parts.push(v)
  }

  const wrappingLabel = el.closest('label')
  if (wrappingLabel && !labels.includes(wrappingLabel as HTMLLabelElement)) {
    const t = text(wrappingLabel)
    if (t) {
      parts.push(t)
      display.push(t)
    }
  }

  // Custom widgets (button/div dropdowns) are often labeled only by their own
  // face text ("Country ▼"). Native controls are skipped — their text content
  // is their options, not a label.
  if (!/^(input|textarea|select)$/.test(el.localName)) {
    const own = text(el)
    if (own && own.length <= 60) {
      parts.push(own)
      display.push(own)
    }
  }

  // Many forms label fields with a plain <div>/<p> right before the control
  // instead of a <label>. Take the nearest short preceding-sibling text that
  // doesn't itself contain a form control (that text belongs to the previous
  // field).
  if (labels.length === 0 && !ariaLabel && !labelledBy) {
    const preceding = precedingSiblingText(el)
    if (preceding) {
      parts.push(preceding)
      display.push(preceding)
    }
  }

  const legend = el.closest('fieldset')?.querySelector('legend')
  if (legend) {
    const t = text(legend)
    if (t) {
      parts.push(t)
      display.push(t)
    }
  }

  if (groupQuestion) {
    parts.push(groupQuestion)
    display.unshift(groupQuestion)
  }

  const autocomplete = (el.getAttribute('autocomplete') ?? '').toLowerCase().trim()
  if (autocomplete && autocomplete !== 'off' && autocomplete !== 'on') {
    parts.push(autocomplete)
  }

  const displayLabel =
    display.find((d) => d.length > 1) ??
    el.getAttribute('name') ??
    el.getAttribute('id') ??
    'field'

  return {
    signal: normalize(parts.join(' · ')),
    autocomplete,
    displayLabel: displayLabel.replace(/\s+/g, ' ').trim().slice(0, 80),
    sectionSignal: sectionText(el),
  }
}

/** Repeating-entry sections: the Nth matching form row reads profile entry N. */
export type IndexedSection = 'education' | 'experience'

interface FieldSpec {
  key: string
  label: string
  kind: FieldKind
  keywords: string[]
  /** Match only when the ENTIRE signal equals this token — for words too
   * generic to phrase-match ("first", "last"). */
  exactKeywords?: string[]
  autocomplete?: string[]
  exclude?: string[]
  /** Only match when one of these phrases appears in the section/field signal. */
  requireSection?: string[]
  /** Never match when one of these phrases appears in the section signal. */
  excludeSection?: string[]
  category?: SpecCategory
  /** Belongs to a repeating section; value() receives the entry ordinal. */
  indexed?: IndexedSection
  value: (p: Profile, index: number) => string | undefined
}

const clean = (v: string | undefined) => {
  const t = (v ?? '').trim()
  return t.length ? t : undefined
}

const EDU_SECTIONS = ['education', 'school', 'academic', 'university', 'degree']
const EXP_SECTIONS = [
  'experience',
  'employment',
  'work history',
  'job history',
  'career history',
  'previous employer',
]

/**
 * Ordered most-specific → most-generic. The first spec that (a) has a value and
 * (b) matches by autocomplete or keyword without hitting an exclude term wins.
 */
const SPECS: FieldSpec[] = [
  {
    key: 'email',
    label: 'Email',
    kind: 'text',
    keywords: ['email', 'e mail', 'email address'],
    autocomplete: ['email'],
    value: (p) => clean(p.email),
  },
  {
    key: 'phone',
    label: 'Phone',
    kind: 'text',
    keywords: ['phone', 'mobile', 'telephone', 'cell number', 'cellphone', 'contact number', 'phone number'],
    autocomplete: ['tel', 'tel-national'],
    value: (p) => clean(p.phone),
  },
  {
    key: 'firstName',
    label: 'First name',
    kind: 'text',
    // bare "first" is exact-only: "First choice of location" must not match
    keywords: ['first name', 'given name', 'forename', 'fname'],
    exactKeywords: ['first'],
    autocomplete: ['given-name'],
    exclude: ['last', 'family', 'company', 'school'],
    value: (p) => clean(p.firstName),
  },
  {
    key: 'lastName',
    label: 'Last name',
    kind: 'text',
    // bare "last" is exact-only: "Last employer" must not match
    keywords: ['last name', 'family name', 'surname', 'lname'],
    exactKeywords: ['last'],
    autocomplete: ['family-name'],
    exclude: ['first', 'given'],
    value: (p) => clean(p.lastName),
  },
  {
    key: 'middleName',
    label: 'Middle name',
    kind: 'text',
    keywords: ['middle name', 'middle initial'],
    autocomplete: ['additional-name'],
    value: (p) => clean(p.middleName),
  },
  {
    key: 'preferredName',
    label: 'Preferred name',
    kind: 'text',
    keywords: ['preferred name', 'nickname', 'goes by', 'preferred first'],
    value: (p) => clean(p.preferredName),
  },
  {
    key: 'fullName',
    label: 'Full name',
    kind: 'text',
    keywords: ['full name', 'your name', 'legal name', 'candidate name', 'name'],
    autocomplete: ['name'],
    exclude: [
      'first',
      'last',
      'middle',
      'user',
      'company',
      'employer',
      'school',
      'file',
      'nick',
      'screen',
      'event',
      'reference',
      'emergency',
      'contact name',
      'pet',
      'child',
    ],
    value: (p) => clean(fullName(p)),
  },

  // --- Work experience (indexed: Nth form row ← profile.experience[N]) ------
  // These sit BEFORE the address block so a "Location"/"City" field inside an
  // Employment History section maps to the job's location, not the home address.
  {
    key: 'expCompany',
    label: 'Company',
    kind: 'text',
    keywords: ['company', 'employer', 'company name', 'employer name', 'organization'],
    requireSection: EXP_SECTIONS,
    exclude: ['why', 'cover', 'school', 'current company', 'current employer'],
    indexed: 'experience',
    value: (p, i) => clean(p.experience[i]?.company),
  },
  {
    key: 'expTitle',
    label: 'Job title',
    kind: 'text',
    keywords: ['title', 'job title', 'position', 'role', 'position title'],
    requireSection: EXP_SECTIONS,
    exclude: ['salutation', 'current title'],
    indexed: 'experience',
    value: (p, i) => clean(p.experience[i]?.title),
  },
  {
    key: 'expLocation',
    label: 'Job location',
    kind: 'text',
    keywords: ['location', 'city', 'work location', 'office location'],
    requireSection: EXP_SECTIONS,
    indexed: 'experience',
    value: (p, i) => clean(p.experience[i]?.location),
  },

  {
    key: 'addressLine2',
    label: 'Address line 2',
    kind: 'text',
    keywords: ['address line 2', 'address 2', 'apt', 'apartment', 'suite', 'unit'],
    autocomplete: ['address-line2'],
    value: (p) => clean(p.addressLine2),
  },
  {
    key: 'addressLine1',
    label: 'Street address',
    kind: 'text',
    keywords: ['address line 1', 'street address', 'street', 'address', 'addr'],
    autocomplete: ['address-line1', 'street-address'],
    exclude: ['email', 'ip', 'web', 'url', 'city', 'state', 'zip', 'postal', 'country', 'line 2'],
    value: (p) => clean(p.addressLine1),
  },
  {
    key: 'city',
    label: 'City',
    kind: 'text',
    keywords: ['city', 'town', 'locality'],
    autocomplete: ['address-level2'],
    value: (p) => clean(p.city),
  },
  {
    key: 'state',
    label: 'State',
    kind: 'text',
    keywords: ['state', 'province', 'region'],
    autocomplete: ['address-level1'],
    exclude: ['statement', 'united states'],
    value: (p) => clean(p.state),
  },
  {
    key: 'zip',
    label: 'ZIP / Postal code',
    kind: 'text',
    keywords: ['zip', 'postal', 'postcode', 'post code', 'zip code'],
    autocomplete: ['postal-code'],
    value: (p) => clean(p.zip),
  },
  {
    key: 'country',
    label: 'Country',
    kind: 'text',
    keywords: ['country', 'dial code', 'dialing code'],
    autocomplete: ['country', 'country-name', 'tel-country-code'],
    value: (p) => clean(p.country),
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    kind: 'text',
    keywords: ['linkedin', 'linked in'],
    value: (p) => clean(p.linkedin),
  },
  {
    key: 'github',
    label: 'GitHub',
    kind: 'text',
    keywords: ['github', 'git hub'],
    value: (p) => clean(p.github),
  },
  {
    key: 'twitter',
    label: 'Twitter / X',
    kind: 'text',
    keywords: ['twitter', 'x handle', 'x profile'],
    value: (p) => clean(p.twitter),
  },
  {
    key: 'website',
    label: 'Website / Portfolio',
    kind: 'text',
    keywords: ['portfolio', 'website', 'personal site', 'personal website', 'web site', 'url', 'homepage'],
    autocomplete: ['url'],
    exclude: ['linkedin', 'github', 'twitter', 'company'],
    value: (p) => clean(p.website),
  },

  // --- Education (indexed: Nth form row ← profile.education[N]) ------------
  {
    key: 'school',
    label: 'School',
    kind: 'text',
    keywords: ['school', 'university', 'college', 'institution', 'alma mater', 'school name'],
    exclude: ['high school diploma'],
    indexed: 'education',
    value: (p, i) => clean(p.education[i]?.school),
  },
  {
    key: 'degree',
    label: 'Degree',
    kind: 'text',
    keywords: ['degree', 'degree type', 'education level', 'qualification', 'highest education'],
    indexed: 'education',
    value: (p, i) => clean(p.education[i]?.degree),
  },
  {
    key: 'fieldOfStudy',
    label: 'Field of study',
    kind: 'text',
    keywords: ['major', 'field of study', 'area of study', 'discipline', 'concentration', 'course of study'],
    indexed: 'education',
    value: (p, i) => clean(p.education[i]?.field),
  },
  {
    key: 'gpa',
    label: 'GPA',
    kind: 'text',
    keywords: ['gpa', 'grade point average', 'grade point'],
    indexed: 'education',
    value: (p, i) => clean(p.education[i]?.gpa),
  },
  {
    key: 'eduStartDate',
    label: 'Education start date',
    kind: 'text',
    keywords: ['start date', 'start month', 'start year', 'from', 'attended from', 'start'],
    requireSection: EDU_SECTIONS,
    indexed: 'education',
    value: (p, i) => clean(p.education[i]?.startDate),
  },
  {
    key: 'eduEndDate',
    label: 'Education end date',
    kind: 'text',
    keywords: ['end date', 'end month', 'end year', 'graduation date', 'graduation year', 'to', 'graduated', 'end'],
    requireSection: EDU_SECTIONS,
    indexed: 'education',
    value: (p, i) => clean(p.education[i]?.endDate),
  },
  {
    key: 'expStartDate',
    label: 'Employment start date',
    kind: 'text',
    keywords: ['start date', 'start month', 'start year', 'from', 'employed from', 'start'],
    requireSection: EXP_SECTIONS,
    indexed: 'experience',
    value: (p, i) => clean(p.experience[i]?.startDate),
  },
  {
    key: 'expEndDate',
    label: 'Employment end date',
    kind: 'text',
    keywords: ['end date', 'end month', 'end year', 'to', 'employed to', 'end'],
    requireSection: EXP_SECTIONS,
    indexed: 'experience',
    value: (p, i) => clean(p.experience[i]?.endDate),
  },
  {
    key: 'responsibilities',
    label: 'Role description',
    kind: 'longtext',
    keywords: ['responsibilities', 'duties', 'role description', 'describe your role', 'what did you do'],
    indexed: 'experience',
    value: (p, i) => clean(p.experience[i]?.description),
  },

  {
    key: 'currentCompany',
    label: 'Current company',
    kind: 'text',
    keywords: ['current company', 'current employer', 'present employer', 'company name', 'employer name', 'employer', 'company'],
    autocomplete: ['organization'],
    exclude: ['why', 'cover', 'school', 'parent', 'search', 'keywords'],
    value: (p) => clean(p.currentCompany),
  },
  {
    key: 'currentTitle',
    label: 'Current title',
    kind: 'text',
    keywords: ['current title', 'job title', 'current role', 'current position', 'position title', 'role title', 'title'],
    autocomplete: ['organization-title'],
    exclude: ['salutation', 'mr mrs', 'page title', 'job posting', 'search', 'keywords'],
    value: (p) => clean(p.currentTitle),
  },
  {
    key: 'yearsExperience',
    label: 'Years of experience',
    kind: 'text',
    keywords: ['years of experience', 'years experience', 'yrs experience', 'total experience', 'experience years', 'how many years'],
    value: (p) => clean(p.yearsExperience),
  },
  {
    key: 'desiredSalary',
    label: 'Desired salary',
    kind: 'text',
    category: 'salary',
    keywords: [
      'desired salary',
      'expected salary',
      'salary expectation',
      'salary expectations',
      'compensation expectation',
      'compensation expectations',
      'desired compensation',
      'expected compensation',
      'pay expectations',
      'base salary',
      'salary requirement',
      'salary',
      'compensation',
    ],
    value: (p) => clean(p.desiredSalary),
  },
  {
    key: 'noticePeriod',
    label: 'Notice period',
    kind: 'text',
    keywords: ['notice period', 'period of notice'],
    value: (p) => clean(p.noticePeriod),
  },
  {
    key: 'earliestStartDate',
    label: 'Start date',
    kind: 'text',
    keywords: ['start date', 'available start', 'availability date', 'earliest start', 'when can you start', 'date available'],
    excludeSection: [...EDU_SECTIONS, ...EXP_SECTIONS],
    value: (p) => clean(p.earliestStartDate),
  },
  {
    key: 'remotePreference',
    label: 'Work location preference',
    kind: 'text',
    keywords: [
      'work location preference',
      'workplace type',
      'work arrangement',
      'work model',
      'location preference',
      'remote or hybrid',
      'remote hybrid',
      'remote onsite',
      'work preference',
      'remote',
      'hybrid',
    ],
    exclude: ['remote control'],
    value: (p) => clean(p.remotePreference),
  },
  {
    key: 'workAuthorized',
    label: 'Work authorization',
    kind: 'yesno',
    keywords: [
      'authorized to work',
      'work authorization',
      'legally authorized',
      'right to work',
      'eligible to work',
      'authorised to work',
      'work eligibility',
    ],
    exclude: ['sponsor'],
    value: (p) => clean(p.workAuthorized),
  },
  {
    key: 'requireSponsorship',
    label: 'Sponsorship needed',
    kind: 'yesno',
    keywords: [
      'sponsorship',
      'require visa',
      'need sponsorship',
      'visa sponsorship',
      'immigration sponsorship',
      'require sponsorship',
      'visa status',
    ],
    value: (p) => clean(p.requireSponsorship),
  },
  {
    key: 'willingToRelocate',
    label: 'Willing to relocate',
    kind: 'yesno',
    keywords: ['relocate', 'relocation', 'willing to move'],
    value: (p) => clean(p.willingToRelocate),
  },
  {
    key: 'hispanicLatino',
    label: 'Hispanic / Latino',
    kind: 'yesno',
    category: 'eeo',
    keywords: ['hispanic', 'latino', 'latinx'],
    value: (p) => clean(p.hispanicLatino),
  },
  {
    key: 'gender',
    label: 'Gender',
    kind: 'text',
    category: 'eeo',
    keywords: ['gender', 'sex'],
    exclude: ['legal sex of', 'orientation'],
    value: (p) => clean(p.gender),
  },
  {
    key: 'pronouns',
    label: 'Pronouns',
    kind: 'text',
    category: 'eeo',
    keywords: ['pronoun'],
    value: (p) => clean(p.pronouns),
  },
  {
    key: 'raceEthnicity',
    label: 'Race / Ethnicity',
    kind: 'text',
    category: 'eeo',
    keywords: ['race', 'ethnicity', 'ethnic'],
    value: (p) => clean(p.raceEthnicity),
  },
  {
    key: 'veteranStatus',
    label: 'Veteran status',
    kind: 'text',
    category: 'eeo',
    keywords: ['veteran', 'military service', 'protected veteran'],
    value: (p) => clean(p.veteranStatus),
  },
  {
    key: 'disabilityStatus',
    label: 'Disability status',
    kind: 'text',
    category: 'disability',
    keywords: ['disability', 'disabilities'],
    value: (p) => clean(p.disabilityStatus),
  },
  {
    key: 'howHeard',
    label: 'How did you hear about us',
    kind: 'text',
    keywords: [
      'how did you hear',
      'referral source',
      'how you heard',
      'source of application',
      'where did you hear',
      'how did you find',
      'who referred you',
    ],
    value: (p) => clean(p.howHeard),
  },
  {
    key: 'coverLetter',
    label: 'Cover letter',
    kind: 'longtext',
    keywords: ['cover letter', 'why do you want', 'why are you interested', 'tell us why', 'motivation'],
    value: (p) => clean(p.coverLetter),
  },
  {
    key: 'summary',
    label: 'Summary',
    kind: 'longtext',
    keywords: ['tell us about yourself', 'about you', 'additional information', 'anything else', 'summary', 'bio', 'introduce yourself'],
    value: (p) => clean(p.summary),
  },
]

function specMatches(spec: FieldSpec, ctx: FieldContext): boolean {
  // Excludes stay broad (substring) so e.g. "sponsor" blocks "sponsorship".
  if (spec.exclude?.some((term) => ctx.signal.includes(term))) return false
  const sections = ctx.sectionSignal + ' ' + ctx.signal
  if (spec.excludeSection?.some((term) => sections.includes(term))) return false
  if (spec.requireSection && !spec.requireSection.some((term) => sections.includes(term))) {
    return false
  }
  if (spec.autocomplete?.includes(ctx.autocomplete)) return true
  if (spec.exactKeywords?.some((kw) => ctx.signal === kw)) return true
  return spec.keywords.some((kw) => hasPhrase(ctx.signal, kw))
}

function matchCustom(ctx: FieldContext, customs: CustomAnswer[]): MatchedField | null {
  for (const c of customs) {
    const answer = c.answer.trim()
    if (!answer) continue
    const keywords = c.keywords
      .split(',')
      .map((k) => normalize(k))
      .filter(Boolean)
    if (keywords.some((kw) => ctx.signal.includes(kw))) {
      return {
        key: `custom:${c.id}`,
        label: 'Custom answer',
        value: answer,
        candidates: parseCandidates(answer),
        kind: 'longtext',
      }
    }
  }
  return null
}

export interface MatchOptions {
  /** Categories the user has switched off (EEO, disability, salary). */
  disabledCategories?: ReadonlySet<SpecCategory>
  /**
   * Ordinal allocator for repeating sections: called once per matching indexed
   * field, must return 0 for the first "School" field seen, 1 for the second…
   * (createEntryIndexer() provides the standard implementation). Omitted →
   * every indexed field reads entry 0.
   */
  entryIndex?: (section: IndexedSection, key: string) => number
}

/** Spec keys per repeating section — used to count how many rows a form shows. */
export const EDUCATION_KEYS = ['school', 'degree', 'fieldOfStudy', 'gpa', 'eduStartDate', 'eduEndDate']
export const EXPERIENCE_KEYS = ['expCompany', 'expTitle', 'expLocation', 'expStartDate', 'expEndDate', 'responsibilities']

export interface EntryIndexer {
  /** MatchOptions.entryIndex implementation. */
  next: (section: IndexedSection, key: string) => number
  /** How many rows of a section the form showed (max occurrences of any key). */
  rowCount: (section: IndexedSection) => number
}

/** Per-key occurrence counters mapping the Nth form row to profile entry N. */
export function createEntryIndexer(): EntryIndexer {
  const counters = new Map<string, number>()
  return {
    next(_section, key) {
      const n = counters.get(key) ?? 0
      counters.set(key, n + 1)
      return n
    },
    rowCount(section) {
      const keys = section === 'education' ? EDUCATION_KEYS : EXPERIENCE_KEYS
      return Math.max(0, ...keys.map((k) => counters.get(k) ?? 0))
    },
  }
}

/**
 * Resolve a field context to the value Gongzuo would fill. Custom answers take
 * priority so users can always override the built-in heuristics.
 */
export function matchContext(
  ctx: FieldContext,
  profile: Profile,
  customs: CustomAnswer[] = [],
  options: MatchOptions = {},
): MatchedField | null {
  if (!ctx.signal) return null

  const custom = matchCustom(ctx, customs)
  if (custom) return custom

  for (const spec of SPECS) {
    if (spec.category && options.disabledCategories?.has(spec.category)) continue
    if (!specMatches(spec, ctx)) continue
    const idx = spec.indexed ? (options.entryIndex?.(spec.indexed, spec.key) ?? 0) : 0
    const value = spec.value(profile, idx)
    if (value === undefined) {
      // An indexed spec has positively identified the field's meaning (it IS
      // row N's company/school/…) — there is just no profile entry for row N.
      // Stop here so a generic spec (currentCompany, city…) can't hijack it.
      if (spec.indexed) return null
      continue
    }
    return {
      key: spec.key,
      label: idx > 0 ? `${spec.label} #${idx + 1}` : spec.label,
      value,
      candidates: parseCandidates(value),
      kind: spec.kind,
    }
  }
  return null
}

export type FileSlot = 'resume' | 'coverLetterFile'

/** Document nouns that mean an "Attach …" input is NOT a resume upload. */
const NON_RESUME_DOCS = [
  'transcript',
  'portfolio',
  'sample',
  'samples',
  'cover',
  'reference',
  'references',
  'certificate',
  'certification',
  'license',
  'photo',
  'headshot',
  'id',
]

/** Which stored document (if any) belongs in this file input? */
export function matchFileContext(ctx: FieldContext): FileSlot | null {
  if (!ctx.signal) return null
  if (['cover letter', 'coverletter', 'letter of motivation'].some((kw) => ctx.signal.includes(kw))) {
    return 'coverLetterFile'
  }
  if (
    hasPhrase(ctx.signal, 'resume') ||
    hasPhrase(ctx.signal, 'cv') ||
    ctx.signal.includes('curriculum vitae')
  ) {
    return 'resume'
  }
  // Generic "Attach file" counts as a resume ONLY when no other document noun
  // says otherwise ("Attach transcript" must not receive the resume).
  if (hasPhrase(ctx.signal, 'attach') && !NON_RESUME_DOCS.some((w) => hasPhrase(ctx.signal, w))) {
    return 'resume'
  }
  return null
}

/** Try each candidate value in order; first one that resolves to an option wins. */
export function chooseOptionMulti(
  options: { value: string; label: string }[],
  candidates: string[],
  kind: FieldKind,
): number {
  for (const candidate of candidates) {
    const idx = chooseOption(options, candidate, kind)
    if (idx >= 0) return idx
  }
  return -1
}

/** Map a profile value to the best-fitting option among radio/select choices. */
export function chooseOption(
  options: { value: string; label: string }[],
  target: string,
  kind: FieldKind,
): number {
  const want = normalize(target)
  const norm = options.map((o) => ({
    value: normalize(o.value),
    label: normalize(o.label),
  }))

  const yesWords = ['yes', 'true', 'y', 'i am', 'i do', 'authorized', 'eligible', 'agree']
  const noWords = ['no', 'false', 'n', 'i am not', 'i do not', 'not authorized', 'decline']

  if (kind === 'yesno') {
    const positive = want === 'yes'
    const wantWords = positive ? yesWords : noWords
    const avoidWords = positive ? noWords : yesWords
    let best = -1
    for (let i = 0; i < norm.length; i++) {
      const hay = `${norm[i].label} ${norm[i].value}`.trim()
      if (!hay) continue
      // An avoid word only vetoes when no LONGER want word also matches:
      // want=no must accept "i do not require sponsorship" even though the
      // yes-word "i do" is its prefix.
      const avoid = avoidWords.some(
        (w) =>
          (hay === w || hay.startsWith(w + ' ')) &&
          !wantWords.some((ww) => ww.length > w.length && (hay === ww || hay.startsWith(ww + ' '))),
      )
      if (avoid) continue
      if (wantWords.some((w) => hay === w || hay.startsWith(w + ' ') || hay.includes(' ' + w))) {
        return i
      }
      if (best === -1 && hay.includes(positive ? 'yes' : 'no')) best = i
    }
    return best
  }

  // Exact, then prefix, then substring (both directions).
  let exact = -1
  let prefix = -1
  let includes = -1
  for (let i = 0; i < norm.length; i++) {
    const hay = norm[i].label || norm[i].value
    if (!hay) continue
    if (hay === want) exact = i
    else if (prefix === -1 && (hay.startsWith(want) || want.startsWith(hay))) prefix = i
    else if (includes === -1 && (hay.includes(want) || want.includes(hay))) includes = i
  }
  return exact !== -1 ? exact : prefix !== -1 ? prefix : includes
}
