const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches

const menuButton = document.querySelector('.menu-toggle')
const menu = document.querySelector('.main-nav')

function setMenu(open) {
  menu?.classList.toggle('is-open', open)
  menuButton?.setAttribute('aria-expanded', String(open))
  menuButton?.setAttribute('aria-label', open ? 'Sulje valikko' : 'Avaa valikko')
  const icon = menuButton?.querySelector('.menu-icon')
  if (icon) icon.textContent = open ? '×' : '☰'
}

menuButton?.addEventListener('click', () => setMenu(!menu?.classList.contains('is-open')))
menu?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)))
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && menu?.classList.contains('is-open')) {
    setMenu(false)
    menuButton?.focus()
  }
})

document.querySelectorAll('.faq-item button').forEach(button => button.addEventListener('click', () => {
  const item = button.closest('.faq-item')
  const wasOpen = item.classList.contains('is-open')
  document.querySelectorAll('.faq-item').forEach(other => {
    other.classList.remove('is-open')
    other.querySelector('button')?.setAttribute('aria-expanded', 'false')
  })
  if (!wasOpen) {
    item.classList.add('is-open')
    button.setAttribute('aria-expanded', 'true')
  }
}))

const counters = document.querySelectorAll('[data-count]')

function renderCounter(element, value) {
  const decimals = Number(element.dataset.decimals || 0)
  const formatted = new Intl.NumberFormat('fi-FI', {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals
  }).format(value)
  element.textContent = (element.dataset.prefix || '') + formatted + (element.dataset.suffix || '')
}

function runCounter(element) {
  const target = Number(element.dataset.count)
  if (!Number.isFinite(target)) return
  if (reduceMotion) {
    renderCounter(element, target)
    return
  }
  const duration = 1100
  const start = performance.now()
  const tick = now => {
    const progress = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : Math.min((now - start) / duration, 1)
    const eased = 1 - Math.pow(1 - progress, 4)
    renderCounter(element, target * eased)
    if (progress < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

if ('IntersectionObserver' in window && !reduceMotion) {
  const counterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return
      runCounter(entry.target)
      counterObserver.unobserve(entry.target)
    })
  }, { threshold: 0.6 })
  counters.forEach(counter => counterObserver.observe(counter))
} else {
  counters.forEach(runCounter)
}

const reviewTrack = document.querySelector('.review-track')
const reviewCards = [...document.querySelectorAll('.review-card')]
const reviewPrev = document.querySelector('.review-prev')
const reviewNext = document.querySelector('.review-next')
let reviewIndex = 0

function visibleReviewCount() {
  return matchMedia('(min-width: 60rem)').matches ? 2 : 1
}

function updateReviewCarousel() {
  if (!reviewTrack || !reviewCards.length) return
  const visible = visibleReviewCount()
  const maxIndex = Math.max(0, reviewCards.length - visible)
  reviewIndex = Math.min(reviewIndex, maxIndex)
  const styles = getComputedStyle(reviewTrack)
  const gap = Number.parseFloat(styles.columnGap || styles.gap) || 0
  const cardWidth = reviewCards[0].getBoundingClientRect().width
  reviewTrack.style.transform = `translateX(${-reviewIndex * (cardWidth + gap)}px)`
  if (reviewPrev) reviewPrev.disabled = reviewIndex === 0
  if (reviewNext) reviewNext.disabled = reviewIndex === maxIndex
}

reviewPrev?.addEventListener('click', () => {
  reviewIndex = Math.max(0, reviewIndex - 1)
  updateReviewCarousel()
})

reviewNext?.addEventListener('click', () => {
  reviewIndex += 1
  updateReviewCarousel()
})

let resizeFrame
addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(updateReviewCarousel)
}, { passive: true })
updateReviewCarousel()

// Motion is isolated from navigation, carousel and form state. The locally
// served libraries are optional: content stays visible if they cannot load.
// Expanded service lists change section positions, not form or carousel state.
document.querySelectorAll('.service-details').forEach(details => {
  details.addEventListener('toggle', () => window.ScrollTrigger?.refresh())
})

// Vite places its module in the head. Wait for the preserved classic vendor
// scripts before initializing the exact same page animations.
function initializePageMotion() {
  if (!reduceMotion && window.gsap) document.documentElement.classList.add('motion-ready')
  if (window.gsap && window.ScrollTrigger) {
    const { gsap, ScrollTrigger } = window
    gsap.registerPlugin(ScrollTrigger)
    const motion = gsap.matchMedia()
    motion.add('(prefers-reduced-motion: no-preference)', () => {
      const hero = gsap.timeline({ defaults: { ease: 'power3.out' } })
      hero.fromTo('.hero-media', { opacity: 0, scale: 1.025 },
        { opacity: 1, scale: 1, duration: 1.25, clearProps: 'transform,opacity' }, 0)
        .fromTo('.hero-kicker', { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.65, clearProps: 'transform,opacity' }, 0.12)
        .fromTo('.hero-title .line', { y: 0, yPercent: 105 },
          { yPercent: 0, duration: 0.85, stagger: 0.1, clearProps: 'transform' }, 0.2)
        .fromTo('.hero-copy', { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.7, clearProps: 'transform,opacity' }, 0.4)
        .fromTo('.hero-actions', { opacity: 0, y: 10 },
          { opacity: 1, y: 0, duration: 0.65, clearProps: 'transform,opacity' }, 0.52)
  
      const entrances = []
      const reveal = (elements, trigger, stagger = 0) => {
        if (!elements.length || !trigger) return
        const tween = gsap.fromTo(elements, { opacity: 0, y: 16 }, {
          opacity: 1, y: 0, duration: 0.7, stagger, ease: 'power3.out',
          immediateRender: false, clearProps: 'transform,opacity',
          scrollTrigger: { trigger, start: 'top 91%', once: true }
        })
        entrances.push({ elements: Array.from(elements), tween })
      }
      document.querySelectorAll('.section-heading, .service-intake, .cta-inner, .contact-heading, .form-panel, .contact-details').forEach(element => {
        reveal([element], element)
      })
      reveal(document.querySelectorAll('.stat-item'), document.querySelector('.stats-grid'), 0.07)
      reveal(document.querySelectorAll('.workshop-service'), document.querySelector('.workshop-services'), 0.1)
      reveal(document.querySelectorAll('.reviews-widget'), document.querySelector('.reviews-widget'))
      reveal(document.querySelectorAll('.faq-item'), document.querySelector('.faq-list'), 0.055)
  
      // Keyboard navigation must never wait for an entrance animation.
      const finishFocusedEntrance = event => {
        entrances.forEach(({ elements, tween }) => {
          if (elements.some(element => element.contains(event.target))) tween.progress(1)
        })
        if (document.querySelector('.hero')?.contains(event.target)) hero.progress(1)
      }
      document.addEventListener('focusin', finishFocusedEntrance)
      document.documentElement.classList.remove('motion-ready')
      return () => {
        document.removeEventListener('focusin', finishFocusedEntrance)
        document.documentElement.classList.remove('motion-ready')
      }
    })
  } else {
    document.documentElement.classList.remove('motion-ready')
  }
}
if (document.readyState === 'complete') initializePageMotion()
else window.addEventListener('load', initializePageMotion, { once: true })
