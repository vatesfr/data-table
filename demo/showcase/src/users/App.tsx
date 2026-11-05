import { createMemo, createSignal, For, Show } from 'solid-js'
import {
  compareInOrder,
  compareMissingLast,
  createTableState,
  DataTableView,
  LABELS_DE,
  LABELS_EN,
  LABELS_ES,
  LABELS_FR,
  LABELS_PT,
  usePersistence,
  type ColumnDef,
  type TableViewState,
} from '@vates/data-table-solid'
import { Shell } from '../common/Shell'
import { makeUsers, ROLES, TODAY, type Role, type Status, type User } from './data'
import { ViewsMenu, type NamedView } from './ViewsMenu'
import source from './App.tsx?raw'

const LOCALES = {
  en: { name: 'English', labels: LABELS_EN },
  fr: { name: 'Français', labels: LABELS_FR },
  es: { name: 'Español', labels: LABELS_ES },
  de: { name: 'Deutsch', labels: LABELS_DE },
  pt: { name: 'Português', labels: LABELS_PT },
}
type Lang = keyof typeof LOCALES

const DATE = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })
const RELATIVE = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const parseDay = (iso: string) => new Date(`${iso}T00:00`)
const formatDay = (iso: unknown) => (iso ? DATE.format(parseDay(iso as string)) : 'Never')

function ago(iso: string) {
  const days = Math.round((parseDay(TODAY).getTime() - parseDay(iso).getTime()) / 86_400_000)
  if (days < 30) return RELATIVE.format(-days, 'day')
  if (days < 365) return RELATIVE.format(-Math.round(days / 30), 'month')
  return RELATIVE.format(-Math.round(days / 365), 'year')
}

const STATUS_LABEL: Record<Status, string> = {
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
}

// Filter labels get the raw value as a string, cells the typed row
const badge = (cls: string, text: string) => <span class={cls}>{text}</span>
const roleBadge = (role: string) => badge(`role role--${role.toLowerCase()}`, role)
const statusBadge = (status: string) =>
  badge(`status status--${status}`, STATUS_LABEL[status as Status])
const mfaBadge = (mfa: string) => badge(`mfa mfa--${mfa.toLowerCase()}`, mfa)

