type AudioContextLike = typeof AudioContext

// A short rising three-note arpeggio, generated with WebAudio — no audio asset,
// never autoplayed; only called from a user action (completing a step or toggling sound on).
const NOTES: readonly [frequency: number, delay: number][] = [
  [660, 0],
  [880, 0.09],
  [1174, 0.18],
]

export function playGuideRewardSound(): void {
  try {
    const AudioCtor: AudioContextLike | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextLike }).webkitAudioContext
    if (!AudioCtor) return
    const ctx = new AudioCtor()
    const now = ctx.currentTime
    for (const [frequency, delay] of NOTES) {
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.type = "sine"
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, now + delay)
      gain.gain.exponentialRampToValueAtTime(0.09, now + delay + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.22)
      oscillator.connect(gain)
      gain.connect(ctx.destination)
      oscillator.start(now + delay)
      oscillator.stop(now + delay + 0.24)
    }
    window.setTimeout(() => {
      try {
        void ctx.close()
      } catch {
        // context already closed
      }
    }, 600)
  } catch {
    // Audio unavailable — the reward still shows visually.
  }
}
