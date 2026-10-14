import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Exercise the production counters without a browser or network dependency.
const source = readFileSync(new URL('../script.js', import.meta.url), 'utf8')
  .split('const reviewTrack =')[0]

function createCounters(reducedMotion) {
  const counters = [
    { dataset: { count: '4.9', decimals: '1', suffix: ' / 5' }, textContent: '4,9 / 5' },
    { dataset: { count: '19' }, textContent: '19' }
  ]
  let frames = []
  const context = {
    window: {}, Intl, performance: { now: () => 0 },
    matchMedia: () => ({ matches: reducedMotion }),
    requestAnimationFrame: callback => frames.push(callback),
    document: {
      querySelector: () => null,
      querySelectorAll: selector => selector === '[data-count]' ? counters : [],
      addEventListener() {}
    }
  }
  vm.runInNewContext(source, context)
  return {
    values: () => counters.map(counter => counter.textContent),
    frame(now) {
      const pending = frames
      frames = []
      pending.forEach(callback => callback(now))
    },
    pending: () => frames.length
  }
}

const animated = createCounters(false)
animated.frame(0)
assert.deepEqual(animated.values(), ['0,0 / 5', '0'])
animated.frame(550)
assert.deepEqual(animated.values(), ['4,6 / 5', '18'])
animated.frame(1100)
assert.deepEqual(animated.values(), ['4,9 / 5', '19'])
assert.equal(animated.pending(), 0)

const reduced = createCounters(true)
assert.deepEqual(reduced.values(), ['4,9 / 5', '19'])
assert.equal(reduced.pending(), 0)
console.log('Count-up: progress, Finnish decimals, prefixes, suffixes and reduced motion passed.')
