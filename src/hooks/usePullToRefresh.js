import { useEffect, useRef } from 'react'

export function usePullToRefresh(onRefresh) {
  useEffect(() => {
    let touchStartY = 0
    let startedAtTop = false
    let hasScrolled = false

    const handleTouchStart = (e) => {
      // Only allow if we're at the very top when touch starts
      startedAtTop = window.scrollY === 0
      hasScrolled = false
      if (startedAtTop) {
        touchStartY = e.touches[0].clientY
      }
    }

    const handleScroll = () => {
      // Mark that scrolling happened - cancel pull-to-refresh
      hasScrolled = true
      startedAtTop = false
    }

    const handleTouchMove = (e) => {
      // Cancel if touch didn't start at top
      if (!startedAtTop) return
      
      // Cancel if any scrolling happened
      if (hasScrolled) {
        startedAtTop = false
        return
      }
      
      // Cancel if we're no longer at top
      if (window.scrollY !== 0) {
        startedAtTop = false
        return
      }
    }

    const handleTouchEnd = (e) => {
      // Only refresh if:
      // 1. Started at top
      // 2. Still at top
      // 3. No scrolling happened
      // 4. Pulled down more than 150px
      if (startedAtTop && window.scrollY === 0 && !hasScrolled) {
        const touchEndY = e.changedTouches[0].clientY
        const distance = touchEndY - touchStartY
        
        if (distance > 150) {
          onRefresh()
        }
      }
      
      startedAtTop = false
      hasScrolled = false
      touchStartY = 0
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [onRefresh])
}
