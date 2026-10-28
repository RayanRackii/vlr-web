type AudioContextLike = typeof AudioContext

/** A tiny generated WebAudio beep — no audio asset, never autoplayed; only called from a user action. */
export function playGuideRewardSound(): void {
  try {
    const AudioCtor: AudioContextLike | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextLike }).webkitAudioContext
    if (!AudioCtor) return
    const ctx = new AudioCtor()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    oscillator.frequency.value = 880
    gain.gain.value = 0.05
    oscillator.connect(gain)
    gain.connect(ctx.destination)
    oscillator.start()
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18)
    oscillator.stop(ctx.currentTime + 0.2)
    oscillator.onended = () => void ctx.close()
  } catch {
    // Audio unavailable — the reward still shows visually.
  }
}
