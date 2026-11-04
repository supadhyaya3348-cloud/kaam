// Work Sims: Forage-style virtual job experiences. Definitions and answer keys live only on the server.
// A sim has an intro from a "manager", three tasks, and a model answer shown after each task.
// Task kinds: "numbers" (number + choice inputs), "pick" (choose the right rows), "classify" (a label per row), "write" (short reply).

export const SIMS = {
  'bookkeeping-day': {
    id: 'bookkeeping-day', title: 'A day as junior bookkeeper', company: 'Pokhara Traders (demo)', role: 'Junior bookkeeping assistant',
    minutes: 20, skills: ['excel', 'english'], color: 'base',
    manager: { name: 'Mr. Gurung', role: 'Shop owner' },
    intro: 'Namaste, and welcome to Pokhara Traders! Our supplier meeting is on Friday and I need clean numbers. Please total Monday’s sales, check last week’s ledger for mistakes, and send me a short summary. Take your time, and be careful with the numbers.',
    tasks: [
      {
        id: 't1', kind: 'numbers', skill: 'excel', title: 'Total Monday’s sales',
        brief: 'Here are Monday’s sales. Work out the total takings and tell me which item earned the most money.',
        table: { head: ['Item', 'Qty', 'Price (Rs)'], rows: [['Rice, 25 kg', '4', '2,150'], ['Cooking oil, 1 L', '6', '980'], ['Sugar, 1 kg', '12', '110'], ['Lentils, 1 kg', '8', '180'], ['Tea, 500 g', '5', '340'], ['Soap', '10', '65']] },
        fields: [
          { id: 'total', label: 'Total sales on Monday (Rs)', type: 'number' },
          { id: 'top', label: 'Item that earned the most', type: 'choice', options: ['Rice, 25 kg', 'Cooking oil, 1 L', 'Sugar, 1 kg', 'Lentils, 1 kg', 'Tea, 500 g', 'Soap'] }
        ],
        key: { total: 19590, top: 'Rice, 25 kg' },
        model: 'Multiply quantity by price for each row: 8,600 + 5,880 + 1,320 + 1,440 + 1,700 + 650 = Rs 19,590. Rice earned the most (Rs 8,600). In a sheet: =C2*B2 in a new column, then =SUM() and =MAX().'
      },
      {
        id: 't2', kind: 'pick', skill: 'excel', title: 'Spot the ledger mistakes',
        brief: 'Last week’s ledger has two mistakes. Tick the rows that are wrong.',
        table: { head: ['Invoice', 'Item', 'Qty × Price', 'Amount (Rs)'], rows: [['INV-101', 'Sugar', '20 × 110', '2,200'], ['INV-102', 'Tea', '10 × 340', '3,040'], ['INV-103', 'Cooking oil', '5 × 980', '4,900'], ['INV-103', 'Soap', '30 × 65', '1,950'], ['INV-104', 'Lentils', '15 × 180', '2,700'], ['INV-105', 'Rice', '3 × 2,150', '6,450']] },
        key: [1, 3],
        model: 'INV-102 is wrong: 10 × 340 = 3,400, not 3,040 (two digits swapped). The second INV-103 is a duplicate invoice number: every invoice needs its own number. All other rows are correct.'
      },
      {
        id: 't3', kind: 'write', skill: 'english', title: 'Email your manager',
        brief: 'Write me a short email (40 to 120 words): Monday’s total, the top item, the two ledger mistakes, and what you will do next.',
        rubric: [
          { label: 'Gives Monday’s total (Rs 19,590)', any: ['19590', '19,590'] },
          { label: 'Names rice as the top item', any: ['rice'] },
          { label: 'Mentions the INV-102 / tea amount error', any: ['inv-102', 'inv 102', '102', 'tea', '3,400', '3400'] },
          { label: 'Mentions the duplicate INV-103', any: ['duplicate', 'inv-103', 'inv 103', '103', 'twice', 'same invoice'] },
          { label: 'Says what you will do next, politely', any: ['will ', 'i’ll', "i'll", 'correct', 'fix', 'update', 'please', 'thank'] }
        ],
        model: 'Dear Mr. Gurung, Monday’s total sales were Rs 19,590, and rice earned the most (Rs 8,600). I found two ledger mistakes: INV-102 (tea) should be Rs 3,400, not 3,040, and INV-103 is used twice. I will correct the amount, give the soap entry a new invoice number, and send you the updated sheet today. Thank you, Sita'
      }
    ]
  },
  'support-shift': {
    id: 'support-shift', title: 'A shift in online customer support', company: 'Himal Crafts (demo)', role: 'Social media and support assistant',
    minutes: 15, skills: ['service', 'digital', 'english'], color: 'ridge',
    manager: { name: 'Ms. Shrestha', role: 'Founder' },
    intro: 'Welcome to Himal Crafts! We sell handmade felt and pashmina online. This morning the inbox is busy: please sort the messages, catch any fake orders before we ship, and reply to an upset customer. Be kind, be quick, and stay safe.',
    tasks: [
      {
        id: 't1', kind: 'classify', skill: 'service', title: 'Sort the inbox',
        brief: 'Label each message so the right person handles it.',
        labels: ['Order question', 'Refund request', 'Scam', 'Compliment'],
        table: { head: ['From', 'Message'], rows: [['Anjali', '“When will my felt bag reach Biratnagar? I ordered on Sunday.”'], ['Unknown number', '“Your page will be deleted! Send your login and OTP to verify now.”'], ['Rohan', '“The shawl colour is different from the photo. Can I get my money back?”'], ['Mira', '“The slippers are so warm, my mother loves them. Thank you!”'], ['Prakash', '“Do you deliver to Pokhara, and how long does it take?”']] },
        key: ['Order question', 'Scam', 'Refund request', 'Compliment', 'Order question'],
        model: 'Anjali and Prakash ask about orders and delivery. The “send your login and OTP” message is a scam: never share codes. Rohan wants a refund because the colour differs. Mira is a compliment: thank her and maybe ask for a review.'
      },
      {
        id: 't2', kind: 'pick', skill: 'digital', title: 'Catch the fake orders',
        brief: 'Two of these orders look fake. Tick them before we ship.',
        table: { head: ['Order', 'Details'], rows: [['#2201', 'Felt bag, cash on delivery to Lalitpur, phone number matches the profile'], ['#2202', '10 pashminas, “pay by gift card codes”, ship today to a different country'], ['#2203', 'Two pairs of slippers, paid by eSewa, delivery to Kathmandu'], ['#2204', 'Asks you to click a link to “confirm payment” and enter the shop’s bank password']] },
        key: [1, 3],
        model: '#2202 is fake: gift-card payment, a rush and a mismatched country are classic scam signs. #2204 is phishing: no real buyer asks for your bank password through a link. #2201 and #2203 look normal.'
      },
      {
        id: 't3', kind: 'write', skill: 'service', title: 'Reply to an upset customer',
        brief: 'Rohan says the shawl colour is different from the photo and wants his money back. Write a kind reply (40 to 120 words).',
        rubric: [
          { label: 'Apologises', any: ['sorry', 'apolog'] },
          { label: 'Shows you understand the problem (colour)', any: ['colour', 'color', 'photo'] },
          { label: 'Offers a clear next step (refund or exchange)', any: ['refund', 'exchange', 'replace', 'return'] },
          { label: 'Gives a time or what happens next', any: ['today', 'tomorrow', 'within', 'hours', 'days', 'by '] },
          { label: 'Ends warmly', any: ['thank', 'anything else', 'happy to help', 'regards', 'warmly'] }
        ],
        model: 'Dear Rohan, I am really sorry the shawl colour is different from the photo. That must be disappointing. We can give you a full refund or exchange it for the colour you wanted. If you reply with your choice, I will arrange the pickup today, and the refund reaches you within 3 days. Thank you for telling us, and please let me know if there is anything else I can help with. Warm regards, Himal Crafts'
      }
    ]
  }
};

