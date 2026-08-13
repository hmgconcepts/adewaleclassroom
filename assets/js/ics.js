/* Free calendar export — .ics files for Google / Outlook / Apple. No Calendar API. */
const ICS = {
  pad(n) { return String(n).padStart(2, '0'); },
  stamp(d) {
    const x = d instanceof Date ? d : new Date(d);
    if (isNaN(x)) return '';
    return x.getUTCFullYear() + this.pad(x.getUTCMonth() + 1) + this.pad(x.getUTCDate()) + 'T' +
      this.pad(x.getUTCHours()) + this.pad(x.getUTCMinutes()) + this.pad(x.getUTCSeconds()) + 'Z';
  },
  esc(s) {
    return String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  },
  event({ uid, title, start, end, loc, desc }) {
    return [
      'BEGIN:VEVENT',
      'UID:' + (uid || ('tc-' + Date.now() + '@tutoringconnect')),
      'DTSTAMP:' + this.stamp(new Date()),
      'DTSTART:' + this.stamp(start),
      'DTEND:' + this.stamp(end || new Date(new Date(start).getTime() + 3600000)),
      'SUMMARY:' + this.esc(title || 'Tutoring class'),
      loc ? ('LOCATION:' + this.esc(loc)) : '',
      desc ? ('DESCRIPTION:' + this.esc(desc)) : '',
      'END:VEVENT'
    ].filter(Boolean).join('\r\n');
  },
  calendar(events, name) {
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//HMG Technologies//Tutoring Connect//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:' + this.esc(name || ((window.PRACTICE && PRACTICE.name) || 'ADEWALE CLASSROOM')),
      ...(events || []).map(e => this.event(e)),
      'END:VCALENDAR'
    ].join('\r\n');
  },
  download(icsText, filename) {
    const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename || 'tutoring-connect.ics';
    a.click();
  },
  async fromBookingClasses(rows, name) {
    const ev = (rows || []).map(c => ({
      uid: 'class-' + c.id + '@tutoringconnect',
      title: (c.title || 'Class') + ' · cycle ' + (c.cycle_no || '') + ' · #' + (c.seq_in_cycle || ''),
      start: c.scheduled_at,
      end: new Date(new Date(c.scheduled_at).getTime() + (Number(c.duration_minutes || 60) * 60000)),
      loc: c.meeting_url || c.location || 'Online',
      desc: (c.tutor_feedback || '') + ' · ' + (c.status || 'scheduled')
    }));
    return this.calendar(ev, name);
  }
};
window.ICS = ICS;
