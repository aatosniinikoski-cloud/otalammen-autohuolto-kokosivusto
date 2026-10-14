import { createRoot } from 'react-dom/client'
import { EstimateTool } from '../components/estimate/EstimateTool'
import './calculator.css'

const mount = document.getElementById('estimate-root')
if (mount) {
  createRoot(mount).render(<EstimateTool />)
  // Step heights change. Keep the existing page reveals aligned without
  // altering calculator state, navigation, pricing or submission behavior.
  const page = window as Window & { ScrollTrigger?: { refresh(): void } }
  let resizeFrame = 0
  new ResizeObserver(() => {
    cancelAnimationFrame(resizeFrame)
    resizeFrame = requestAnimationFrame(() => page.ScrollTrigger?.refresh())
  }).observe(mount)
}