function avatar(user: User) {
  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .join('')
  // Stable per-user hue so the avatar is recognizable across sorts
  const hue = [...user.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  return (
    <span class="user">
      <span class="avatar" style={{ '--hue': String(hue) }} aria-hidden="true">
        {initials}
      </span>
      <span class="user-text">
        <span class="user-name">{user.name}</span>
        <span class="user-email">{user.email}</span>
      </span>
    </span>
  )
}

const COLUMNS: ColumnDef<User>[] = [
  {
    key: 'name',
    label: 'User',
    pinned: true,
    width: 230,
    filterable: false,
    render: (_, user) => avatar(user),
  },
  { key: 'email', label: 'Email', filterable: false },
  {
    key: 'role',
    label: 'Role',
    groupable: true,
    compare: compareInOrder(ROLES),
    render: (_, u) => roleBadge(u.role),
    renderFilterLabel: roleBadge,
  },
  { key: 'team', label: 'Team', groupable: true },
  {
    key: 'groups',
    label: 'Groups',
    width: 180,
    render: (_, u) => (
      <span class="chips">
        <For each={u.groups}>{(g) => <span class="chip">{g}</span>}</For>
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    groupable: true,
    compare: compareInOrder(Object.keys(STATUS_LABEL)),
    format: (v) => STATUS_LABEL[v as Status],
    render: (_, user) => (
      <span class="status-cell">
        {statusBadge(user.status)}
        <Show when={user.invitedAt}>{(at) => <span class="muted">sent {ago(at())}</span>}</Show>
      </span>
    ),
    renderFilterLabel: statusBadge,
  },
  {
    key: 'mfa',
    label: '2FA',
    groupable: true,
    render: (_, u) => mfaBadge(u.mfa),
    renderFilterLabel: mfaBadge,
  },
  {
    key: 'lastLogin',
    label: 'Last login',
    type: 'date',
    defaultSortDir: 'desc',
    // "Never" stays at the bottom whichever way the column is sorted
    compare: compareMissingLast(),
    // No row in filter chips and checklists: format takes the value
    format: formatDay,
    render: (_, u) =>
      u.lastLogin ? (
        <span title={formatDay(u.lastLogin)}>{ago(u.lastLogin)}</span>
      ) : (
        <span class="muted">Never</span>
      ),
  },
  { key: 'created', label: 'Created', type: 'date', defaultSortDir: 'desc', format: formatDay },
]

// Limit: B42 — no public way to compare two views: JSON with sorted keys, so field order can't matter
const viewKey = (view: TableViewState) =>
  JSON.stringify(view, (_, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  )

// Status and 2FA hold one value per row: their filter checklist only excludes values
const BUILT_IN_VIEWS: NamedView[] = [
  { builtIn: true, name: 'All users', view: {} },
  { builtIn: true, name: 'Invited', view: { excludeFilters: { status: ['active', 'suspended'] } } },
  { builtIn: true, name: 'No 2FA', view: { excludeFilters: { mfa: ['Yes'] } } },
  { builtIn: true, name: 'Suspended', view: { excludeFilters: { status: ['active', 'invited'] } } },
]

const SAVED_KEY = 'showcase-users-saved-views'
const LANG_KEY = 'showcase-users-lang'

// Storage may be blocked (privacy settings) or hold anything: fall back to the default
function load<T>(key: string, parse: (raw: string) => T | undefined, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return (raw !== null && parse(raw)) || fallback
  } catch {
    return fallback
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Not persisted: the change still applies until the page is left
  }
}
const isLang = (s: string): s is Lang => Object.keys(LOCALES).includes(s)
const parseSaved = (s: string) => {
  const v: unknown = JSON.parse(s)
  return Array.isArray(v) ? (v as NamedView[]) : undefined
}

export function App() {
  const [users, setUsers] = createSignal(makeUsers())
  const [lang, setLang] = createSignal(
    load<Lang>(LANG_KEY, (s) => (isLang(s) ? s : undefined), 'en'),
  )
  const table = createTableState(users, COLUMNS, () => ({
    // Bulk actions replace row objects: keep the selection by id
    getRowId: (u: User) => u.id,
    labels: LOCALES[lang()].labels,
    initialViewState: {
      visibleCols: COLUMNS.map((c) => c.key).filter((k) => k !== 'email'),
      pageSize: 25,
    },
  }))
  // Current view in localStorage and the URL: survives a reload, can be shared as a link
  usePersistence(table, { storageKey: 'showcase-users-view', paramName: 'view' })

  // Saved views
  const [saved, setSaved] = createSignal(load(SAVED_KEY, parseSaved, []))
  const storeSaved = (views: NamedView[]) => {
    setSaved(views)
    store(SAVED_KEY, JSON.stringify(views))
  }
  const viewJson = createMemo(() => viewKey(table.getViewState()))
  // The user's own name wins over a built-in view with the same filters
  const activeView = () =>
    [...saved(), ...BUILT_IN_VIEWS].find((v) => viewKey(v.view) === viewJson())?.name
  const saveView = (name: string) =>
    storeSaved([...saved().filter((v) => v.name !== name), { name, view: table.getViewState() }])

  // Bulk actions
  const [notice, setNotice] = createSignal('')
  const selected = () => table.selection.rows()
  // `done` words the outcome; users `change` returns nothing for are reported as unchanged
  const updateSelected = (done: string, change: (u: User) => Partial<User> | undefined) => {
    const ids = new Set(selected().map((u) => u.id))
    let count = 0
    setUsers((prev) =>
      prev.map((u) => {
        const patch = ids.has(u.id) ? change(u) : undefined
        if (!patch) return u
        count++
        return { ...u, ...patch }
      }),
    )
    const unchanged = ids.size - count
    setNotice(
      `${done}: ${count} user${count === 1 ? '' : 's'}${unchanged ? ` (${unchanged} unchanged)` : ''}`,
    )
  }
  // The workspace owner can't be demoted or locked out
  const suspend = () =>
    updateSelected('Suspended', (u) =>
      u.role === 'Owner' || u.status === 'suspended' ? undefined : { status: 'suspended' },
    )
  const resendInvite = () =>
    updateSelected('Invite resent', (u) =>
      u.status === 'invited' ? { invitedAt: TODAY } : undefined,
    )
  const changeRole = (role: Role) =>
    updateSelected(`Role set to ${role}`, (u) =>
      u.role === 'Owner' || u.role === role ? undefined : { role },
    )
  const jumpToRows = () => {
    const first = table.processedData()[0]
    if (first) table.focus.moveTo(first, { focus: true })
  }

  return (
    <Shell
      title="User directory"
      context="150 accounts of a SaaS workspace. Pick a saved view or save your own; the current view survives a reload. The language menu switches the table's built-in labels (toolbar, menus, pager); column headers and data belong to the app and stay in English. Select users for bulk actions, also from the keyboard: Tab to “Jump to rows” (or through the headers), ↑/↓ to move, Space to select (Shift+↑/↓ extends); the actions appear in the toolbar above the headers."
      source={source}
    >
      <section class="panel" aria-label="Users">
        <div class="panel-bar">
          <h2 class="panel-title">{activeView() ?? 'Custom view'}</h2>
          {/* Limit: B43 — two Tab stops per column header before the rows, no built-in skip */}
          <button class="btn skip" onClick={jumpToRows}>
            Jump to rows
          </button>
          <ViewsMenu
            views={[...BUILT_IN_VIEWS, ...saved()]}
            active={activeView()}
            onApply={(view) => table.setViewState(view)}
            onSave={saveView}
            onDelete={(name) => storeSaved(saved().filter((v) => v.name !== name))}
          />
          <select
            class="lang"
            aria-label="Table language"
            value={lang()}
            onChange={(e) => {
              setLang(e.currentTarget.value as Lang)
              store(LANG_KEY, lang())
            }}
          >
            <For each={Object.entries(LOCALES)}>
              {([code, l]) => <option value={code}>{l.name}</option>}
            </For>
          </select>
        </div>
        <DataTableView
          table={table}
          selectable
          rowClass={(u) => (u.status === 'suspended' ? 'user-suspended' : undefined)}
          toolbarEnd={
            <div class="bulk" role="group" aria-label="Bulk actions">
              <Show when={selected().length > 0}>
                <span class="bulk-count">{selected().length} selected</span>
                <button class="btn" onClick={suspend}>
                  Suspend
                </button>
                <button
                  class="btn"
                  disabled={!selected().some((u) => u.status === 'invited')}
                  onClick={resendInvite}
                >
                  Resend invite
                </button>
                <select
                  class="btn"
                  aria-label="Change role"
                  onChange={(e) => {
                    changeRole(e.currentTarget.value as Role)
                    e.currentTarget.value = ''
                  }}
                >
                  <option value="">Change role…</option>
                  <For each={ROLES.filter((r) => r !== 'Owner')}>
                    {(r) => <option value={r}>{r}</option>}
                  </For>
                </select>
                <button class="btn btn--ghost" onClick={() => table.selection.clear()}>
                  Clear
                </button>
              </Show>
              {/* Beside the buttons: below the table it would be a page of rows away */}
              <span class="notice" role="status">
                {notice()}
              </span>
            </div>
          }
        />
      </section>
    </Shell>
  )
}
