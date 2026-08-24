import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import SavingsSection from '../components/SavingsSection';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function GroupDashboard() {
  const { groupId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [month, setMonth] = useState(currentMonth());
  const [members, setMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(false);

  const [budgetInput, setBudgetInput] = useState('');
  const [newCategory, setNewCategory] = useState('');

  const [aiInsights, setAiInsights] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [membersRes, categoriesRes, expensesRes, summaryRes] = await Promise.all([
        api.groupMembers(groupId),
        api.listCategories(groupId),
        api.listExpenses(groupId, { month }),
        api.summary(groupId, month),
      ]);
      setMembers(membersRes.members);
      setCategories(categoriesRes.categories);
      setExpenses(expensesRes.expenses);
      setSummary(summaryRes);
      setBudgetInput(summaryRes.budget != null ? String(summaryRes.budget) : '');
    } catch (err) {
      setError(err.message);
      if (err.message.includes('Niste clan')) navigate('/groups');
    } finally {
      setLoading(false);
    }
  }, [groupId, month, navigate]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    setAiInsights('');
    setAiError('');
  }, [groupId, month]);

  async function handleGenerateInsights() {
    setAiLoading(true);
    setAiError('');
    setAiInsights('');
    try {
      const { insights } = await api.aiInsights(groupId, month);
      setAiInsights(insights);
    } catch (err) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAddExpense(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.createExpense(groupId, {
        amount: Number(amount),
        note: note.trim() || null,
        spentOn,
        categoryId: categoryId || null,
      });
      setAmount('');
      setNote('');
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteExpense(id) {
    setError('');
    try {
      await api.deleteExpense(groupId, id);
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSetBudget(e) {
    e.preventDefault();
    setError('');
    try {
      await api.setBudget(groupId, { month, amount: Number(budgetInput) });
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddCategory(e) {
    e.preventDefault();
    if (!newCategory.trim()) return;
    setError('');
    try {
      await api.createCategory(groupId, { name: newCategory.trim() });
      setNewCategory('');
      await loadAll();
    } catch (err) {
      setError(err.message);
    }
  }

  const totalSpent = summary?.total || 0;
  const budget = summary?.budget;
  const budgetPct = budget ? Math.min(100, Math.round((totalSpent / budget) * 100)) : null;
  const budgetOver = budget != null && totalSpent > budget;

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <Link to="/groups" className="back-link">
            &larr; Sve grupe
          </Link>
        </div>
        <div className="topbar-user">
          <span>{user?.name}</span>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="month-picker">
        <label>
          Mesec
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
      </div>

      {loading ? (
        <p>Ucitavanje...</p>
      ) : (
        <>
          <div className="grid-2">
            <div className="card">
              <h2>Pregled za {month}</h2>
              <p className="total-amount">{totalSpent.toFixed(2)}</p>
              {budget != null ? (
                <>
                  <div className="progress-bar">
                    <div
                      className={`progress-fill ${budgetOver ? 'over' : ''}`}
                      style={{ width: `${budgetPct}%` }}
                    />
                  </div>
                  <p className="muted">
                    {budgetOver
                      ? `Prekoraceno za ${(totalSpent - budget).toFixed(2)}`
                      : `Preostalo ${(budget - totalSpent).toFixed(2)} od budzeta ${budget.toFixed(2)}`}
                  </p>
                </>
              ) : (
                <p className="muted">Budzet za ovaj mesec nije postavljen.</p>
              )}
              <form className="inline-form" onSubmit={handleSetBudget}>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Postavi mesecni budzet"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                />
                <button type="submit">Sacuvaj</button>
              </form>
            </div>

            <div className="card">
              <h2>Po kategorijama</h2>
              {summary?.byCategory?.length ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={summary.byCategory}
                      dataKey="total"
                      nameKey="name"
                      innerRadius={40}
                      outerRadius={80}
                    >
                      {summary.byCategory.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => value.toFixed(2)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="muted">Nema troskova za prikaz.</p>
              )}
            </div>
          </div>

          <div className="card ai-card">
            <h2>AI saveti za stednju</h2>
            <p className="muted">
              Zatrazi kratku AI analizu tvoje potrosnje za {month} i predloge kako da ustedis.
            </p>
            <button onClick={handleGenerateInsights} disabled={aiLoading}>
              {aiLoading ? 'Generisanje...' : 'Generisi AI savete'}
            </button>
            {aiError && <p className="error">{aiError}</p>}
            {aiInsights && <div className="ai-insights">{aiInsights}</div>}
          </div>

          <div className="grid-2">
            <div className="card">
              <h2>Dodaj trosak</h2>
              <form className="stacked-form" onSubmit={handleAddExpense}>
                <label>
                  Iznos
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Datum
                  <input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} required />
                </label>
                <label>
                  Kategorija
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                    <option value="">Bez kategorije</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Napomena
                  <input type="text" value={note} onChange={(e) => setNote(e.target.value)} />
                </label>
                <button type="submit" disabled={busy}>
                  {busy ? 'Dodavanje...' : 'Dodaj'}
                </button>
              </form>

              <form className="inline-form" onSubmit={handleAddCategory}>
                <input
                  type="text"
                  placeholder="Nova kategorija"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
                <button type="submit">Dodaj kategoriju</button>
              </form>
            </div>

            <div className="card">
              <h2>Clanovi grupe</h2>
              <ul className="member-list">
                {members.map((m) => (
                  <li key={m.id}>
                    {m.name} <span className="muted">({m.role === 'owner' ? 'vlasnik' : 'clan'})</span>
                  </li>
                ))}
              </ul>
              {summary?.byUser?.length > 0 && (
                <>
                  <h3>Potrosnja po osobi</h3>
                  <ul className="member-list">
                    {summary.byUser.map((u) => (
                      <li key={u.id}>
                        {u.name}: <strong>{u.total.toFixed(2)}</strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          <SavingsSection groupId={groupId} />

          <div className="card">
            <h2>Troskovi</h2>
            {expenses.length === 0 ? (
              <p className="muted">Nema troskova za izabrani mesec.</p>
            ) : (
              <table className="expense-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Kategorija</th>
                    <th>Ko</th>
                    <th>Napomena</th>
                    <th>Iznos</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td>{exp.spent_on}</td>
                      <td>
                        {exp.category_name && (
                          <span className="tag" style={{ backgroundColor: exp.category_color }}>
                            {exp.category_name}
                          </span>
                        )}
                      </td>
                      <td>{exp.user_name}</td>
                      <td>{exp.note}</td>
                      <td>{exp.amount.toFixed(2)}</td>
                      <td>
                        {exp.user_id === user.id && (
                          <button className="ghost small" onClick={() => handleDeleteExpense(exp.id)}>
                            Obrisi
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
