export async function fireConfetti() {
  try {
    const confetti = (await import("canvas-confetti")).default;
    const count = 120;
    const defaults = { origin: { y: 0.65 }, zIndex: 9999 };
    confetti({ ...defaults, particleCount: count, spread: 70, startVelocity: 42, colors: ["#5B2D8E", "#4A90D9", "#6C3FC5", "#22c55e", "#ffffff"] });
    setTimeout(() => {
      confetti({ ...defaults, particleCount: count * 0.6, spread: 100, scalar: 0.85 });
    }, 180);
  } catch (_e) {
    // optional effect
  }
}
