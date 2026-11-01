import { createSignal, For, onCleanup, Show } from 'solid-js'
import type { TableViewState } from '@vates/data-table-solid'

export interface NamedView {
  name: string
  view: TableViewState
  /** Shipped with the app: can't be deleted or overwritten */
  builtIn?: boolean
}

/** The "Views ▾" menu: apply, save (replacing a saved view of the same name) and delete views */
export function ViewsMenu(props: {
  views: NamedView[]
  active: string | undefined
  onApply: (view: TableViewState) => void
  onSave: (name: string) => void
  onDelete: (name: string) => void
}) {
  const [open, setOpen] = createSignal(false)
  const [name, setName] = createSignal('')
  const existing = () => {
    const n = name().trim().toLowerCase()
    return props.views.find((v) => v.name.toLowerCase() === n)
  }

  let root: HTMLDivElement | undefined
  let button: HTMLButtonElement | undefined
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) button?.focus()
  }
  const onOutside = (e: PointerEvent) => open() && !root?.contains(e.target as Node) && close(false)
  document.addEventListener('pointerdown', onOutside)
  onCleanup(() => document.removeEventListener('pointerdown', onOutside))

  const save = (e: SubmitEvent) => {
    e.preventDefault()
    if (!name().trim() || existing()?.builtIn) return
    props.onSave(existing()?.name ?? name().trim())
    setName('')
    close()
  }

  return (
    <div
      class="views"
      ref={(el) => (root = el)}
      onKeyDown={(e) => e.key === 'Escape' && open() && close()}
    >
      <button
        ref={(el) => (button = el)}
        class="btn"
        aria-expanded={open()}
        aria-controls="views-menu"
        onClick={() => setOpen(!open())}
      >
        Views ▾
      </button>
      <Show when={open()}>
        <div id="views-menu" class="views-menu">
          <For each={props.views}>
            {(v) => (
              <div class="views-item">
                <button
                  class="views-apply"
                  aria-current={props.active === v.name}
                  onClick={() => {
                    props.onApply(v.view)
                    close()
                  }}
                >
                  {v.name}
                </button>
                <Show when={!v.builtIn}>
                  <button
                    class="views-delete"
                    aria-label={`Delete view ${v.name}`}
                    onClick={() => props.onDelete(v.name)}
                  >
                    ×
                  </button>
                </Show>
              </div>
            )}
          </For>
          <form class="views-save" onSubmit={save}>
            <input
              aria-label="Save current view as"
              aria-describedby="views-save-hint"
              placeholder="Save current view as…"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
            />
            <button class="btn" type="submit" disabled={!name().trim() || existing()?.builtIn}>
              {existing() && !existing()?.builtIn ? 'Replace' : 'Save'}
            </button>
          </form>
          <p id="views-save-hint" class="views-hint">
            {existing()?.builtIn
              ? `“${existing()?.name}” is a built-in view: pick another name`
              : existing()
                ? `Replaces the saved view “${existing()?.name}”`
                : ''}
          </p>
        </div>
      </Show>
    </div>
  )
}
