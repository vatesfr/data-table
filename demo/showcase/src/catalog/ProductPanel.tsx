import { For, Show } from 'solid-js'
import type { Product } from './data'
import { colorLabel, formatDate, marginOf, price, stars, stockPill, thumb } from './parts'

export function ProductPanel(props: {
  product: Product | null
  onClose: () => void
  ref: (el: HTMLElement) => void
}) {
  return (
    <aside
      class="panel"
      ref={props.ref}
      hidden={props.product == null}
      aria-label="Product details"
    >
      <Show when={props.product}>
        {(p) => (
          <>
            <button class="panel-close" aria-label="Close details" onClick={() => props.onClose()}>
              ×
            </button>
            {thumb(p(), 'lg')}
            <h2>{p().name}</h2>
            <p class="panel-sub">
              {p().brand} · {p().category} · <code>{p().sku}</code>
            </p>
            <p class="panel-price">{price(p().price)}</p>
            {stars(p().rating)}
            <span class="muted"> {p().reviews} reviews</span>
            <dl>
              <dt>Stock</dt>
              <dd>{stockPill(p().stock)}</dd>
              <dt>Cost</dt>
              <dd>{price(p().cost)}</dd>
              <dt>Margin</dt>
              <dd>{marginOf(p())}%</dd>
              <dt>Colors</dt>
              <dd class="panel-colors">
                <For each={p().colors}>{colorLabel}</For>
              </dd>
              <dt>Added</dt>
              <dd>{formatDate(p().added)}</dd>
            </dl>
          </>
        )}
      </Show>
    </aside>
  )
}
