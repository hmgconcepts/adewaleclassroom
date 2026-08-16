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
      { key: 'subject', label: 'Subject', type: 'text' },
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
      { key: 'parent_name', label: 'Parent name', type: 'text', required: true },
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'learner_name', label: 'Learner name', type: 'text' },
      { key: 'subject', label: 'Subject wanted', type: 'text' },
      { key: 'kind', label: '1:1 or group', type: 'select', options: ['one_on_one','group','unsure'] },
      { key: 'timezone', label: 'Timezone', type: 'text' },
      { key: 'source', label: 'Source', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['new','contacted','trial_booked','converted','lost'] }
    ]},
    waitlist: { table: 'waitlist', title: 'Waitlist row', cols: [
      { key: 'learner_name', label: 'Learner', type: 'text', required: true },
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'kind', label: 'Kind', type: 'select', options: ['one_on_one','group'] },
      { key: 'notes', label: 'Notes', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['waiting','offered','placed','withdrawn'] }
    ]},
    trials: { table: 'trials', title: 'Trial', cols: [
      { key: 'engagement_id', label: 'Resulting engagement (optional)', type: 'ref', refTable: 'engagements', refValue: 'name', refStore: 'id' },
      { key: 'learner_name', label: 'Learner', type: 'text', required: true },
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
      { key: 'status', label: 'Status', type: 'select', options: ['present','late','absent','excused'] },
      { key: 'minutes', label: 'Minutes present', type: 'number' }
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
    payments: { table: 'payments', title: 'Payment', cols: [
      { key: 'invoice_id', label: 'Invoice', type: 'ref', refTable: 'invoices', refValue: 'amount', refStore: 'id' },
      { key: 'amount', label: 'Amount', type: 'number', required: true },
      { key: 'method', label: 'Method', type: 'select', options: ['bank','cash','paystack','flutterwave','stripe','other'] },
      { key: 'reference', label: 'Reference', type: 'text' },
      { key: 'paid_on', label: 'Paid on', type: 'date' }
    ]},
    announcements: { table: 'announcements', title: 'Announcement', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'textarea' },
      { key: 'audience', label: 'Audience', type: 'select', options: ['all','parents','learners','tutors'] },
      { key: 'pinned', label: 'Pinned', type: 'checkbox' }
    ]},
    inbox: { table: 'messages', title: 'Message', cols: [
      { key: 'to_role', label: 'To role', type: 'select', options: ['admin','tutor','parent','student'] },
      { key: 'subject', label: 'Subject', type: 'text', required: true },
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
      { key: 'exam_name', label: 'Exam', type: 'text', required: true },
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
      { key: 'subject', label: 'Subject', type: 'text' },
      { key: 'kind', label: 'Kind', type: 'select', options: ['book','paper','video','worksheet','other'] }
    ]},
    eresources: { table: 'eresources', title: 'E-resource', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'subject', label: 'Subject', type: 'text' },
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
      { key: 'tutor_name', label: 'Tutor', type: 'text', required: true },
      { key: 'kind', label: 'Kind', type: 'select', options: ['sick','casual','earned','study','other'] },
      { key: 'starts_on', label: 'From', type: 'date' },
      { key: 'ends_on', label: 'To', type: 'date' },
      { key: 'reason', label: 'Reason', type: 'textarea' },
      { key: 'status', label: 'Status', type: 'select', options: ['pending','approved','rejected'] }
    ]},
    payroll: { table: 'payroll', title: 'Payroll row', cols: [
      { key: 'tutor_name', label: 'Tutor', type: 'text', required: true },
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
      { key: 'subject', label: 'Subject', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'textarea' }
    ]},
    announcements: { table: 'announcements', title: 'Announcement', cols: [
      { key: 'title', label: 'Title', type: 'text', required: true },
      { key: 'body', label: 'Body', type: 'textarea' },
      { key: 'audience', label: 'Audience', type: 'select', options: ['all','parents','learners','tutors'] },
      { key: 'pinned', label: 'Pinned', type: 'checkbox' }
    ]},
    certificates: { table: 'certificates', title: 'Certificate', cols: [
      { key: 'learner_name', label: 'Learner', type: 'text', required: true },
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
      { key: 'cover_tutor', label: 'Cover tutor', type: 'text', required: true },
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
      { key: 'student_no', label: 'Student ID', type: 'text' },
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
      { key: 'subject', label: 'Subject', type: 'text' },
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
      { key: 'parent_name', label: 'Parent', type: 'text', required: true },
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

  async renderList(moduleId, mountId) {
    const schema = this.def(moduleId) || this.SCHEMA[moduleId];
    const mount = document.getElementById(mountId || 'crud-root');
    if (!schema || !mount) return;
    const can = this.canWrite(moduleId);
    mount.innerHTML = `<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <input class="form-input" id="crud-q" placeholder="Search…" style="max-width:280px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" type="button" id="crud-csv">⬇ CSV</button>
        ${can ? `<button class="btn btn-primary" type="button" id="crud-add">+ Add ${schema.title}</button>` : ''}
      </div>
    </div><div class="table-wrap"><table><thead><tr id="crud-head"></tr></thead><tbody id="crud-body"><tr><td>Loading…</td></tr></tbody></table></div>
    <p class="muted" id="crud-count" style="margin-top:8px"></p>`;
    const head = schema.cols.slice(0, 6).map(c => `<th>${c.label}</th>`).join('') + (can ? '<th></th>' : '');
    document.getElementById('crud-head').innerHTML = head;
    let rows = [];
    if (this.sb) {
      // Some tables (session_attendance, packages, payments...) pre-date a
      // created_at column; order by a column that actually exists.
      const orderCol = schema.orderBy || (schema.cols.some(c => c.key === 'created_at') ? 'created_at' : 'id');
      let q = this.sb.from(schema.table).select('*').order(orderCol, { ascending: false }).limit(200);
      if (schema.defaultFilters) {
        Object.entries(schema.defaultFilters).forEach(([k, v]) => { q = q.eq(k, v); });
      }
      const res = await q;
      if (res.error) toast(res.error.message, 'danger');
      rows = res.data || [];
    } else {
      rows = (window.DEMO && window.DEMO[schema.table]) || [];
    }
    const paint = (list) => {
      document.getElementById('crud-body').innerHTML = list.length ? list.map(r => `<tr>${
        schema.cols.slice(0,6).map(c => `<td>${TC.esc(r[c.key] == null ? '' : r[c.key])}</td>`).join('')
      }${can ? `<td><button class="btn btn-sm btn-ghost" data-edit="${r.id}">Edit</button> <button class="btn btn-sm btn-danger" data-del="${r.id}">Delete</button></td>` : ''}</tr>`).join('') : '<tr><td colspan="8" class="muted">No rows yet.</td></tr>';
      mount.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => this.openForm(moduleId, list.find(x => String(x.id) === b.dataset.edit)));
      mount.querySelectorAll('[data-del]').forEach(b => b.onclick = () => this.remove(moduleId, b.dataset.del));
    };
    paint(rows);
    const countEl = document.getElementById('crud-count');
    if (countEl) countEl.textContent = rows.length + ' row(s) · family-safe via RLS · media must be https / Drive / YouTube links';
    document.getElementById('crud-q').oninput = (e) => {
      const qv = e.target.value.toLowerCase();
      paint(rows.filter(r => JSON.stringify(r).toLowerCase().includes(qv)));
    };
    const add = document.getElementById('crud-add');
    if (add) add.onclick = () => this.openForm(moduleId, {});
    const csv = document.getElementById('crud-csv');
    if (csv) csv.onclick = () => this.exportCsv(schema, rows);
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
    document.getElementById('crud-form').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {};
      schema.cols.forEach(c => {
        if (c.type === 'checkbox') payload[c.key] = e.target.querySelector(`[name="${c.key}"]`).checked;
        else payload[c.key] = fd.get(c.key);
      });
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
