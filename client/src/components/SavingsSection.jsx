import { useEffect, useState } from 'react';
import { api } from '../api';

function ContributionForm({ onSubmit }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!amount) return;
    setBusy(true);
    try {
      await onSubmit({ amount: Number(amount), note: note.trim() || null });
      setAmount('');
      setNote('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inline-form" onSubmit={handleSubmit}>
      <input
        type="number"
        min="0.01"
        step="0.01"
        placeholder="Iznos uplate"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <input type="text" placeholder="Napomena (opciono)" value={note} onChange={(e) => setNote(e.target.value)} />
      <button type="submit" disabled={busy}>
        Uplati
      </button>
    </form>
  );
}

export default function SavingsSection({ groupId }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [busy, setBusy] = useState(false);

  function loadGoals() {
    setLoading(true);
    api
      .listSavingsGoals(groupId)
      .then(({ goals }) => setGoals(goals))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadGoals, [groupId]);

  async function handleCreateGoal(e) {
    e.preventDefault();
    if (!goalName.trim() || !goalTarget) return;
    setBusy(true);
    setError('');
    try {
      await api.createSavingsGoal(groupId, { name: goalName.trim(), targetAmount: Number(goalTarget) });
      setGoalName('');
      setGoalTarget('');
      loadGoals();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteGoal(goalId) {
    setError('');
    try {
      await api.deleteSavingsGoal(groupId, goalId);
      loadGoals();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleAddContribution(goalId, payload) {
    setError('');
    try {
      await api.addContribution(groupId, goalId, payload);
      loadGoals();
    } catch (err) {
      setError(err.message);
      throw err;
    }
  }

  async function handleDeleteContribution(goalId, contributionId) {
    setError('');
    try {
      await api.deleteContribution(groupId, goalId, contributionId);
      loadGoals();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="card savings-card">
      <h2>Štednja</h2>
      {error && <p className="error">{error}</p>}

      <form className="stacked-form" onSubmit={handleCreateGoal}>
        <label>
          Naziv cilja
          <input
            type="text"
            placeholder="npr. Odmor"
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
          />
        </label>
        <label>
          Ciljani iznos
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="npr. 200000"
            value={goalTarget}
            onChange={(e) => setGoalTarget(e.target.value)}
          />
        </label>
        <button type="submit" disabled={busy}>
          Dodaj cilj
        </button>
      </form>

      {loading ? (
        <p className="muted">Učitavanje...</p>
      ) : goals.length === 0 ? (
        <p className="muted">Još uvek nemaš nijedan cilj za štednju.</p>
      ) : (
        <div className="savings-goal-list">
          {goals.map((goal) => {
            const pct = Math.min(100, Math.round((goal.saved / goal.target_amount) * 100));
            return (
              <div key={goal.id} className="savings-goal">
                <div className="savings-goal-header">
                  <strong>{goal.name}</strong>
                  <button className="ghost small" onClick={() => handleDeleteGoal(goal.id)}>
                    Obriši cilj
                  </button>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${pct}%` }} />
                </div>
                <p className="muted">
                  {goal.saved.toFixed(2)} / {goal.target_amount.toFixed(2)} ({pct}%)
                </p>

                <ContributionForm onSubmit={(payload) => handleAddContribution(goal.id, payload)} />

                {goal.contributions.length > 0 && (
                  <ul className="member-list">
                    {goal.contributions.map((c) => (
                      <li key={c.id}>
                        {c.contributed_on} — <strong>{c.amount.toFixed(2)}</strong>
                        {c.note ? ` (${c.note})` : ''} — {c.user_name}{' '}
                        <button className="ghost small" onClick={() => handleDeleteContribution(goal.id, c.id)}>
                          Obriši
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
