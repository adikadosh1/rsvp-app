export async function fireConfetti() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    const colors = ["#E91E8C", "#FF6B6B", "#FF9500", "#F048A8", "#FFFFFF"];
    const count = 120;
    const defaults = { origin: { y: 0.65 }, zIndex: 9999, colors };
    confetti({ ...defaults, particleCount: count, spread: 70, startVelocity: 42 });
    setTimeout(() => {
      confetti({ ...defaults, particleCount: count * 0.6, spread: 100, scalar: 0.85 });
    }, 180);
  } catch (_e) {
    // optional effect
  }
}
