import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function Groups() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [busy, setBusy] = useState(false);

  const [automationToken, setAutomationToken] = useState('');
  const [automationBusy, setAutomationBusy] = useState(false);
  const [automationError, setAutomationError] = useState('');

  function loadGroups() {
    setLoading(true);
    api
      .listGroups()
      .then(({ groups }) => setGroups(groups))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadGroups, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { group } = await api.createGroup(newGroupName.trim());
      setNewGroupName('');
      loadGroups();
      navigate(`/groups/${group.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    setBusy(true);
    setError('');
    try {
      const { group } = await api.joinGroup(inviteCode.trim());
      setInviteCode('');
      loadGroups();
      navigate(`/groups/${group.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateAutomationToken() {
    setAutomationBusy(true);
    setAutomationError('');
    try {
      const { token } = await api.automationToken();
      setAutomationToken(token);
    } catch (err) {
      setAutomationError(err.message);
    } finally {
      setAutomationBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>BudgetAI</h1>
        <div className="topbar-user">
          <span>{user?.name}</span>
          <button className="ghost" onClick={logout}>
            Odjava
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="grid-2">
        <form className="card" onSubmit={handleCreate}>
          <h2>Nova grupa</h2>
          <label>
            Naziv grupe
            <input
              type="text"
              placeholder="npr. Kucni budzet"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
            />
          </label>
          <button type="submit" disabled={busy}>
            Kreiraj
          </button>
        </form>

        <form className="card" onSubmit={handleJoin}>
          <h2>Pridruzi se grupi</h2>
          <label>
            Kod za pridruzivanje
            <input
              type="text"
              placeholder="npr. 47DCB081"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
            />
          </label>
          <button type="submit" disabled={busy}>
            Pridruzi se
          </button>
        </form>
      </div>

      <h2>Grupe</h2>
      {loading ? (
        <p>Ucitavanje...</p>
      ) : groups.length === 0 ? (
        <p className="muted">Jos uvek nemate nijednu grupu. Kreirajte je iznad ili se pridruzite postojecoj.</p>
      ) : (
        <ul className="group-list">
          {groups.map((g) => (
            <li key={g.id}>
              <Link to={`/groups/${g.id}`} className="group-item">
                <div>
                  <strong>{g.name}</strong>
                  <span className="muted"> · {g.member_count} clan(ova)</span>
                </div>
                <span className="badge">{g.invite_code}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <h2>Automatizacija</h2>
      <div className="card">
        <p className="muted">
          Token za spoljne automatizacije (npr. skriptu koja cita bankovne mejlove i sama dodaje
          troskove preko API-ja). Cuvaj ga kao lozinku — svako ko ga ima moze da dodaje/brise troskove
          u tvoje ime.
        </p>
        <button onClick={handleGenerateAutomationToken} disabled={automationBusy}>
          {automationBusy ? 'Generisanje...' : 'Generisi automation token'}
        </button>
        {automationError && <p className="error">{automationError}</p>}
        {automationToken && (
          <div className="token-box">
            <code>{automationToken}</code>
          </div>
        )}
      </div>
    </div>
  );
}
