// Mock-test bank for the hiring assessment. Answers stay on the server; the browser only gets questions.
// Each entry: [question, [options], index of the right option]
export const MOCK = {
  excel: [
    ['A shop sheet has prices in column C and quantities in column D. Which formula gives the total for row 2?', ['=C2+D2', '=C2*D2', '=SUM(C2,D2)', '=C2/D2'], 1],
    ['You need to count how many orders in A2:A50 say "Paid". Which formula works?', ['=COUNT(A2:A50,"Paid")', '=COUNTIF(A2:A50,"Paid")', '=SUMIF(A2:A50)', '=IF(A2:A50="Paid")'], 1],
    ['To show only last month\'s sales from a long list, the quickest tool is:', ['Filter', 'Freeze panes', 'Merge cells', 'Page layout'], 0],
    ['A cell shows ##### after you type a date. What is the likely fix?', ['Delete the date', 'Widen the column', 'Change the font colour', 'Restart Excel'], 1]
  ],
  service: [
    ['A customer received the wrong size. Your first message should:', ['Ask why they ordered the wrong size', 'Apologise and offer an exchange or the next step', 'Tell them returns are not allowed', 'Wait for them to message again'], 1],
    ['Two customers need help at once at the counter. Best action?', ['Serve the louder one first', 'Greet both, then help them in order', 'Ignore both until you are free', 'Ask them to come back later'], 1],
    ['A customer is rude on chat. You should:', ['Reply rudely so they stop', 'Stay calm, keep to facts, and offer help', 'Block them at once', 'Share the chat on social media'], 1],
    ['You promised a call back by 3 pm but you have no answer yet. You:', ['Do not call until you have the answer', 'Call at 3 pm, give an update and a new time', 'Ask a colleague to lie for you', 'Send a sticker'], 1]
  ],
  english: [
    ['Choose the correct sentence for a work email.', ['I am attach the report.', 'I have attached the report.', 'I attaching the report.', 'I attached report yesterday the.'], 1],
    ['Which reply best confirms a meeting?', ['ok', 'Yes, see you.', 'Thank you. I confirm the meeting on Monday at 10 am.', 'Maybe I will come.'], 2],
    ['"The deadline has been extended" means:', ['There is more time', 'The work is cancelled', 'The work is late', 'The deadline is earlier'], 0],
    ['Which is the best way to start a formal email to someone you do not know?', ['Hey!', 'Dear Ms Sharma,', 'Yo Sharma', 'To whom it may concern bro'], 1]
  ],
  digital: [
    ['A caller says they are from your bank and asks for your OTP code. You should:', ['Give the code quickly', 'Refuse and call the bank on its official number', 'Send it by SMS instead', 'Post it in a group to ask'], 1],
    ['Which is the safest place to save work files you share with a team?', ['A shared cloud folder with access only for the team', 'A public social media post', 'A USB stick left at the office', 'Your personal chat with a stranger'], 0],
    ['A job ad asks you to pay Rs 5,000 for "training kit" before the interview. This is:', ['Normal', 'A warning sign of a scam', 'A government fee', 'A salary advance'], 1],
    ['You finished using a shared computer. Before leaving you should:', ['Leave your email open', 'Log out of every account', 'Save your password in the browser', 'Turn off the screen only'], 1]
  ]
};
export const SKILL_KEYS = ['excel', 'service', 'english', 'digital'];
export const PASS_MARK = 60;

// Picks up to 8 questions for a job: skills with a higher weight get more questions.
export function testFor(job) {
  const w = (job && job.skills) || {};
  const ranked = SKILL_KEYS.filter(k => (+w[k] || 0) > 0).sort((a, b) => (+w[b] || 0) - (+w[a] || 0));
  const skills = ranked.length ? ranked : SKILL_KEYS;
  const per = skills.length === 1 ? 4 : skills.length === 2 ? 4 : 2;
  const out = [];
  skills.forEach((k, i) => {
    const n = i === 0 && skills.length >= 3 ? 3 : per;
    MOCK[k].slice(0, n).forEach((q, j) => out.push({ key: `${k}.${j}`, skill: k, q: q[0], opts: q[1], a: q[2] }));
  });
  return out.slice(0, 8);
}