export const SIM_PASS = 60;

// The definition the browser may see: no answer keys, no rubric word lists, no model answers.
export function publicSim(s) {
  return { ...s, tasks: s.tasks.map(({ key, model, rubric, ...t }) => ({ ...t, rubric: rubric ? rubric.map(r => r.label) : undefined })) };
}
export const simList = () => Object.values(SIMS).map(s => ({ id: s.id, title: s.title, company: s.company, role: s.role, minutes: s.minutes, skills: s.skills, color: s.color, tasks: s.tasks.length }));

const num = v => +String(v ?? '').replace(/[^\d.]/g, '');
const words = t => (String(t || '').trim().match(/\S+/g) || []).length;

// Grades one task without AI. Returns { score 0-100, checks: [{label, ok}] }.
export function gradeTask(task, answer) {
  const a = answer || {};
  if (task.kind === 'numbers') {
    const checks = task.fields.map(f => ({ label: f.label, ok: f.type === 'number' ? num(a[f.id]) === task.key[f.id] : String(a[f.id] || '') === task.key[f.id] }));
    return { score: Math.round(checks.filter(c => c.ok).length / checks.length * 100), checks };
  }
  if (task.kind === 'pick') {
    const picked = new Set((Array.isArray(a.rows) ? a.rows : []).map(Number));
    const checks = task.table.rows.map((r, i) => ({ label: r[0], ok: picked.has(i) === task.key.includes(i) }));
    return { score: Math.round(checks.filter(c => c.ok).length / checks.length * 100), checks };
  }
  if (task.kind === 'classify') {
    const lab = Array.isArray(a.labels) ? a.labels : [];
    const checks = task.table.rows.map((r, i) => ({ label: r[0], ok: lab[i] === task.key[i] }));
    return { score: Math.round(checks.filter(c => c.ok).length / checks.length * 100), checks };
  }
  if (task.kind === 'write') {
    const low = String(a.text || '').toLowerCase();
    const checks = task.rubric.map(r => ({ label: r.label, ok: r.any.some(w => low.includes(w)) }));
    const n = words(a.text); const lengthOk = n >= 35 && n <= 140;
    checks.push({ label: 'About 40 to 120 words', ok: lengthOk });
    return { score: Math.round(checks.filter(c => c.ok).length / checks.length * 100), checks };
  }
  return { score: 0, checks: [] };
}
