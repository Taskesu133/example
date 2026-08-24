import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { dbGet, dbRun, getAutomationState, setAutomationState } from '../db.js';
import { parseYettelEmail } from './parseYettelEmail.js';

const SENDER = process.env.BANK_SENDER_EMAIL || 'yettelbank@yettelbank.rs';
const INITIAL_LOOKBACK_DAYS = 30;
const MIN_POLL_INTERVAL_MS = 15 * 60 * 1000; // ne cesce od jednom u 15 min

let running = false;

function isConfigured() {
  return Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && process.env.AUTOMATION_GROUP_NAME);
}

async function applyExpense(groupId, userId, parsed) {
  await dbRun(
    'INSERT INTO expenses (group_id, user_id, category_id, amount, note, spent_on) VALUES (?, ?, NULL, ?, ?, ?)',
    [groupId, userId, parsed.amount, parsed.note, parsed.spentOn]
  );
}

async function applyIncome(groupId, parsed) {
  const existing = await dbGet('SELECT amount FROM budgets WHERE group_id = ? AND month = ?', [
    groupId,
    parsed.month,
  ]);
  const newAmount = (existing ? existing.amount : 0) + parsed.amount;
  await dbRun(
    `INSERT INTO budgets (group_id, month, amount) VALUES (?, ?, ?)
     ON CONFLICT(group_id, month) DO UPDATE SET amount = excluded.amount`,
    [groupId, parsed.month, newAmount]
  );
}

// Pokusava jedan prolaz kroz nove mejlove. Tiha no-op ako automatizacija nije
// podesena (nedostaju env promenljive) - ne baca gresku da ne bi ometala
// ostatak aplikacije.
export async function runGmailImportOnce() {
  if (!isConfigured()) return { skipped: 'not-configured' };
  if (running) return { skipped: 'already-running' };
  running = true;

  try {
    const group = await dbGet('SELECT id, owner_id FROM groups WHERE lower(name) = lower(?)', [
      process.env.AUTOMATION_GROUP_NAME,
    ]);
    if (!group) {
      console.error(`Gmail import: grupa "${process.env.AUTOMATION_GROUP_NAME}" nije pronadjena.`);
      return { skipped: 'group-not-found' };
    }

    const client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
      logger: false,
      connectionTimeout: 20000,
      greetingTimeout: 20000,
    });

    let processed = 0;
    let skipped = 0;

    await client.connect();
    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        const lastUidRaw = await getAutomationState('gmail_last_uid');
        const searchCriteria = { from: SENDER };
        if (lastUidRaw) {
          searchCriteria.uid = `${Number(lastUidRaw) + 1}:*`;
        } else {
          const since = new Date(Date.now() - INITIAL_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
          searchCriteria.since = since;
        }

        const uids = await client.search(searchCriteria, { uid: true });
        let maxUid = lastUidRaw ? Number(lastUidRaw) : 0;

        if (uids && uids.length > 0) {
          for await (const msg of client.fetch(uids, { source: true, envelope: true }, { uid: true })) {
            maxUid = Math.max(maxUid, msg.uid);
            try {
              const parsed = await simpleParser(msg.source);
              const result = parseYettelEmail({
                subject: parsed.subject,
                text: parsed.text,
                date: parsed.date,
              });
              if (!result) {
                skipped++;
                continue;
              }
              if (result.type === 'expense') {
                await applyExpense(group.id, group.owner_id, result);
              } else if (result.type === 'income') {
                await applyIncome(group.id, result);
              }
              processed++;
            } catch (err) {
              console.error('Gmail import: greska pri obradi poruke', msg.uid, err);
              skipped++;
            }
          }
        }

        await setAutomationState('gmail_last_uid', String(maxUid));
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }

    await setAutomationState('gmail_last_poll_at', new Date().toISOString());
    console.log(`Gmail import: obradjeno ${processed}, preskoceno ${skipped}.`);
    return { processed, skipped };
  } catch (err) {
    console.error('Gmail import error:', err);
    return { error: String(err) };
  } finally {
    running = false;
  }
}

// Poziva se iz health-check rute. Ne blokira odgovor - pokrece proveru u
// pozadini najvise jednom u MIN_POLL_INTERVAL_MS, tako da spoljni "keep alive"
// ping (npr. UptimeRobot) sluzi i kao okidac za citanje mejlova.
export function maybeTriggerGmailImport() {
  if (!isConfigured()) return;
  getAutomationState('gmail_last_poll_at')
    .then((lastPollAt) => {
      const last = lastPollAt ? new Date(lastPollAt).getTime() : 0;
      if (Date.now() - last < MIN_POLL_INTERVAL_MS) return;
      runGmailImportOnce().catch((err) => console.error('Gmail import trigger error:', err));
    })
    .catch((err) => console.error('Gmail import state check error:', err));
}
