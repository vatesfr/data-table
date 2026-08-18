import { describe, it, expect } from 'vitest'
import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'

// Phase 0 of the Solid migration (see CLAUDE.md's "planned: Solid + TSX rewrite" note): this test
// exists only to prove the build/type-check/test pipeline actually understands .tsx + Solid's JSX
// runtime end to end, before any real component is written. It intentionally has nothing to do
// with the table itself — once the real migration is underway and covered by its own tests, this
// file should be deleted.
describe('Solid build pipeline scaffold', () => {
  it('mounts a reactive Solid component into a real DOM node', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)

    function Counter() {
      const [count, setCount] = createSignal(0)
      return (
        <button type="button" onClick={() => setCount((c) => c + 1)}>
          {count()}
        </button>
      )
    }

    const dispose = render(() => <Counter />, container)

    const button = container.querySelector('button')!
    expect(button.textContent).toBe('0')
    button.click()
    expect(button.textContent).toBe('1')

    dispose()
    container.remove()
  })
})
