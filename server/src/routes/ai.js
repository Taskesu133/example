import { Router } from 'express';
import OpenAI from 'openai';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { requireGroupMember } from '../middleware/membership.js';

const router = Router({ mergeParams: true });
router.use(requireAuth, requireGroupMember);

let client = null;
function getClient() {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: 'https://api.deepseek.com',
    });
  }
  return client;
}

router.get('/insights', async (req, res) => {
  const deepseek = getClient();
  if (!deepseek) {
    return res.status(503).json({
      error: 'AI funkcija nije podesena. Postavite DEEPSEEK_API_KEY u server/.env da biste je omogucili.',
    });
  }

  const month = req.query.month || new Date().toISOString().slice(0, 7);

  const byCategory = db
    .prepare(
      `SELECT COALESCE(c.name, 'Bez kategorije') AS name, SUM(e.amount) AS total
       FROM expenses e LEFT JOIN categories c ON c.id = e.category_id
       WHERE e.group_id = ? AND substr(e.spent_on, 1, 7) = ?
       GROUP BY e.category_id ORDER BY total DESC`
    )
    .all(req.groupId, month);

  const totalRow = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE group_id = ? AND substr(spent_on, 1, 7) = ?')
    .get(req.groupId, month);

  const budgetRow = db
    .prepare('SELECT amount FROM budgets WHERE group_id = ? AND month = ?')
    .get(req.groupId, month);

  if (byCategory.length === 0) {
    return res.json({ insights: 'Nema dovoljno podataka o troskovima za ovaj mesec da bih dao savete.' });
  }

  const dataSummary = [
    `Mesec: ${month}`,
    `Ukupno potroseno: ${totalRow.total.toFixed(2)}`,
    budgetRow ? `Mesecni budzet: ${budgetRow.amount.toFixed(2)}` : 'Mesecni budzet nije postavljen.',
    'Troskovi po kategorijama:',
    ...byCategory.map((c) => `- ${c.name}: ${c.total.toFixed(2)}`),
  ].join('\n');

  try {
    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content:
            'Ti si finansijski asistent u aplikaciji za licno budzetiranje. Na osnovu podataka o potrosnji, ' +
            'daj kratku, konkretnu analizu i 2-4 prakticna saveta za stednju, na srpskom jeziku. ' +
            'Budi konkretan i koristi brojeve iz podataka. Format: kratak pasus analize, zatim lista saveta sa crticama. ' +
            'Nemoj izmisljati podatke koji nisu dati.',
        },
        { role: 'user', content: `Evo podataka o mojoj potrosnji:\n\n${dataSummary}` },
      ],
    });

    const text = completion.choices[0]?.message?.content || '';
    res.json({ insights: text || 'Nisam uspeo da generisem savete, pokusajte ponovo.' });
  } catch (err) {
    console.error('AI insights error:', err);
    res.status(502).json({ error: 'Greska prilikom komunikacije sa AI servisom. Pokusajte kasnije.' });
  }
});

export default router;
