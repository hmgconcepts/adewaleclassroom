/* 4-cycle booking + hourly quote. A full booking = 4 cycles × 7 days. */
const Bookings = {
  quote({ timesPerCycle, cycleCount, durationMin, hourlyRate }) {
    const times = Math.max(1, Number(timesPerCycle) || 1);
    const cycles = Number(cycleCount) || 4;
    const minutes = Number(durationMin) || 60;
    const rate = Number(hourlyRate) || 0;
    const classes = times * cycles;
    const hours = Math.round((classes * minutes / 60) * 100) / 100;
    const amount = Math.round(hours * rate * 100) / 100;
    return { times, cycles, minutes, rate, classes, hours, amount };
  },
  explain(q, currency) {
    const c = currency || (window.PRACTICE && window.PRACTICE.currency) || '₦';
    const days = (Number(q.cycles) || 4) * 7;
    return [
      `A full booking is ${q.cycles} cycle(s) (${days} days).`,
      `Each cycle is 7 days.`,
      `This family booked ${q.times} class(es) in every cycle.`,
      `Total classes = ${q.times} × ${q.cycles} = ${q.classes}.`,
      `Each class lasts ${q.minutes} minutes (${(q.minutes/60).toFixed(2)} hour).`,
      `Hours = ${q.classes} × ${(q.minutes/60).toFixed(2)} = ${q.hours}.`,
      `Rate = ${c}${q.rate} / hour.`,
      `Amount due = ${q.hours} × ${c}${q.rate} = ${c}${q.amount}.`
    ];
  },
  renderBreakdown(el, q, currency) {
    if (!el) return;
    const c = currency || '₦';
    const lines = this.explain(q, c);
    el.innerHTML = `<div class="grid grid-4">
      <div class="stat-card"><div class="stat-value">${q.classes}</div><div class="stat-label">Classes</div></div>
      <div class="stat-card"><div class="stat-value">${q.hours}</div><div class="stat-label">Hours</div></div>
      <div class="stat-card"><div class="stat-value">${c}${q.rate}</div><div class="stat-label">Per hour</div></div>
      <div class="stat-card"><div class="stat-value">${c}${q.amount}</div><div class="stat-label">Amount due</div></div>
    </div>
    <ol style="margin-top:12px;padding-left:20px">${lines.map(l => `<li>${l}</li>`).join('')}</ol>`;
  }
};
window.Bookings = Bookings;
