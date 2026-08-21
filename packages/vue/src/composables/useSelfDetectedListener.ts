import { getCurrentInstance, onUpdated, ref, type Ref } from 'vue'

/**
 * Detects whether the current component's caller passed a listener prop (e.g. `onRowClick`) —
 * used where a declared `emit` (e.g. `rowClick`) means Vue strips the raw listener out of
 * `$attrs`/`useAttrs()`, so presence has to be read off `vnode.props` directly instead.
 *
 * `vnode.props` isn't itself a reactive read, so a plain `computed` over it would only ever see
 * whatever it captured on the very first evaluation. The returned ref is instead re-derived in
 * `onUpdated` (which runs after every re-render, by which point `vnode.props` already reflects
 * the latest incoming listener), so a caller adding/removing the listener after mount is picked
 * up on the next render.
 */
export function useSelfDetectedListener(propName: string): Ref<boolean> {
  const detected = ref(!!getCurrentInstance()?.vnode.props?.[propName])
  onUpdated(() => {
    detected.value = !!getCurrentInstance()?.vnode.props?.[propName]
  })
  return detected
}
