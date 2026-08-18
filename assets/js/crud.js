/* Generic list + form engine. Each module declares a table and columns. */
const CRUD = {
  sb: null,
  init(client) { this.sb = client || window.sb || null; },
  WRITE: {
    engagements: ['tutor'], learners: ['tutor'], groups: ['tutor'], parents: [], tutors: [],
    subjects: ['tutor'], inquiries: ['tutor'], waitlist: ['tutor'], trials: ['tutor'],
    sessions: ['tutor'], attendance: ['tutor'], session_notes: ['tutor'], assignments: ['tutor'],
    goals: ['tutor'], mastery: ['tutor'], curriculum: ['tutor'], diagnostics: ['tutor'],
    packages: [], invoices: [], payments: [], inbox: ['tutor','parent','student'],
    messages: ['tutor','parent','student'], complaints: ['tutor','parent','student'],
    polls: ['parent','student'], bookings: ['parent'], homework: ['student'],
    flashcards: ['student','tutor'], surveys: ['parent','student']
  },
  SCHEMA: {
    engagements: { table: 'engagements', title: 'Engagement', cols: [
      { key: 'name', label: 'Name', type: 'text', required: true, help: 'e.g. Ama — IGCSE Maths 1:1, or SAT Weekend Group' },
      { key: 'kind', label: 'Kind', type: 'select', options: ['one_on_one','group'], required: true },
      { key: 'subject', label: 'Subject', type: 'ref', refTable: 'subjects', refValue: 'name' },
      { key: 'exam_board', label: 'Exam board / target', type: 'text', help: 'WAEC, IGCSE, SAT, none…' },
      { key: 'methodology_id', label: 'Methodology', type: 'ref', refTable: 'methodologies', refValue: 'name', refStore: 'id' },
      { key: 'tutor_id', label: 'Tutor', type: 'ref', refTable: 'tutors', refValue: 'full_name', refStore: 'id' },
      { key: 'timezone', label: 'Engagement timezone', type: 'text', help: 'Africa/Lagos, Europe/London, America/New_York' },
      { key: 'currency', label: 'Currency', type: 'text' },
      { key: 'hourly_rate', label: 'Hourly rate', type: 'number' },
      { key: 'hours_prepaid', label: 'Hours in bank', type: 'number' },
      { key: 'hours_used', label: 'Hours used', type: 'number' },
      { key: 'baseline_score', label: 'Diagnostic baseline %', type: 'number' },
      { key: 'target_score', label: 'Target %', type: 'number' },
      { key: 'target_exam_on', label: 'Target exam date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['inquiry','trial','active','paused','completed','churned'] }
    ]},
    learners: { table: 'learners', title: 'Learner', cols: [
      { key: 'full_name', label: 'Full name', type: 'text', required: true },
      { key: 'preferred_name', label: 'Preferred name', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'timezone', label: 'Timezone', type: 'text' },
      { key: 'year_group', label: 'Year / grade', type: 'text' },
      { key: 'school_name', label: 'Day school (optional)', type: 'text' },
      { key: 'learning_style', label: 'Observed learning notes', type: 'textarea' },
      { key: 'accommodations', label: 'Accommodations', type: 'textarea' },
      { key: 'photo_url', label: 'Photo (Drive link)', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['active','paused','alumni'] }
    ]},
    groups: { table: 'engagements', title: 'Group', defaultFilters: { kind: 'group' }, cols: [
      { key: 'name', label: 'Group name', type: 'text', required: true },
      { key: 'kind', label: 'Kind', type: 'select', options: ['group'] },
      { key: 'subject', label: 'Subject', type: 'lookup', lookupTable: 'subjects', lookupValue: 'name', help: 'Pick a subject you teach.' },
      { key: 'capacity', label: 'Capacity', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['active','paused','completed'] }
    ]},
    parents: { table: 'parents', title: 'Parent', cols: [
      { key: 'full_name', label: 'Full name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone / WhatsApp', type: 'tel' },
      { key: 'timezone', label: 'Timezone', type: 'text' },
      { key: 'billing_name', label: 'Billing name', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['active','inactive'] }
    ]},
    parent_links: { table: 'parent_learner', title: 'Parent–learner link', cols: [
      { key: 'parent_id', label: 'Parent', type: 'ref', refTable: 'parents', refValue: 'full_name', refStore: 'id', required: true },
      { key: 'learner_id', label: 'Learner', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id', required: true },
      { key: 'relationship', label: 'Relationship', type: 'select', options: ['mother','father','guardian','other'] }
    ]},
    engagement_members: { table: 'engagement_members', title: 'Roster seat', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id', required: true },
      { key: 'learner_id', label: 'Learner', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id', required: true },
      { key: 'status', label: 'Status', type: 'select', options: ['active','left'] }
    ]},
    tutors: { table: 'tutors', title: 'Tutor', cols: [
      { key: 'full_name', label: 'Full name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'timezone', label: 'Timezone', type: 'text' },
      { key: 'specialisms', label: 'Specialisms', type: 'text' },
      { key: 'hourly_cost', label: 'Pay rate (if staff)', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['active','inactive'] }
    ]},
    subjects: { table: 'subjects', title: 'Subject', cols: [
      { key: 'name', label: 'Subject', type: 'text', required: true },
      { key: 'exam_board', label: 'Default board', type: 'text' },
      { key: 'level', label: 'Level', type: 'text' }
    ]},
    inquiries: { table: 'inquiries', title: 'Inquiry', cols: [
      { key: 'parent_name', label: 'Parent name', type: 'lookup', lookupTable: 'parents', lookupValue: 'full_name', required: true, help: 'Pick from your parents list.' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'learner_name', label: 'Learner name', type: 'lookup', lookupTable: 'learners', lookupValue: 'full_name', help: 'Pick an existing learner, or add a new name if they are not enrolled yet.' },
      { key: 'subject', label: 'Subject wanted', type: 'lookup', lookupTable: 'subjects', lookupValue: 'name', help: 'Pick a subject you teach.' },
      { key: 'kind', label: '1:1 or group', type: 'select', options: ['one_on_one','group','unsure'] },
      { key: 'timezone', label: 'Timezone', type: 'text' },
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['new','contacted','trial_booked','converted','lost'] }
    ]},
    waitlist: { table: 'waitlist', title: 'Waitlist row', cols: [
      { key: 'learner_name', label: 'Learner', type: 'lookup', lookupTable: 'learners', lookupValue: 'full_name', required: true, help: 'Pick from your learners — no typing needed.' },
      { key: 'subject', label: 'Subject', type: 'lookup', lookupTable: 'subjects', lookupValue: 'name', help: 'Pick a subject you teach.' },
      { key: 'kind', label: 'Kind', type: 'select', options: ['one_on_one','group'] },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['waiting','offered','placed','withdrawn'] }
    ]},
    trials: { table: 'trials', title: 'Trial', cols: [
      { key: 'engagement_id', label: 'Resulting engagement (optional)', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id' },
      { key: 'learner_name', label: 'Learner', type: 'lookup', lookupTable: 'learners', lookupValue: 'full_name', required: true, help: 'Pick from your learners — no typing needed.' },
      { key: 'scheduled_at', label: 'When', type: 'datetime-local' },
      { key: 'baseline_score', label: 'Baseline %', type: 'number' },
      { key: 'fit_notes', label: 'Fit notes', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['booked','done','no_show','converted'] }
    ]},
    sessions: { table: 'sessions', title: 'Session', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id', required: true },
      { key: 'starts_at', label: 'Starts (local ISO)', type: 'datetime-local', required: true },
      { key: 'ends_at', label: 'Ends', type: 'datetime-local' },
      { key: 'mode', label: 'Mode', type: 'select', options: ['online','in_person','hybrid'] },
      { key: 'meeting_url', label: 'Meeting URL (Jitsi/Meet/Zoom)', type: 'text' },
      { key: 'whiteboard_url', label: 'Whiteboard URL', type: 'text' },
      { key: 'hours', label: 'Hours to deduct', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['scheduled','done','cancelled','no_show'] }
    ]},
    attendance: { table: 'session_attendance', title: 'Attendance', cols: [
      { key: 'session_id', label: 'Session', type: 'ref', refTable: 'sessions', refValue: 'starts_at', refStore: 'id', required: true },
      { key: 'learner_id', label: 'Learner', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id', required: true },
      /* V16 — competitor benchmark (docs/COMPETITOR-BENCHMARK.md) found that
         every serious platform separates a NO-SHOW from an ABSENCE, because
         the two are different commercially, not just descriptively:
           absent   — the family told you, in time; the slot can be refilled
           excused  — agreed in advance; not charged, credit issued
           no-show  — nobody came and nobody said; the tutor's hour is gone,
                      so it IS charged and it does NOT earn a make-up credit
           cancelled-late — cancelled inside the notice window; part-charged
         "No-show rate" is the single metric the industry uses to prove that
         reminders are working. It could not be measured here before, because
         a no-show was recorded as a plain absence. */
      { key: 'status', label: 'Status', type: 'select',
        options: ['present','late','absent','excused','no-show','cancelled-late'],
        help: 'No-show = nobody came and nobody warned you. It is chargeable and earns no make-up credit. Absent = they told you in time.' },
      { key: 'minutes', label: 'Minutes present', type: 'number' },
      { key: 'chargeable', label: 'Charge for this session', type: 'checkbox',
        help: 'Ticked by default for present, late and no-show. Untick for an excused absence.' },
      { key: 'notified_at', label: 'Family notified at', type: 'datetime-local',
        help: 'When the family told you they would miss. Blank on a no-show — that is what makes it a no-show.' }
    ]},
    session_notes: { table: 'session_notes', title: 'Session note', cols: [
      { key: 'session_id', label: 'Session', type: 'ref', refTable: 'sessions', refValue: 'starts_at', refStore: 'id', required: true },
      { key: 'learner_id', label: 'Learner (blank = whole group)', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id' },
      { key: 'body', label: 'Notes', type: 'textarea', required: true },
      { key: 'recording_url', label: 'Recording (Drive)', type: 'text' },
      { key: 'share_with_parent', label: 'Share with parent', type: 'checkbox' }
    ]},
    goals: { table: 'goals', title: 'Goal', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id', required: true },
      { key: 'learner_id', label: 'Learner (optional)', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id' },
      { key: 'title', label: 'Goal', type: 'text', required: true },
      { key: 'metric', label: 'How we will know', type: 'text' },
      { key: 'review_on', label: 'Review date', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['open','on_track','at_risk','met','dropped'] }
    ]},
    mastery: { table: 'mastery_topics', title: 'Mastery topic', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id', required: true },
      { key: 'learner_id', label: 'Learner', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id', required: true },
      { key: 'topic', label: 'Topic', type: 'text', required: true },
      { key: 'score', label: 'Mastery 0–100', type: 'number' },
      { key: 'last_assessed', label: 'Last assessed', type: 'date' }
    ]},
    methodologies: { table: 'methodologies', title: 'Methodology', cols: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'summary', label: 'When to use it', type: 'textarea' },
      { key: 'steps', label: 'Steps', type: 'textarea' }
    ]},
    curriculum: { table: 'curriculum_items', title: 'Curriculum item', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id', required: true },
      { key: 'week_no', label: 'Week #', type: 'number' },
      { key: 'topic', label: 'Topic', type: 'text', required: true },
      { key: 'covered', label: 'Covered', type: 'checkbox' }
    ]},
    assignments: { table: 'assignments', title: 'Homework', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id', required: true },
      { key: 'learner_id', label: 'Learner (blank = whole group)', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id' },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'due_on', label: 'Due', type: 'date' },
      { key: 'max_score', label: 'Max score', type: 'number' },
      { key: 'score', label: 'Score', type: 'number' },
      { key: 'submission_url', label: 'Submission (Drive)', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['set','submitted','marked','late','missing'] }
    ]},
    assessments: { table: 'assessments', title: 'Assessment', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id' },
      { key: 'learner_id', label: 'Learner', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id', required: true },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'kind', label: 'Kind', type: 'select', options: ['diagnostic','quiz','mock','exam','homework'] },
      { key: 'score', label: 'Score %', type: 'number' },
      { key: 'taken_on', label: 'Date', type: 'date' }
    ]},
    packages: { table: 'packages', title: 'Package / hour bank', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id', required: true },
      { key: 'name', label: 'Package name', type: 'text', required: true },
      { key: 'hours', label: 'Hours', type: 'number' },
      { key: 'price', label: 'Price', type: 'number' },
      { key: 'purchased_on', label: 'Purchased', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['active','exhausted','expired'] }
    ]},
    invoices: { table: 'invoices', title: 'Invoice', cols: [
      { key: 'parent_id', label: 'Bill to parent', type: 'ref', refTable: 'parents', refValue: 'full_name', refStore: 'id' },
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id' },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'currency', label: 'Currency', type: 'text' },
      { key: 'due_on', label: 'Due', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft','sent','paid','overdue','void'] }
    ]},
    /* BUG FIX 14 (reported): "on the class stream page one should be able
       to edit, delete etc. a pre-existing class stream. Ensure whatever we
       create on the platform can be edited or selected after creation."
       stream_posts had no CRUD schema at all, so stream.html could only
       ever append. Registering it here gives the page the full workbench:
       edit, delete, duplicate, filter, sort, page, export and print. */
    stream: { table: 'stream_posts', title: 'Class stream post', orderBy: 'publish_at',
      empty: 'No stream posts yet. Post an announcement, a resource link or a reminder to the class.',
      cols: [
        { key: 'engagement_id', label: 'Class / engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id', help: 'Pick the class this post belongs to.' },
        { key: 'kind', label: 'Kind', type: 'select', options: ['announcement','resource','reminder','homework','celebration','question'] },
        { key: 'title', label: 'Title', type: 'text', required: true },
        { key: 'body', label: 'Message', type: 'textarea' },
        { key: 'media_url', label: 'Link (Drive / YouTube / https)', help: 'Links only — this studio never accepts uploads.' },
        { key: 'publish_at', label: 'Publish at', type: 'datetime-local', help: 'Leave as now to publish immediately, or set a future time.' },
        { key: 'created_at', label: 'Created', type: 'datetime-local' }
      ]},
    payments: { table: 'payments', title: 'Payment', cols: [
      { key: 'invoice_id', label: 'Invoice', type: 'ref', refTable: 'invoices', refValue: 'amount', refStore: 'id' },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'method', label: 'Method', type: 'select', options: ['bank','cash','paystack','flutterwave','stripe','other'] },
      { key: 'reference', label: 'Reference', type: 'text' },
      { key: 'paid_on', label: 'Paid on', type: 'date' }
    ]},
      /* BUG FIX 13 — a receipt is most wanted from the row the tutor has
         just created, not from a separate panel further down the page. */
      rowActions: [{ id: 'receipt', label: '🧾 Receipt', cls: 'btn-outline',
                     title: 'Print a branded e-receipt for this payment' }],
      onRowAction: function (action, r) {
        if (action !== 'receipt' || !r) return;
        if (!window.Receipts) {
          if (window.toast) toast('Receipt engine not loaded on this page.', 'danger');
          return;
        }
        Receipts.print(r, { description: 'Tutoring fees', paidToDate: r.amount });
      },
    announcements: { table: 'announcements', title: 'Announcement', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'textarea' },
      { key: 'audience', label: 'Audience', type: 'select', options: ['all','parents','learners','tutors'] },
      { key: 'pinned', label: 'Pinned', type: 'checkbox' }
    ]},
    inbox: { table: 'messages', title: 'Message', cols: [
      { key: 'to_role', label: 'To role', type: 'select', options: ['admin','tutor','parent','student'] },
      { key: 'subject', label: 'Subject', type: 'lookup', lookupTable: 'subjects', lookupValue: 'name', required: true, help: 'Pick a subject you teach.' },
      { key: 'body', label: 'Body', type: 'textarea' }
    ]},
    complaints: { table: 'complaints', title: 'Complaint', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'body', label: 'Details', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['open','investigating','resolved'] }
    ]},
    polls: { table: 'polls', title: 'Poll', cols: [
      { key: 'title', label: 'Question', type: 'text', required: true },
      { key: 'options', label: 'Options (one per line)', type: 'textarea' },
      { key: 'anonymous', label: 'Anonymous', type: 'checkbox' },
      { key: 'status', label: 'Status', type: 'select', options: ['open','closed'] }
    ]},
    resources: { table: 'resources', title: 'Resource', cols: [
      { key: 'engagement_id', label: 'Engagement (blank = shared)', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id' },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'url', label: 'URL (Drive/YouTube)', type: 'text' },
      { key: 'kind', label: 'Kind', type: 'select', options: ['video','pdf','worksheet','link'] }
    ]},
    flashcards: { table: 'flashcards', title: 'Card', cols: [
      { key: 'learner_id', label: 'Learner', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id', required: true },
      { key: 'front', label: 'Front', type: 'textarea', required: true },
      { key: 'back', label: 'Back', type: 'textarea', required: true },
      { key: 'ease', label: 'Ease', type: 'number' },
      { key: 'interval_days', label: 'Interval days', type: 'number' },
      { key: 'due_on', label: 'Due', type: 'date' }
    ]},
    exam_targets: { table: 'exam_targets', title: 'Exam target', cols: [
      { key: 'learner_id', label: 'Learner', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id', required: true },
      { key: 'exam_name', label: 'Exam', type: 'lookup', lookupTable: 'cbt_exams', lookupValue: 'title', required: true, help: 'Pick an exam you have already built.' },
      { key: 'board', label: 'Board', type: 'text' },
      { key: 'exam_on', label: 'Date', type: 'date' },
      { key: 'target_grade', label: 'Target grade', type: 'text' }
    ]},
    documents: { table: 'documents', title: 'Document', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'kind', label: 'Kind', type: 'select', options: ['contract','consent','policy','safeguarding','other'] },
      { key: 'url', label: 'Drive link', type: 'text' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft','sent','signed'] }
    ]},
    events: { table: 'events', title: 'Workshop / event', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'starts_at', label: 'Starts', type: 'datetime-local' },
      { key: 'venue', label: 'Venue / meeting URL', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' }
    ]},
    gallery: { table: 'gallery', title: 'Gallery item', cols: [
      { key: 'title', label: 'Caption', type: 'text', required: true },
      { key: 'url', label: 'Image / YouTube / Drive link', type: 'text', required: true },
      { key: 'kind', label: 'Kind', type: 'select', options: ['image','video','youtube','drive'] }
    ]},
    helpdesk: { table: 'helpdesk_tickets', title: 'Ticket', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'body', label: 'Details', type: 'textarea' },
      { key: 'priority', label: 'Priority', type: 'select', options: ['low','normal','high','urgent'] },
      { key: 'status', label: 'Status', type: 'select', options: ['open','in_progress','resolved','closed'] }
    ]},
    reviews: { table: 'reviews', title: 'Review', cols: [
      { key: 'author', label: 'Author', type: 'text', required: true },
      { key: 'body', label: 'Testimonial', type: 'textarea' },
      { key: 'rating', label: 'Rating 1–5', type: 'number' },
      { key: 'published', label: 'Publish on public site', type: 'checkbox' }
    ]},
    referrals: { table: 'referrals', title: 'Referral', cols: [
      { key: 'referrer', label: 'Referrer', type: 'text', required: true },
      { key: 'referred', label: 'Referred family', type: 'text' },
      { key: 'credit', label: 'Credit amount', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['open','credited','expired'] }
    ]},
    surveys: { table: 'surveys', title: 'Survey', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'audience', label: 'Audience', type: 'select', options: ['all','parents','learners','tutors'] },
      { key: 'questions', label: 'Questions (one per line)', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['open','closed'] }
    ]},
    library: { table: 'library_items', title: 'Library item', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'author', label: 'Author / source', type: 'text' },
      { key: 'url', label: 'Drive / web link', type: 'text', required: true },
      { key: 'subject', label: 'Subject', type: 'lookup', lookupTable: 'subjects', lookupValue: 'name', help: 'Pick a subject you teach.' },
      { key: 'kind', label: 'Kind', type: 'select', options: ['book','paper','video','worksheet','other'] }
    ]},
    eresources: { table: 'eresources', title: 'E-resource', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'subject', label: 'Subject', type: 'lookup', lookupTable: 'subjects', lookupValue: 'name', help: 'Pick a subject you teach.' },
      { key: 'url', label: 'Link', type: 'text', required: true },
      { key: 'notes', label: 'Notes', type: 'textarea' }
    ]},
    lms: { table: 'lms_lessons', title: 'LMS lesson', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id' },
      { key: 'title', label: 'Lesson title', type: 'text', required: true },
      { key: 'url', label: 'Material link', type: 'text' },
      { key: 'order_no', label: 'Order', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft','published'] }
    ]},
    leave: { table: 'leave_requests', title: 'Leave request', cols: [
      { key: 'tutor_name', label: 'Tutor', type: 'lookup', lookupTable: 'tutors', lookupValue: 'full_name', required: true, help: 'Pick from your tutors.' },
      { key: 'kind', label: 'Kind', type: 'select', options: ['sick','casual','earned','study','other'] },
      { key: 'starts_on', label: 'From', type: 'date' },
      { key: 'ends_on', label: 'To', type: 'date' },
      { key: 'reason', label: 'Reason', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['pending','approved','rejected'] }
    ]},
    payroll: { table: 'payroll', title: 'Payroll row', cols: [
      { key: 'tutor_name', label: 'Tutor', type: 'lookup', lookupTable: 'tutors', lookupValue: 'full_name', required: true, help: 'Pick from your tutors.' },
      { key: 'period', label: 'Period', type: 'text' },
      { key: 'hours', label: 'Hours', type: 'number' },
      { key: 'rate', label: 'Rate', type: 'number' },
      { key: 'gross', label: 'Gross', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['draft','approved','paid'] }
    ]},
    finance: { table: 'finance_entries', title: 'Finance entry', cols: [
      { key: 'kind', label: 'Kind', type: 'select', options: ['income','expense'], required: true },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'memo', label: 'Memo', type: 'text' },
      { key: 'entry_on', label: 'Date', type: 'date' }
    ]},
    notifications: { table: 'notifications', title: 'Notification', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'textarea' },
      { key: 'audience', label: 'Audience', type: 'select', options: ['all','tutors','parents','learners'] },
      { key: 'url', label: 'Open URL', type: 'text' },
      { key: 'priority', label: 'Priority', type: 'select', options: ['normal','high','urgent'] }
    ]},
    messages: { table: 'messages', title: 'Message', cols: [
      { key: 'to_role', label: 'To role', type: 'select', options: ['admin','tutor','parent','student'] },
      { key: 'subject', label: 'Subject', type: 'lookup', lookupTable: 'subjects', lookupValue: 'name', required: true, help: 'Pick a subject you teach.' },
      { key: 'body', label: 'Body', type: 'textarea' }
    ]},
    announcements: { table: 'announcements', title: 'Announcement', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'textarea' },
      { key: 'audience', label: 'Audience', type: 'select', options: ['all','parents','learners','tutors'] },
      { key: 'pinned', label: 'Pinned', type: 'checkbox' }
    ]},
    certificates: { table: 'certificates', title: 'Certificate', cols: [
      { key: 'learner_name', label: 'Learner', type: 'lookup', lookupTable: 'learners', lookupValue: 'full_name', required: true, help: 'Pick from your learners — no typing needed.' },
      { key: 'title', label: 'Award', type: 'text', required: true },
      { key: 'code', label: 'Verification code', type: 'text' },
      { key: 'issued_on', label: 'Issued', type: 'date' }
    ]},
    fees: { table: 'fee_catalogue', title: 'Fee item', cols: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'kind', label: 'Kind', type: 'select', options: ['one_on_one','group','trial','material','other'] },
      { key: 'amount', label: 'Amount', type: 'number' },
      { key: 'currency', label: 'Currency', type: 'text' }
    ]},
    scholarships: { table: 'scholarships', title: 'Scholarship / discount', cols: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'percent', label: 'Percent', type: 'number' },
      { key: 'notes', label: 'Notes', type: 'textarea' }
    ]},
    products: { table: 'products', title: 'Book / material', cols: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'price', label: 'Price', type: 'number' },
      { key: 'url', label: 'Product / Drive link', type: 'text' }
    ]},
    rooms: { table: 'rooms', title: 'Room / location', cols: [
      { key: 'name', label: 'Name', type: 'text', required: true },
      { key: 'kind', label: 'Kind', type: 'select', options: ['in_person','virtual'] },
      { key: 'url', label: 'Standing meeting URL', type: 'text' },
      { key: 'capacity', label: 'Capacity', type: 'number' }
    ]},
    substitutions: { table: 'substitutions', title: 'Cover tutor', cols: [
      { key: 'session_id', label: 'Session', type: 'ref', refTable: 'sessions', refValue: 'starts_at', refStore: 'id' },
      { key: 'cover_tutor', label: 'Cover tutor', type: 'lookup', lookupTable: 'tutors', lookupValue: 'full_name', required: true, help: 'Pick the tutor covering the class.' },
      { key: 'reason', label: 'Reason', type: 'text' }
    ]},
    policies: { table: 'policies', title: 'Policy', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'textarea' },
      { key: 'audience', label: 'Audience', type: 'select', options: ['all','parents','tutors'] }
    ]},
    accommodations: { table: 'accommodations', title: 'Accommodation', cols: [
      { key: 'learner_id', label: 'Learner', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id', required: true },
      { key: 'kind', label: 'Kind', type: 'text', required: true },
      { key: 'notes', label: 'Notes', type: 'textarea' }
    ]},
    lesson_plans: { table: 'lesson_plans', title: 'Lesson plan', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id' },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'objectives', label: 'Objectives', type: 'textarea' },
      { key: 'resources', label: 'Resource links', type: 'textarea' }
    ]},
    availability: { table: 'availability', title: 'Availability slot', cols: [
      { key: 'tutor_id', label: 'Tutor', type: 'ref', refTable: 'tutors', refValue: 'full_name', refStore: 'id' },
      { key: 'weekday', label: 'Weekday 0=Sun', type: 'number' },
      { key: 'start_time', label: 'Start', type: 'text' },
      { key: 'end_time', label: 'End', type: 'text' },
      { key: 'timezone', label: 'Timezone', type: 'text' }
    ]},
    meetings: { table: 'sessions', title: 'Meeting link', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id' },
      { key: 'starts_at', label: 'Starts', type: 'datetime-local' },
      { key: 'meeting_url', label: 'Jitsi / Meet / Zoom URL', type: 'text', required: true },
      { key: 'mode', label: 'Mode', type: 'select', options: ['online','hybrid'] }
    ]},
    whiteboard: { table: 'sessions', title: 'Whiteboard', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id' },
      { key: 'whiteboard_url', label: 'Excalidraw / Jamboard / FigJam URL', type: 'text', required: true },
      { key: 'starts_at', label: 'Session start', type: 'datetime-local' }
    ]},
    makeups: { table: 'sessions', title: 'Make-up session', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id', required: true },
      { key: 'starts_at', label: 'Starts', type: 'datetime-local', required: true },
      { key: 'hours', label: 'Hours', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['scheduled','done'] }
    ]},
    cancellations: { table: 'sessions', title: 'Cancellation', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id' },
      { key: 'starts_at', label: 'Was scheduled', type: 'datetime-local' },
      { key: 'status', label: 'Status', type: 'select', options: ['cancelled'] },
      { key: 'hours', label: 'Hours to restore (0 if charged)', type: 'number' }
    ]},
    onboarding: { table: 'onboarding_items', title: 'Onboarding step', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id' },
      { key: 'title', label: 'Step', type: 'text', required: true },
      { key: 'done', label: 'Done', type: 'checkbox' }
    ]},
    diagnostics: { table: 'assessments', title: 'Diagnostic', defaultFilters: { kind: 'diagnostic' }, cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id' },
      { key: 'learner_id', label: 'Learner', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id', required: true },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'kind', label: 'Kind', type: 'select', options: ['diagnostic'] },
      { key: 'score', label: 'Baseline %', type: 'number' },
      { key: 'taken_on', label: 'Date', type: 'date' }
    ]},
    calendar: { table: 'sessions', title: 'Calendar item', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id', required: true },
      { key: 'starts_at', label: 'Starts', type: 'datetime-local', required: true },
      { key: 'ends_at', label: 'Ends', type: 'datetime-local' },
      { key: 'mode', label: 'Mode', type: 'select', options: ['online','in_person','hybrid'] },
      { key: 'status', label: 'Status', type: 'select', options: ['scheduled','done','cancelled'] }
    ]},
    birthdays: { table: 'learners', title: 'Birthday', cols: [
      { key: 'full_name', label: 'Name', type: 'text' },
      { key: 'date_of_birth', label: 'Date of birth', type: 'date' }
    ]},
    directory: { table: 'learners', title: 'Directory row', cols: [
      { key: 'full_name', label: 'Name', type: 'text' },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'year_group', label: 'Year', type: 'text' }
    ]},
    idcards: { table: 'learners', title: 'Learner card', cols: [
      { key: 'full_name', label: 'Name', type: 'text' },
      { key: 'student_no', label: 'Student ID', type: 'lookup', lookupTable: 'learners', lookupValue: 'student_no', help: 'Pick an existing learner ID.' },
      { key: 'photo_url', label: 'Photo (Drive)', type: 'text' }
    ]},
    portfolio: { table: 'resources', title: 'Portfolio item', cols: [
      { key: 'engagement_id', label: 'Engagement', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id' },
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'url', label: 'Drive link', type: 'text' },
      { key: 'kind', label: 'Kind', type: 'select', options: ['work','recording','script','other'] }
    ]},
    rubrics: { table: 'rubrics', title: 'Rubric', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'criteria', label: 'Criteria (one per line)', type: 'textarea' },
      { key: 'scale', label: 'Scale', type: 'text' }
    ]},
    transcripts: { table: 'scoresheet', title: 'Transcript row', cols: [
      { key: 'learner_id', label: 'Learner', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id' },
      { key: 'title', label: 'Item', type: 'text' },
      { key: 'subject', label: 'Subject', type: 'lookup', lookupTable: 'subjects', lookupValue: 'name', help: 'Pick a subject you teach.' },
      { key: 'pct', label: '%', type: 'number' },
      { key: 'taken_on', label: 'Date', type: 'date' }
    ]},
    compliance: { table: 'compliance_tasks', title: 'Compliance task', cols: [
      { key: 'title', label: 'Task', type: 'text', required: true },
      { key: 'due_on', label: 'Due', type: 'date' },
      { key: 'status', label: 'Status', type: 'select', options: ['open','done'] }
    ]},
    safeguarding: { table: 'safeguarding_log', title: 'Safeguarding note', cols: [
      { key: 'learner_id', label: 'Learner', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id' },
      { key: 'body', label: 'Confidential note', type: 'textarea', required: true }
    ]},
    gamification: { table: 'badges', title: 'Badge / streak', cols: [
      { key: 'learner_id', label: 'Learner', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id' },
      { key: 'title', label: 'Badge', type: 'text', required: true },
      { key: 'points', label: 'Points', type: 'number' }
    ]},
    parent_meetings: { table: 'parent_meetings', title: 'Parent conference', cols: [
      { key: 'parent_name', label: 'Parent', type: 'lookup', lookupTable: 'parents', lookupValue: 'full_name', required: true, help: 'Pick from your parents list.' },
      { key: 'learner_id', label: 'Learner', type: 'ref', refTable: 'learners', refValue: 'full_name', refStore: 'id' },
      { key: 'scheduled_at', label: 'When', type: 'datetime-local' },
      { key: 'notes', label: 'Notes', type: 'textarea' }
    ]},
    broadcasts: { table: 'announcements', title: 'Broadcast', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'textarea' },
      { key: 'audience', label: 'Audience', type: 'select', options: ['all','parents','learners'] }
    ]},
    flyer: { table: 'announcements', title: 'Flyer copy', cols: [
      { key: 'title', label: 'Headline', type: 'text', required: true },
      { key: 'body', label: 'Copy', type: 'textarea' }
    ]},
    learning_styles: { table: 'learners', title: 'Learning notes', cols: [
      { key: 'full_name', label: 'Learner', type: 'text' },
      { key: 'learning_style', label: 'Observed notes', type: 'textarea' }
    ]}
  },

  def(moduleId) {
    if (!moduleId) return null;
    const id = String(moduleId).replace(/-/g, '_');
    return this.SCHEMA[id] || this.SCHEMA[moduleId] || null;
  },

  canWrite(moduleId) {
    if (!window.App || App.isAdmin()) return true;
    const r = (window.App && (App.currentRole || App.role)) || '';
    if (window.App && App.canWriteModule) return App.canWriteModule(moduleId, r);
    const allow = this.WRITE[moduleId] || this.WRITE[String(moduleId).replace(/-/g, '_')];
    if (!allow) return false;
    return allow.includes(r) || allow.includes(App.role);
  },

  /* =====================================================================
     V16 — DATA WORKBENCH
     ---------------------------------------------------------------------
     Audit finding (item 29 / item 2, "extracted features substandard"):
     125 of the 130 pages in this studio were rendered by ONE function,
     renderList(), and that function shipped only:

        * the first SIX columns  (schema.cols.slice(0, 6))
        * a hard LIMIT 200 with no pagination
        * a client-side "search" that only searched those 200 rows
        * no sort, no filters, no totals, no bulk actions, no detail view
        * and a real BUG: a column of type 'ref' painted r[c.key] straight
          into the cell, which is a UUID. Every page that pointed at a
          learner, tutor, engagement or parent showed the operator
          "0f3c9a12-…" instead of "Tolu Adebayo".

     School Connect's equivalent pages are bespoke: 163 <table> blocks,
     1,750 buttons, 378 queries across 131 pages. Tutoring Connect had 10
     tables and 92 queries across 130 pages. The pages were not "extracted"
     features, they were renamed spreadsheets.

     Rather than hand-write 125 bespoke pages (which would rot immediately
     and is what School Connect suffers from), the fix is to make the ONE
     shared renderer enterprise-grade. Every capability below lands on all
     125 CRUD pages simultaneously, and each page can still opt into extra
     behaviour through its schema definition.

     Added here, all additive — nothing previously present was removed:
       1.  Reference resolution   — UUID -> human label, with a lookup cache
       2.  Every column visible   — plus a persisted column chooser
       3.  Click-to-sort headers  — asc / desc / none, on any column
       4.  Per-column filters     — free text, or a dropdown for enums/refs
       5.  Server-side pagination — page size 25/50/100/200/500, prev/next
       6.  KPI summary strip      — row count, sums + averages of numeric
                                    columns, breakdown of the status column
       7.  Bulk selection         — select page / select all, bulk delete,
                                    export just the selection
       8.  Record detail drawer   — every field, not just six, plus the
                                    resolved labels and a copy-link button
       9.  Duplicate a record     — opens the form pre-filled, id stripped
      10.  Print / PDF view       — clean printable table of what you filter
      11.  Saved views            — name a filter+sort+column set, reuse it
      12.  Density toggle         — comfortable / compact
      13.  Real empty states      — tells you what the table is for and what
                                    to do next instead of "No rows yet."

     Everything persists per-module in localStorage so an operator's setup
     survives a reload. Nothing here requires a schema change; pages that
     define nothing extra simply get all of it for free.
     ===================================================================== */

  _viewKey(moduleId) { return 'tc_view_' + moduleId; },

  _loadView(moduleId) {
    try { return JSON.parse(localStorage.getItem(this._viewKey(moduleId)) || '{}') || {}; }
    catch (e) { return {}; }
  },

  _saveView(moduleId, view) {
    try { localStorage.setItem(this._viewKey(moduleId), JSON.stringify(view)); } catch (e) {}
  },

  _savedViews(moduleId) {
    try { return JSON.parse(localStorage.getItem('tc_views_' + moduleId) || '[]') || []; }
    catch (e) { return []; }
  },

  _putSavedViews(moduleId, list) {
    try { localStorage.setItem('tc_views_' + moduleId, JSON.stringify(list)); } catch (e) {}
  },

  /* Resolve every 'ref' column on a schema into an id -> label dictionary.
     Cached for the life of the page so ten ref columns do not become ten
     round-trips on every repaint. This is the fix for the UUID bug. */
  async _refMaps(schema) {
    this._refCache = this._refCache || {};
    const maps = {};
    for (const c of schema.cols) {
      if (c.type !== 'ref' || !c.refTable) continue;
      const key = c.refTable + '|' + (c.refStore || c.refValue) + '|' + c.refValue;
      if (!this._refCache[key]) {
        const m = {};
        if (this.sb) {
          const { data } = await this.sb.from(c.refTable).select('*').limit(1000);
          (data || []).forEach(d => { m[String(d[c.refStore || c.refValue])] = d[c.refValue]; });
        } else {
          ((window.DEMO && window.DEMO[c.refTable]) || []).forEach(d => {
            m[String(d[c.refStore || c.refValue])] = d[c.refValue];
          });
        }
        this._refCache[key] = m;
      }
      maps[c.key] = this._refCache[key];
    }
    return maps;
  },

  /* Render one cell. Handles refs, booleans, dates, money, long text,
     and links (a URL becomes a real anchor — this studio is links-only,
     so nearly every media column is a Drive / YouTube / https URL). */
  _cell(row, col, maps) {
    const raw = row[col.key];
    if (raw === null || raw === undefined || raw === '') return '<span class="muted">—</span>';
    if (col.type === 'ref' && maps[col.key]) {
      const label = maps[col.key][String(raw)];
      return label
        ? TC.esc(label)
        : '<span class="muted" title="' + TC.esc(String(raw)) + '">unresolved link</span>';
    }
    if (col.type === 'checkbox' || typeof raw === 'boolean') {
      return raw
        ? '<span class="badge badge-success">Yes</span>'
        : '<span class="badge badge-muted">No</span>';
    }
    if (col.type === 'number') {
      const n = Number(raw);
      if (!Number.isFinite(n)) return TC.esc(String(raw));
      const money = /amount|fee|price|rate|total|paid|balance|salary|cost|income/i.test(col.key);
      return money ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                   : n.toLocaleString();
    }
    if (col.type === 'date' || col.type === 'datetime-local' || /_at$|^date|_date$/.test(col.key)) {
      const d = new Date(raw);
      if (!isNaN(d)) {
        return col.type === 'date' || /^date|_date$/.test(col.key)
          ? d.toLocaleDateString()
          : d.toLocaleString();
      }
    }
    const s = String(raw);
    if (/^https?:\/\//i.test(s)) {
      let host = s; try { host = new URL(s).hostname.replace(/^www\./, ''); } catch (e) {}
      return '<a href="' + TC.esc(s) + '" target="_blank" rel="noopener">' + TC.esc(host) + ' ↗</a>';
    }
    if (/^(status|state|stage|kind|type|priority|level)$/.test(col.key)) {
      const tone = /paid|active|approved|done|complete|present|pass|open|won/i.test(s) ? 'success'
                 : /pend|await|draft|hold|review|partial/i.test(s) ? 'warning'
                 : /fail|cancel|reject|absent|overdue|lost|void/i.test(s) ? 'danger' : 'muted';
      return '<span class="badge badge-' + tone + '">' + TC.esc(s) + '</span>';
    }
    if (s.length > 90) return '<span title="' + TC.esc(s) + '">' + TC.esc(s.slice(0, 88)) + '…</span>';
    return TC.esc(s);
  },

  /* The KPI strip. Counts rows, sums and averages every numeric column,
     and breaks down the first enum-ish column. This is what turns a table
     into a page an owner can actually read at a glance. */
  _kpis(schema, rows) {
    const cards = [];
    cards.push({ label: 'Records', value: rows.length.toLocaleString() });

    schema.cols.filter(c => c.type === 'number').slice(0, 3).forEach(c => {
      const nums = rows.map(r => Number(r[c.key])).filter(Number.isFinite);
      if (!nums.length) return;
      const sum = nums.reduce((a, b) => a + b, 0);
      cards.push({ label: 'Total ' + c.label.toLowerCase(), value: sum.toLocaleString(undefined, { maximumFractionDigits: 2 }) });
      cards.push({ label: 'Average ' + c.label.toLowerCase(), value: (sum / nums.length).toLocaleString(undefined, { maximumFractionDigits: 2 }) });
    });

    const enumCol = schema.cols.find(c => c.type === 'select' && (c.options || []).length)
                 || schema.cols.find(c => /^(status|state|stage|kind|type)$/.test(c.key));
    if (enumCol) {
      const tally = {};
      rows.forEach(r => { const v = r[enumCol.key] || '—'; tally[v] = (tally[v] || 0) + 1; });
      Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 4)
        .forEach(([k, v]) => cards.push({ label: enumCol.label + ': ' + k, value: String(v) }));
    }

    const dateCol = schema.cols.find(c => c.key === 'created_at')
                 || schema.cols.find(c => c.type === 'date' || c.type === 'datetime-local');
    if (dateCol) {
      const now = new Date(); const m = now.getMonth(); const y = now.getFullYear();
      const n = rows.filter(r => { const d = new Date(r[dateCol.key]); return !isNaN(d) && d.getMonth() === m && d.getFullYear() === y; }).length;
      cards.push({ label: 'Added this month', value: String(n) });
    }
    return cards.slice(0, 8);
  },

  async renderList(moduleId, mountId) {
    const schema = this.def(moduleId) || this.SCHEMA[moduleId];
    const mount = document.getElementById(mountId || 'crud-root');
    if (!schema || !mount) return;
    const can = this.canWrite(moduleId);
    const self = this;

    // --- persisted per-module view state -------------------------------
    const view = Object.assign(
      { hidden: [], sort: null, dir: 'desc', page: 0, size: 50, filters: {}, dense: false, q: '' },
      this._loadView(moduleId)
    );
    const persist = () => this._saveView(moduleId, view);
    const selected = new Set();

    const orderCol = schema.orderBy || (schema.cols.some(c => c.key === 'created_at') ? 'created_at' : 'id');
    const visible = () => schema.cols.filter(c => view.hidden.indexOf(c.key) === -1);

    mount.innerHTML = '<div class="muted" style="padding:24px">Loading ' + TC.esc(schema.title) + '…</div>';
    const maps = await this._refMaps(schema);

    let rows = [], total = 0;

    async function fetchRows() {
      if (!self.sb) {
        rows = (window.DEMO && window.DEMO[schema.table]) || [];
        total = rows.length;
        return;
      }
      let q = self.sb.from(schema.table).select('*', { count: 'exact' });
      if (schema.defaultFilters) {
        Object.entries(schema.defaultFilters).forEach(([k, v]) => { q = q.eq(k, v); });
      }
      // Column filters are pushed to the server so paging stays correct.
      Object.entries(view.filters).forEach(([k, v]) => {
        if (v === '' || v == null) return;
        const col = schema.cols.find(c => c.key === k);
        if (!col) return;
        if (col.type === 'select' || col.type === 'ref' || col.type === 'checkbox') q = q.eq(k, v);
        else if (col.type === 'number') { const n = Number(v); if (Number.isFinite(n)) q = q.eq(k, n); }
        else q = q.ilike(k, '%' + v + '%');
      });
      const sortKey = view.sort || orderCol;
      q = q.order(sortKey, { ascending: view.dir === 'asc' });
      const from = view.page * view.size;
      q = q.range(from, from + view.size - 1);
      const res = await q;
      if (res.error) {
        // A bad sort column (page saved a column that has since gone) must
        // not brick the page — fall back to the default order once.
        if (view.sort) { view.sort = null; persist(); return fetchRows(); }
        toast(res.error.message, 'danger');
        rows = []; total = 0; return;
      }
      rows = res.data || [];
      total = res.count == null ? rows.length : res.count;
    }

    function shell() {
      const cols = visible();
      const pages = Math.max(1, Math.ceil(total / view.size));
      const saved = self._savedViews(moduleId);
      const activeFilters = Object.values(view.filters).filter(v => v !== '' && v != null).length;

      mount.innerHTML =
        '<div id="crud-kpis" class="crud-kpis"></div>' +

        '<div class="crud-toolbar">' +
          '<input class="form-input" id="crud-q" placeholder="Search this page…" value="' + TC.esc(view.q) + '" style="max-width:260px">' +
          '<div class="crud-toolbar-actions">' +
            '<select class="form-select" id="crud-saved" style="max-width:170px" title="Saved views">' +
              '<option value="">Saved views…</option>' +
              saved.map((v, i) => '<option value="' + i + '">' + TC.esc(v.name) + '</option>').join('') +
            '</select>' +
            '<button class="btn btn-outline btn-sm" type="button" id="crud-saveview" title="Save the current filters, sort and columns">💾 Save view</button>' +
            '<button class="btn btn-outline btn-sm" type="button" id="crud-cols" title="Choose which columns to show">🧱 Columns</button>' +
            '<button class="btn btn-outline btn-sm" type="button" id="crud-dense" title="Row height">' + (view.dense ? '↕ Comfortable' : '↔ Compact') + '</button>' +
            '<button class="btn btn-outline btn-sm" type="button" id="crud-clear" title="Clear all filters">✕ Filters' + (activeFilters ? ' (' + activeFilters + ')' : '') + '</button>' +
            '<button class="btn btn-outline btn-sm" type="button" id="crud-print" title="Printable view">🖨 Print</button>' +
            '<button class="btn btn-outline btn-sm" type="button" id="crud-csv">⬇ CSV</button>' +
            (can ? '<button class="btn btn-primary" type="button" id="crud-add">+ Add ' + TC.esc(schema.title) + '</button>' : '') +
          '</div>' +
        '</div>' +

        '<div class="crud-bulk" id="crud-bulk" hidden>' +
          '<strong id="crud-bulk-n">0 selected</strong>' +
          '<button class="btn btn-sm btn-outline" type="button" id="crud-bulk-csv">⬇ Export selection</button>' +
          (can ? '<button class="btn btn-sm btn-danger" type="button" id="crud-bulk-del">🗑 Delete selection</button>' : '') +
          '<button class="btn btn-sm btn-ghost" type="button" id="crud-bulk-none">Clear</button>' +
        '</div>' +

        '<div class="table-wrap"><table class="crud-table' + (view.dense ? ' is-dense' : '') + '">' +
          '<thead>' +
            '<tr>' +
              '<th style="width:34px"><input type="checkbox" id="crud-all" title="Select every row on this page"></th>' +
              cols.map(c =>
                '<th data-sort="' + c.key + '" style="cursor:pointer" title="Sort by ' + TC.esc(c.label) + '">' +
                  TC.esc(c.label) +
                  (view.sort === c.key ? (view.dir === 'asc' ? ' ▲' : ' ▼') : '<span class="muted"> ⇅</span>') +
                '</th>').join('') +
              '<th style="width:150px">Actions</th>' +
            '</tr>' +
            '<tr class="crud-filter-row">' +
              '<th></th>' +
              cols.map(c => {
                const v = TC.esc(view.filters[c.key] == null ? '' : String(view.filters[c.key]));
                if (c.type === 'select' && (c.options || []).length) {
                  return '<th><select class="form-select form-select-sm" data-filter="' + c.key + '"><option value="">All</option>' +
                    c.options.map(o => '<option ' + (String(view.filters[c.key]) === String(o) ? 'selected' : '') + '>' + TC.esc(o) + '</option>').join('') +
                    '</select></th>';
                }
                if (c.type === 'checkbox') {
                  return '<th><select class="form-select form-select-sm" data-filter="' + c.key + '"><option value="">All</option>' +
                    '<option value="true" ' + (String(view.filters[c.key]) === 'true' ? 'selected' : '') + '>Yes</option>' +
                    '<option value="false" ' + (String(view.filters[c.key]) === 'false' ? 'selected' : '') + '>No</option></select></th>';
                }
                if (c.type === 'ref' && maps[c.key]) {
                  const entries = Object.entries(maps[c.key]).slice(0, 300);
                  return '<th><select class="form-select form-select-sm" data-filter="' + c.key + '"><option value="">All</option>' +
                    entries.map(([id, label]) => '<option value="' + TC.esc(id) + '" ' + (String(view.filters[c.key]) === String(id) ? 'selected' : '') + '>' + TC.esc(label) + '</option>').join('') +
                    '</select></th>';
                }
                return '<th><input class="form-input form-input-sm" data-filter="' + c.key + '" value="' + v + '" placeholder="filter"></th>';
              }).join('') +
              '<th></th>' +
            '</tr>' +
          '</thead>' +
          '<tbody id="crud-body"></tbody>' +
        '</table></div>' +

        '<div class="crud-foot">' +
          '<p class="muted" id="crud-count"></p>' +
          '<div class="crud-pager">' +
            '<label class="muted" style="font-size:.8rem">Rows ' +
              '<select class="form-select form-select-sm" id="crud-size" style="width:auto;display:inline-block">' +
                [25, 50, 100, 200, 500].map(n => '<option ' + (view.size === n ? 'selected' : '') + '>' + n + '</option>').join('') +
              '</select></label>' +
            '<button class="btn btn-sm btn-outline" type="button" id="crud-prev" ' + (view.page === 0 ? 'disabled' : '') + '>‹ Prev</button>' +
            '<span class="muted" style="font-size:.82rem">Page ' + (view.page + 1) + ' of ' + pages + '</span>' +
            '<button class="btn btn-sm btn-outline" type="button" id="crud-next" ' + (view.page + 1 >= pages ? 'disabled' : '') + '>Next ›</button>' +
          '</div>' +
        '</div>';
    }

    function paintKpis(list) {
      const host = document.getElementById('crud-kpis');
      if (!host) return;
      host.innerHTML = self._kpis(schema, list).map(k =>
        '<div class="crud-kpi"><span class="crud-kpi-label">' + TC.esc(k.label) + '</span>' +
        '<strong class="crud-kpi-value">' + TC.esc(k.value) + '</strong></div>').join('');
    }

    function paint() {
      const cols = visible();
      const qv = (view.q || '').toLowerCase();
      const list = qv ? rows.filter(r => JSON.stringify(r).toLowerCase().includes(qv)) : rows;
      const body = document.getElementById('crud-body');
      if (!body) return;

      if (!list.length) {
        const why = view.q || Object.values(view.filters).some(v => v)
          ? 'Nothing matches your search or filters on this page.'
          : (schema.empty || ('No ' + schema.title.toLowerCase() + ' records yet.'));
        const cta = can
          ? '<p style="margin:.6rem 0 0"><button class="btn btn-primary btn-sm" type="button" id="crud-empty-add">+ Add the first ' + TC.esc(schema.title.toLowerCase()) + '</button></p>'
          : '<p class="muted" style="margin:.6rem 0 0">Your role can read this page but not add to it.</p>';
        body.innerHTML = '<tr><td colspan="' + (cols.length + 2) + '">' +
          '<div class="crud-empty"><strong>' + TC.esc(why) + '</strong>' +
          '<p class="muted" style="margin:.4rem 0 0">This table stores <b>' + TC.esc(schema.title.toLowerCase()) + '</b> records for the studio. ' +
          'Media is stored as a <b>link</b> (Google Drive, YouTube, any https URL) — never as an upload — so the free storage quota is never touched.</p>' +
          cta + '</div></td></tr>';
        const ea = document.getElementById('crud-empty-add');
        if (ea) ea.onclick = () => self.openForm(moduleId, {});
        paintKpis(list);
        return;
      }

      body.innerHTML = list.map(r =>
        '<tr data-row="' + TC.esc(String(r.id)) + '"' + (selected.has(String(r.id)) ? ' class="is-selected"' : '') + '>' +
          '<td><input type="checkbox" data-pick="' + TC.esc(String(r.id)) + '" ' + (selected.has(String(r.id)) ? 'checked' : '') + '></td>' +
          cols.map(c => '<td>' + self._cell(r, c, maps) + '</td>').join('') +
          '<td class="crud-actions">' +
            /* V16: a page may attach its own buttons to every row by
               declaring schema.rowActions = [{ id, label, title, cls }].
               crud.js calls schema.onRowAction(actionId, row) when one is
               pressed. exam-register.html uses this to print a docket, a
               result slip, a certificate and an outcome letter. */
            (schema.rowActions || []).map(a =>
              '<button class="btn btn-sm ' + (a.cls || 'btn-ghost') + '" data-rowact="' + TC.esc(a.id) +
              '" data-rowid="' + TC.esc(String(r.id)) + '" title="' + TC.esc(a.title || a.label) + '">' +
              TC.esc(a.label) + '</button>').join('') +
            '<button class="btn btn-sm btn-ghost" data-open="' + TC.esc(String(r.id)) + '" title="Open the full record">View</button>' +
            (can ? '<button class="btn btn-sm btn-ghost" data-edit="' + TC.esc(String(r.id)) + '">Edit</button>' +
                   '<button class="btn btn-sm btn-ghost" data-dup="' + TC.esc(String(r.id)) + '" title="Create a copy">Copy</button>' +
                   '<button class="btn btn-sm btn-danger" data-del="' + TC.esc(String(r.id)) + '">Delete</button>' : '') +
          '</td>' +
        '</tr>').join('');

      const find = id => list.find(x => String(x.id) === String(id));
      body.querySelectorAll('[data-rowact]').forEach(b => b.onclick = () => {
        if (typeof schema.onRowAction === 'function') schema.onRowAction(b.dataset.rowact, find(b.dataset.rowid), reload);
      });
      body.querySelectorAll('[data-open]').forEach(b => b.onclick = () => self.openRecord(moduleId, find(b.dataset.open), maps));
      body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => self.openForm(moduleId, find(b.dataset.edit)));
      body.querySelectorAll('[data-dup]').forEach(b => b.onclick = () => {
        const copy = Object.assign({}, find(b.dataset.dup));
        delete copy.id; delete copy.created_at;
        toast('Duplicating — review and save.', 'success');
        self.openForm(moduleId, copy);
      });
      body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => self.remove(moduleId, b.dataset.del));
      body.querySelectorAll('[data-pick]').forEach(cb => cb.onchange = () => {
        cb.checked ? selected.add(cb.dataset.pick) : selected.delete(cb.dataset.pick);
        cb.closest('tr').classList.toggle('is-selected', cb.checked);
        bulkBar();
      });

      const countEl = document.getElementById('crud-count');
      if (countEl) {
        const shown = list.length;
        countEl.innerHTML = shown.toLocaleString() + ' shown · <b>' + total.toLocaleString() + '</b> total · ' +
          'protected by row-level security · media stored as links, never uploads';
      }
      paintKpis(list);
    }

    function bulkBar() {
      const bar = document.getElementById('crud-bulk');
      if (!bar) return;
      bar.hidden = selected.size === 0;
      const n = document.getElementById('crud-bulk-n');
      if (n) n.textContent = selected.size + ' selected';
    }

    async function reload() {
      await fetchRows();
      shell();
      wire();
      paint();
      bulkBar();
    }

    function wire() {
      const $ = id => document.getElementById(id);

      const q = $('crud-q');
      if (q) q.oninput = e => { view.q = e.target.value; persist(); paint(); };

      mount.querySelectorAll('[data-sort]').forEach(th => th.onclick = () => {
        const k = th.dataset.sort;
        if (view.sort === k) view.dir = view.dir === 'asc' ? 'desc' : 'asc';
        else { view.sort = k; view.dir = 'asc'; }
        view.page = 0; persist(); reload();
      });

      mount.querySelectorAll('[data-filter]').forEach(el => {
        const apply = () => { view.filters[el.dataset.filter] = el.value; view.page = 0; persist(); reload(); };
        if (el.tagName === 'SELECT') el.onchange = apply;
        else {
          let t; el.oninput = () => { clearTimeout(t); t = setTimeout(apply, 400); };
        }
      });

      const all = $('crud-all');
      if (all) all.onchange = () => {
        mount.querySelectorAll('[data-pick]').forEach(cb => {
          cb.checked = all.checked;
          cb.checked ? selected.add(cb.dataset.pick) : selected.delete(cb.dataset.pick);
          cb.closest('tr').classList.toggle('is-selected', cb.checked);
        });
        bulkBar();
      };

      const bnone = $('crud-bulk-none');
      if (bnone) bnone.onclick = () => { selected.clear(); paint(); bulkBar(); };

      const bcsv = $('crud-bulk-csv');
      if (bcsv) bcsv.onclick = () => self.exportCsv(schema, rows.filter(r => selected.has(String(r.id))));

      const bdel = $('crud-bulk-del');
      if (bdel) bdel.onclick = async () => {
        if (!confirm('Delete ' + selected.size + ' record(s)? This cannot be undone.')) return;
        if (!self.sb) { toast('Preview mode — connect Supabase to delete.', 'warning'); return; }
        const ids = [...selected];
        const { error } = await self.sb.from(schema.table).delete().in('id', ids);
        if (error) { toast(error.message, 'danger'); return; }
        toast(ids.length + ' deleted', 'success');
        selected.clear();
        reload();
      };

      const size = $('crud-size');
      if (size) size.onchange = e => { view.size = Number(e.target.value); view.page = 0; persist(); reload(); };

      const prev = $('crud-prev');
      if (prev) prev.onclick = () => { if (view.page > 0) { view.page--; persist(); reload(); } };

      const next = $('crud-next');
      if (next) next.onclick = () => { view.page++; persist(); reload(); };

      const dense = $('crud-dense');
      if (dense) dense.onclick = () => { view.dense = !view.dense; persist(); shell(); wire(); paint(); };

      const clear = $('crud-clear');
      if (clear) clear.onclick = () => { view.filters = {}; view.q = ''; view.page = 0; persist(); reload(); };

      const colsBtn = $('crud-cols');
      if (colsBtn) colsBtn.onclick = () => self.openColumns(moduleId, schema, view, () => { persist(); shell(); wire(); paint(); });

      const printBtn = $('crud-print');
      if (printBtn) printBtn.onclick = () => self.printList(schema, rows, visible(), maps);

      const csv = $('crud-csv');
      if (csv) csv.onclick = () => self.exportCsv(schema, rows);

      const add = $('crud-add');
      if (add) add.onclick = () => self.openForm(moduleId, {});

      const saveView = $('crud-saveview');
      if (saveView) saveView.onclick = () => {
        const name = prompt('Name this view (filters + sort + columns):');
        if (!name) return;
        const list = self._savedViews(moduleId);
        list.push({ name: name, state: JSON.parse(JSON.stringify(view)) });
        self._putSavedViews(moduleId, list);
        toast('View "' + name + '" saved', 'success');
        reload();
      };

      const savedSel = $('crud-saved');
      if (savedSel) savedSel.onchange = e => {
        const i = e.target.value;
        if (i === '') return;
        const v = self._savedViews(moduleId)[Number(i)];
        if (!v) return;
        Object.assign(view, v.state, { page: 0 });
        persist(); reload();
      };
    }

    await reload();
  },

  /* Column chooser — remembers your choice per page, per browser. */
  openColumns(moduleId, schema, view, done) {
    let host = document.getElementById('crud-cols-modal');
    if (!host) {
      host = document.createElement('div');
      host.id = 'crud-cols-modal';
      host.className = 'modal-backdrop';
      document.body.appendChild(host);
    }
    host.innerHTML = '<div class="modal" style="max-width:520px">' +
      '<div class="modal-header"><h2>Columns on this page</h2>' +
      '<button type="button" onclick="closeModal(\'crud-cols-modal\')">×</button></div>' +
      '<div class="modal-body">' +
        '<p class="muted" style="margin-top:0">Tick the columns you want to see. Your choice is remembered on this device for this page only — it does not change anyone else\'s view or the data itself.</p>' +
        schema.cols.map(c =>
          '<label style="display:flex;gap:10px;align-items:center;padding:6px 0">' +
          '<input type="checkbox" data-col="' + c.key + '" ' + (view.hidden.indexOf(c.key) === -1 ? 'checked' : '') + '>' +
          '<span>' + TC.esc(c.label) + ' <span class="muted">(' + TC.esc(c.key) + ')</span></span></label>').join('') +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-ghost" type="button" id="cols-all">Show all</button>' +
        '<button class="btn btn-primary" type="button" id="cols-done">Apply</button>' +
      '</div></div>';
    host.classList.add('show');
    document.getElementById('cols-all').onclick = () => {
      host.querySelectorAll('[data-col]').forEach(cb => { cb.checked = true; });
    };
    document.getElementById('cols-done').onclick = () => {
      view.hidden = [...host.querySelectorAll('[data-col]')].filter(cb => !cb.checked).map(cb => cb.dataset.col);
      if (view.hidden.length === schema.cols.length) view.hidden = [];
      closeModal('crud-cols-modal');
      done();
    };
  },

  /* Full-record drawer — shows EVERY field, not the first six. */
  openRecord(moduleId, row, maps) {
    if (!row) return;
    const schema = this.def(moduleId) || this.SCHEMA[moduleId];
    const can = this.canWrite(moduleId);
    let host = document.getElementById('crud-record');
    if (!host) {
      host = document.createElement('div');
      host.id = 'crud-record';
      host.className = 'modal-backdrop';
      document.body.appendChild(host);
    }
    const extra = Object.keys(row).filter(k => !schema.cols.some(c => c.key === k) && k !== 'id');
    host.innerHTML = '<div class="modal" style="max-width:680px">' +
      '<div class="modal-header"><h2>' + TC.esc(schema.title) + ' record</h2>' +
      '<button type="button" onclick="closeModal(\'crud-record\')">×</button></div>' +
      '<div class="modal-body">' +
        '<table class="crud-detail"><tbody>' +
          schema.cols.map(c => '<tr><th>' + TC.esc(c.label) + '</th><td>' + this._cell(row, c, maps || {}) + '</td></tr>').join('') +
          extra.map(k => '<tr><th class="muted">' + TC.esc(k) + '</th><td class="muted">' +
            TC.esc(row[k] == null ? '—' : (typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k]))) + '</td></tr>').join('') +
          '<tr><th class="muted">Record id</th><td class="muted" style="font-family:monospace;font-size:.8rem">' + TC.esc(String(row.id)) + '</td></tr>' +
        '</tbody></table>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<button class="btn btn-ghost" type="button" id="rec-copy">Copy record id</button>' +
        (can ? '<button class="btn btn-primary" type="button" id="rec-edit">Edit this record</button>' : '') +
      '</div></div>';
    host.classList.add('show');
    document.getElementById('rec-copy').onclick = () => {
      try { navigator.clipboard.writeText(String(row.id)); toast('Record id copied', 'success'); }
      catch (e) { toast(String(row.id), 'success'); }
    };
    const ed = document.getElementById('rec-edit');
    if (ed) ed.onclick = () => { closeModal('crud-record'); this.openForm(moduleId, row); };
  },

  /* Printable view of exactly what is on screen — no browser chrome, no
     nav, no buttons. Prints or "saves as PDF" from the print dialog. */
  printList(schema, rows, cols, maps) {
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to print.', 'warning'); return; }
    const brand = (window.CONFIG && (CONFIG.practiceName || CONFIG.siteName)) || document.title;
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + TC.esc(schema.title) + '</title>' +
      '<style>body{font-family:system-ui,sans-serif;margin:24px;color:#111}' +
      'h1{font-size:1.2rem;margin:0}small{color:#555}' +
      'table{border-collapse:collapse;width:100%;margin-top:14px;font-size:.78rem}' +
      'th,td{border:1px solid #bbb;padding:5px 7px;text-align:left;vertical-align:top}' +
      'thead th{background:#eee}@media print{@page{size:landscape;margin:12mm}}</style></head><body>' +
      '<h1>' + TC.esc(brand) + ' — ' + TC.esc(schema.title) + '</h1>' +
      '<small>' + rows.length + ' record(s) · printed ' + new Date().toLocaleString() + '</small>' +
      '<table><thead><tr>' + cols.map(c => '<th>' + TC.esc(c.label) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.map(r => '<tr>' + cols.map(c => '<td>' + this._cell(r, c, maps || {}) + '</td>').join('') + '</tr>').join('') +
      '</tbody></table></body></html>');
    w.document.close();
    setTimeout(() => w.print(), 350);
  },

  exportCsv(schema, rows) {
    const cols = schema.cols.map(c => c.key);
    const header = schema.cols.map(c => c.label).join(',');
    const body = (rows || []).map(r => cols.map(k => {
      const v = r[k] == null ? '' : String(r[k]).replace(/"/g, '""');
      return '"' + v + '"';
    }).join(',')).join('\n');
    const blob = new Blob([header + '\n' + body], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (schema.table || 'export') + '.csv';
    a.click();
  },

  async openForm(moduleId, row) {
    const schema = this.def(moduleId) || this.SCHEMA[moduleId];
    let host = document.getElementById('crud-modal');
    if (!host) {
      host = document.createElement('div');
      host.id = 'crud-modal';
      host.className = 'modal-backdrop';
      document.body.appendChild(host);
    }
    const fields = [];
    for (const c of schema.cols) {
      let control = '';
      if (c.type === 'textarea') control = `<textarea class="form-textarea" name="${c.key}">${TC.esc(row[c.key] || '')}</textarea>`;
      else if (c.type === 'checkbox') control = `<input type="checkbox" name="${c.key}" ${row[c.key] ? 'checked' : ''}>`;
      else if (c.type === 'select') control = `<select class="form-select" name="${c.key}">${(c.options||[]).map(o => `<option ${String(row[c.key])===o?'selected':''}>${o}</option>`).join('')}</select>`;
      else if (c.type === 'lookup') {
        /* -----------------------------------------------------------
           BUG FIX 15 (reported): "when class, term, session, subject,
           student, tutor etc. are created and then needed on another
           page, they should not be typed but selected from a dropdown."

           Several tables store a NAME rather than a foreign key
           (waitlist.learner_name, payroll.tutor_name, substitutions.
           cover_tutor, subjects.name, trials.subject ...). A 'ref'
           control cannot be used there because ref stores an id, and
           these columns hold text.

           'lookup' fills that gap: it offers a real dropdown built from
           live rows, but stores the TEXT the column expects. "Type your
           own" stays available for a genuinely new value, so nobody is
           ever blocked by a name that is not on the list yet.
           ----------------------------------------------------------- */
        var opts = [];
        if (this.sb && c.lookupTable) {
          var res = await this.sb.from(c.lookupTable).select('*').limit(500);
          opts = (res.data || []).map(function (r) { return r[c.lookupValue]; })
                   .filter(function (v) { return v != null && String(v).trim() !== ''; });
        } else if (window.DEMO && c.lookupTable) {
          opts = (window.DEMO[c.lookupTable] || []).map(function (r) { return r[c.lookupValue]; });
        }
        (c.extraOptions || []).forEach(function (o) { opts.push(o); });
        // De-duplicate and keep the current value even if it has since been deleted.
        var cur = row[c.key] == null ? '' : String(row[c.key]);
        var uniq = [];
        opts.concat(cur ? [cur] : []).forEach(function (o) {
          o = String(o);
          if (o && uniq.indexOf(o) === -1) uniq.push(o);
        });
        uniq.sort(function (a, b) { return a.localeCompare(b); });
        var listId = 'lk-' + c.key + '-' + Math.random().toString(36).slice(2, 7);
        control =
          '<select class="form-select" data-lookup-select="' + c.key + '">' +
            '<option value="">— choose —</option>' +
            uniq.map(function (o) {
              return '<option ' + (cur === o ? 'selected' : '') + '>' + TC.esc(o) + '</option>';
            }).join('') +
            '<option value="__other__">➕ Type a new one…</option>' +
          '</select>' +
          '<input class="form-input" name="' + c.key + '" list="' + listId + '" ' +
            'value="' + TC.esc(cur) + '" ' +
            'style="margin-top:6px;' + (uniq.indexOf(cur) === -1 && cur ? '' : 'display:none') + '" ' +
            'placeholder="Type a new value">' +
          '<datalist id="' + listId + '">' +
            uniq.map(function (o) { return '<option value="' + TC.esc(o) + '">'; }).join('') +
          '</datalist>';
      }
      else if (c.type === 'ref' && this.sb) {
        const { data } = await this.sb.from(c.refTable).select('*').limit(200);
        const opts = (data || []).map(d => `<option value="${d[c.refStore || c.refValue]}" ${String(row[c.key])===String(d[c.refStore || c.refValue])?'selected':''}>${TC.esc(d[c.refValue])}</option>`).join('');
        control = `<select class="form-select" name="${c.key}"><option value=""></option>${opts}</select>`;
      } else control = `<input class="form-input" type="${c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : c.type === 'email' ? 'email' : c.type === 'tel' ? 'tel' : c.type === 'datetime-local' ? 'datetime-local' : 'text'}" name="${c.key}" value="${TC.esc(row[c.key] || '')}">`;
      fields.push(`<div class="form-group"><label>${c.label}</label>${control}${c.help ? `<div class="help">${c.help}</div>` : ''}</div>`);
    }
    host.innerHTML = `<div class="modal"><div class="modal-header"><h2>${row.id ? 'Edit' : 'Add'} ${schema.title}</h2><button type="button" onclick="closeModal('crud-modal')">×</button></div>
      <form class="modal-body" id="crud-form">${fields.join('')}</form>
      <div class="modal-footer"><button class="btn btn-ghost" type="button" onclick="closeModal('crud-modal')">Cancel</button><button class="btn btn-primary" type="submit" form="crud-form">Save</button></div></div>`;
    host.classList.add('show');

    /* Keep each 'lookup' dropdown and its free-text box in step. Choosing
       a name fills the hidden input (which is what actually submits);
       choosing "Type a new one" reveals the box. */
    host.querySelectorAll('[data-lookup-select]').forEach(function (sel) {
      var key = sel.getAttribute('data-lookup-select');
      var inp = host.querySelector('[name="' + key + '"]');
      if (!inp) return;
      sel.addEventListener('change', function () {
        if (sel.value === '__other__') {
          inp.style.display = '';
          inp.value = '';
          inp.focus();
        } else if (sel.value === '') {
          inp.style.display = 'none';
          inp.value = '';
        } else {
          inp.style.display = 'none';
          inp.value = sel.value;
        }
      });
    });

    document.getElementById('crud-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      /* V13 BUG FIX — "invalid input syntax for type numeric: \"\""
         FormData.get() returns an EMPTY STRING for any field the user left
         blank. Sending "" to PostgreSQL is fine for text, but it is a hard
         error for numeric, integer, date, timestamp and uuid columns:

             invalid input syntax for type numeric: ""
             invalid input syntax for type uuid: ""

         That is why creating an Engagement (hourly_rate, hours_prepaid,
         baseline_score…) or saving a Session (hours, ends_at…) failed while
         a purely textual record saved fine. Blank must mean NULL, not "".
         Numbers are also coerced to real numbers so Postgres never has to
         parse a string, and text is trimmed. This one fix covers every one of
         the CRUD-driven pages. */
      const payload = {};
      const BLANK_IS_NULL = ['number', 'date', 'datetime-local', 'ref', 'time', 'month'];
      schema.cols.forEach(c => {
        if (c.type === 'checkbox') {
          const el = e.target.querySelector(`[name="${c.key}"]`);
          payload[c.key] = !!(el && el.checked);
          return;
        }
        let v = fd.get(c.key);
        if (typeof v === 'string') v = v.trim();

        if (v === '' || v === undefined) {
          // Blank -> NULL for anything Postgres cannot parse from "".
          payload[c.key] = BLANK_IS_NULL.includes(c.type) ? null : (v === '' ? null : v);
          return;
        }
        if (c.type === 'number') {
          const n = Number(v);
          payload[c.key] = Number.isFinite(n) ? n : null;
          return;
        }
        payload[c.key] = v;
      });
      // Never send an empty id; let the database generate it.
      if (payload.id === null || payload.id === '') delete payload.id;
      if (!this.sb) { toast('Preview mode — connect Supabase to save.', 'warning'); return; }
      let res;
      if (row.id) res = await this.sb.from(schema.table).update(payload).eq('id', row.id);
      else res = await this.sb.from(schema.table).insert(payload);
      if (res.error) { toast(res.error.message, 'danger'); return; }
      toast('Saved', 'success');
      closeModal('crud-modal');
      this.renderList(moduleId);
    };
  },

  async remove(moduleId, id) {
    if (!confirm('Delete this row?')) return;
    const schema = this.def(moduleId) || this.SCHEMA[moduleId];
    if (!this.sb) return;
    if (window.SCDelete) {
      const r = await SCDelete.byId(this.sb, schema.table, id);
      if (!r.ok) { toast(r.error, 'danger'); return; }
      toast('Deleted', 'success');
      this.renderList(moduleId);
      return;
    }
    const { error } = await this.sb.from(schema.table).delete().eq('id', id);
    if (error) toast(error.message, 'danger');
    else { toast('Deleted', 'success'); this.renderList(moduleId); }
  }
};
window.CRUD = CRUD;
