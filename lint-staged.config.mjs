// One function so the steps run in order, the checks last, once, after the fixes they check.
const quote = (files) => files.map((f) => JSON.stringify(f)).join(' ')

export default (files) => {
  const code = files.filter((f) => /\.(js|mjs|cjs|ts|tsx|vue)$/.test(f))
  return [
    `prettier --ignore-unknown --write ${quote(files)}`,
    ...(code.length ? [`eslint --fix ${quote(code)}`] : []),
    'node scripts/check.mjs --staged',
  ]
}
