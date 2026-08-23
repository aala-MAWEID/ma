/**
 * تنبيه صوتي واهتزاز خفيف للمتصفح عند اقتراب الدور.
 * يستخدم Web Audio API (بلا ملف خارجي) و navigator.vibrate إن وُجد.
 */
export function pingTurn(kind: 'approaching' | 'now' = 'approaching'): void {
  // 1. اهتزاز
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate(kind === 'now' ? [200, 100, 200] : [120, 80, 120])
    }
  } catch {
    // تجاهل إن منعه المتصفح
  }

  // 2. نغمة خفيفة
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(kind === 'now' ? 880 : 587.33, ctx.currentTime) // A5 أو D5
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (kind === 'now' ? 0.45 : 0.25))

    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (kind === 'now' ? 0.5 : 0.3))
  } catch {
    // تجاهل إن كان الصوت مقفولاً من قِبل المتصفح قبل أول تفاعل
  }
}
