// ─────────────────────────────────────────────────────────────────────────────
// AMWAY MEMBERSHIP TRAINING: ALL ON-SCREEN TEXT, NUMBERS AND TIMING
//
// Edit wording, numbers and scene lengths here only. No animation code below.
// After editing:  node build.mjs   (HTML)   then   node render.mjs   (MP4)
//
// • dur        = scene length in seconds. Total video length is the sum.
// • count      = the number a count-up animates to; prefix/suffix wrap it.
// • Anything marked [CONFIRM] must be checked before the final cut.
// • Accuracy rules: keep "up to" on $100 / 5× / $300 / $1,200.
// ─────────────────────────────────────────────────────────────────────────────
window.CONTENT = {
  title: 'A Story Worth More Than $20',
  fps: 30,

  scenes: [
    // 1 ─ COVER
    {
      type: 'cover', dur: 8,
      eyebrow: 'AMWAY MEMBERSHIP TRAINING',
      title: 'A Story Worth More Than $20',
      sub: 'A customer story about peace of mind, everyday goals, and who our money supports.',
    },

    // 2 ─ MEET SARAH
    {
      type: 'meet', dur: 11,
      eyebrow: 'CHAPTER 1 · MEET SARAH',
      title: 'Meet Sarah.',
      body: 'Two kids. A full-time job. And a goal she wrote on the fridge in January: run her first 5K before summer.',
      fridgeNote: 'Run my first 5K before summer!',
      note: 'Sarah is a composite customer, not a real person.',
    },

    // 3 ─ HER TUESDAY
    {
      type: 'tuesday', dur: 15,
      title: 'Her Tuesday looks like a to-do list.',
      cards: [
        { icon: 'package', text: 'Out of protein powder again' },
        { icon: 'pill',    text: 'Did I reorder the kids’ vitamins?' },
        { icon: 'shirt',   text: 'Laundry soap before Saturday' },
        { icon: 'message', text: 'Another “your package is delayed” text' },
      ],
      close: 'None of it is big. All of it takes up space in her head, and that’s space she isn’t spending on her goals.',
    },

    // 4 ─ WHERE HER MONEY GOES (dark)
    {
      type: 'stats', dur: 14,
      eyebrow: 'WHERE HER MONEY GOES',
      title: 'Americans already pay for convenience.',
      stats: [
        { prefix: '~', count: 200, suffix: 'M', label: 'Americans use Amazon Prime' },
        { prefix: '$', count: 111, suffix: '',  label: 'average monthly subscription spend, up 23% in a year' },
        { prefix: '$', count: 252, suffix: '',  label: 'a year on subscriptions people don’t use' },
      ],
      source: 'Sources: CIRP estimate, Jan 2026 (Amazon Prime). CNET 2026 subscription survey, via WFSB (spend and unused subscriptions).',
    },

    // 5 ─ THE GYM LESSON
    {
      type: 'gym', dur: 15,
      eyebrow: 'THE GYM LESSON',
      title: 'We pay for the promise, not just the product.',
      stat: { prefix: '~', count: 50, suffix: '%' },
      statLabel: 'of gym members go less than twice a week, and keep paying.',
      weekLabel: 'A typical week',
      weekRows: ['Goes', 'Pays'],
      quote: 'People aren’t buying a treadmill. They’re buying the version of themselves who uses it.',
      close: 'The demand is real. Our job is to make sure our customers actually use what they pay for.',
      source: 'Source: Finder gym membership survey.',
    },

    // 6 ─ THE TURN (dark)
    {
      type: 'turn', dur: 11,
      eyebrow: 'CHAPTER 2 · THEN SHE MEETS YOU',
      title: 'What if her $20 went to someone she knows?',
      sub: 'Sarah already pays big companies every month. Then a friend shows her a membership that pays her back, and helps build that friend’s dream.',
      fromLabel: 'Big companies',
      toLabel: 'Someone she knows',
    },

    // 7 ─ MEMBERSHIP EXCLUSIVES
    {
      type: 'perks', dur: 18,
      eyebrow: 'AMWAY MEMBERSHIP · $20 A MONTH',
      title: 'Every month she places a $150+ qualifying online order:',
      perks: [
        { icon: 'tag',    big: '$40 off',        text: 'her qualifying order' },
        { icon: 'truck',  big: 'Free shipping',  text: 'free ground shipping + prioritized order processing (valued at $10)' },
        { icon: 'gift',   big: '1 free product', text: 'each month from the monthly selection, worth up to $50' },
        { icon: 'heart',  big: '$10 off',        text: 'Amway GLP-1 and Cellular Health Support Solutions' },
        { icon: 'phone',  big: '50% off',        text: 'the monthly Valdura Health App subscription' },
        { icon: 'star',   big: 'More rewards',   text: 'more loyalty rewards throughout the year' },
      ],
      footnote: 'Qualifying online orders of $150+ only. Free product from the eligible monthly selection only. Membership auto-renews; cancel anytime. US & Canadian Registered and Preferred Customers. Launches Nov 19.',
    },

    // 8 ─ THE MATH
    {
      type: 'math', dur: 14,
      eyebrow: 'ACCESS GRANTED',
      title: 'One $150+ order. Look what comes back.',
      items: [
        { count: 40, top: '',       label: 'off her order' },
        { count: 10, top: '',       label: 'free shipping + priority' },
        { count: 50, top: 'UP TO',  label: 'free product' },
      ],
      total: 'up to $100 in value',
      barHighlight: 'Up to 5\u00d7',   // shown in amber
      bar: 'Up to 5× her $20 back, every month she places a $150+ qualifying online order.',
    },

    // 9 ─ STATEMENT (dark)
    {
      type: 'statement', dur: 10,
      eyebrow: 'REMEMBER THIS ONE',
      line1: 'Even if she only uses it once a year…',
      line2: '…that month pays her $20 back up to five times over.',
    },

    // 10 ─ THE YEAR
    {
      type: 'year', dur: 16,
      eyebrow: 'THE YEAR',
      title: 'Three orders a year, and the whole year is paid for.',
      pays:  { big: '$240', label: 'what she pays all year', detail: '12 × $20' },
      gets:  { top: 'UP TO', big: '$300', label: 'comes back from 3 qualifying orders', detail: '3 × up to $100, when she takes her free product each time' },
      after: 'Every order after that is pure bonus.',
      monthlyHighlight: 'up to $1,200 in value a year',   // shown bold blue
      monthly: 'Ordering every month? That’s up to $1,200 in value a year. Cancel anytime.',
    },

    // 11 ─ BIGGER THAN SAVINGS
    // NOTE: the brief was cut off here. Rows 3 and 4 are a draft written from the
    // story's themes (goals, who our money supports). Replace them with your text.
    {
      type: 'bigger', dur: 14,
      eyebrow: 'BIGGER THAN SAVINGS',
      title: 'What it really buys her: one less thing to carry.',
      rows: [
        { icon: 'clock',   title: 'Time back',              text: 'Prioritized processing, and no store runs.' },
        { icon: 'refresh', title: 'Never running out',      text: 'Membership + Ditto: a monthly rhythm keeps her favorites stocked.' },
        { icon: 'target',  title: 'Room for her goals',     text: 'The space in her head goes back to her 5K.' },
        { icon: 'users',   title: 'Money that stays close', text: 'Her $20 helps build the dream of someone she knows.' },
      ],
    },

    // 12 ─ EXAMPLE BUNDLE (10% retail margin)
    {
      type: 'bundle', dur: 18,
      eyebrow: 'EXAMPLE BUNDLE · 10% RETAIL MARGIN',
      title: 'What a $150+ order can look like.',
      lines: [
        { label: '4 cases XS Energy Drink (48 cans) at $38.72', value: '$154.88' },
        { label: 'Buy 4, get 1 free: +12 cans [CONFIRM TERMS]', value: 'FREE' },
        { label: 'Membership discount',                          value: '−$40.00' },
        { label: 'Ground shipping',                              value: 'FREE' },
        { label: 'Free product of the month (up to $50)',        value: 'FREE' },
      ],
      totalLabel: 'She pays for the order',
      totalValue: '$114.88',
      perCan: { prefix: '$', count: 2.25, decimals: 2, suffix: '' },
      perCanUnit: 'per can',
      perCanDetail: '$134.88 with her $20 membership ÷ 60 cans, plus her free product.',
      clears: 'Clears the $150 minimum',
      costLine: 'IBO cost $35.20 per case · retail $44 · 10.26 PV per case',
    },

    // 13 ─ FLEXIBLE PRICING
    {
      type: 'pricing', dur: 13,
      eyebrow: 'FLEXIBLE PRICING',
      title: 'You set the retail margin. A lower price is an easier yes.',
      left:  { tag: '10% MARGIN', big: '$2.25', unit: 'per can', detail: 'Same bundle, the price we just built' },
      right: { tag: '20% MARGIN', big: '$2.48', unit: 'per can', detail: 'Same bundle, $14.08 more for her' },
      pv: 'PV is the same at either margin: about 41 PV on 4 cases.',
      why: 'The benefit of 10% is a lower price: an easier yes, more repeat orders, and more PV over time.',
    },

    // 14 ─ LAUNCH INCENTIVES
    {
      type: 'launch', dur: 16,
      eyebrow: 'LAUNCH INCENTIVES · STARTING NOV 19',
      title: 'Three reasons to start this week.',
      cards: [
        { icon: 'plane',  title: 'Top 20 trip to Ada, Michigan',
          text: 'All expenses paid for the top 20 IBOs with the most members ordering $150+. Top 10 Platinum and above, plus top 10 below Platinum.',
          small: 'Dates: [CONFIRM]' },
        { icon: 'dollar', title: 'Full retail profit, Nov 19 – Dec 31',
          text: 'Retail profit on member orders is figured on the full $150, not $110. Amway covers the $40.',
          small: 'Applies to the membership and the order.' },
        { icon: 'trophy', title: 'Invictus team incentive',
          text: 'Starts Nov 19.',
          small: 'Details announced at Invictus Leadership.' },
      ],
    },

    // 15 ─ CLOSE (dark). Draft: not in the brief.
    {
      type: 'close', dur: 11,
      eyebrow: 'SARAH’S STORY',
      title: 'Worth far more than $20.',
      sub: 'Peace of mind for her. Room for her goals. And her money supports someone she knows.',
      cta: 'Offer the membership to your customers. Launching Nov 19.',
      finish: '5K',
    },
  ],
};
