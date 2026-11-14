import { createRoot } from 'react-dom/client'
import { EstimateTool } from '../components/estimate/EstimateTool'
import './calculator.css'

const mount = document.getElementById('estimate-root')
if (mount) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
  const production = import.meta.env.VITE_ESTIMATE_PUBLIC_ENABLED === 'true'
    && import.meta.env.VITE_ESTIMATE_API_URL === 'https://otalammen-estimate-api.aatosmarketing.workers.dev/api/estimate-request'
    && window.location.origin === 'https://aatosniinikoski-cloud.github.io'
    && window.location.pathname.startsWith('/otalammen-autohuolto-kokosivusto/')
  const submissionEnabled = production || (local && Boolean(import.meta.env.VITE_ESTIMATE_API_URL))
  const notice = document.getElementById('estimate-notice')
  const footer = document.getElementById('estimate-footer-status')
  if (production) {
    if (notice) notice.textContent = 'Lomake lähettää huoltopyynnön korjaamolle. Lähetys ei vahvista ajanvarausta eikä lopullista hintaa.'
    if (footer) footer.textContent = 'Huoltopyynnöt verkossa'
  } else if (local && notice) {
    notice.textContent = submissionEnabled
      ? 'Paikallinen testikäyttö. Käytä vain keinotekoisia tietoja ja testikuvia. Lähetys menee korjaamon vastaanottopalveluun.'
      : 'Paikallinen testikäyttö. Käytä vain keinotekoisia tietoja. Lähetys on suljettu tässä esikatselussa.'
  }
  createRoot(mount).render(<EstimateTool submissionEnabled={submissionEnabled} />)
  // Step heights change. Keep the existing page reveals aligned without
  // altering calculator state, navigation, pricing or submission behavior.
  const page = window as Window & { ScrollTrigger?: { refresh(): void } }
  let resizeFrame = 0
  new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => page.ScrollTrigger?.refresh())
  }).observe(mount)
}
