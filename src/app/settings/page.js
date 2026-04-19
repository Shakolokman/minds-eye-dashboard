'use client';
import { useState, useEffect } from 'react';
import { getTeam, addTeamMember, removeTeamMember, updateTeamMemberRole, ROLE_LABELS, ROLE_COLORS, MEMBER_COLORS } from '@/lib/store';

export default function SettingsPage() {
  const [team, setTeam] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', role: 'setter' });
  const [editId, setEditId] = useState(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { async function load() { setTeam(await getTeam()); setMounted(true); } load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);
    await addTeamMember(newMember);
    setTeam(await getTeam());
    setNewMember({ name: '', email: '', role: 'setter' });
    setShowAdd(false);
    setLoading(false);
    flashSaved();
  };

  const handleRemove = async (id) => {
    if (!confirm('Remove this team member? Their past entries will be kept.')) return;
    setLoading(true);
    await removeTeamMember(id);
    setTeam(await getTeam());
    setLoading(false);
    flashSaved();
  };

  const handleRoleChange = async (id, role) => {
    setLoading(true);
    await updateTeamMemberRole(id, role);
    setTeam(await getTeam());
    setEditId(null);
    setLoading(false);
    flashSaved();
  };

  const flashSaved = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  if (!mounted) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Settings</h1>
          <p className="text-sm text-brand-muted mt-0.5">Manage team members and roles</p>
        </div>
        {saved && (
          <span className="text-sm text-green-400 flex items-center gap-1 animate-fade-in">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Saved
          </span>
        )}
      </div>

      {/* Team Members */}
      <div className="bg-brand-surface border border-brand-slate/30 rounded-xl overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-brand-slate/20 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Team Members ({team.length})</h3>
          <button onClick={() => setShowAdd(!showAdd)} className="btn-gold text-xs flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Member
          </button>
        </div>

        {/* Add Member Form */}
        {showAdd && (
          <div className="p-5 border-b border-brand-slate/20 bg-brand-darker/50 animate-fade-in">
            <form onSubmit={handleAdd} className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs text-brand-muted mb-1 block">Name</label>
                <input className="input-field text-sm" value={newMember.name} onChange={e => setNewMember(f => ({...f, name: e.target.value}))} placeholder="Full name" required />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="text-xs text-brand-muted mb-1 block">Email</label>
                <input type="email" className="input-field text-sm" value={newMember.email} onChange={e => setNewMember(f => ({...f, email: e.target.value}))} placeholder="email@..." required />
              </div>
              <div className="w-40">
                <label className="text-xs text-brand-muted mb-1 block">Role</label>
                <select className="input-field text-sm" value={newMember.role} onChange={e => setNewMember(f => ({...f, role: e.target.value}))}>
                  <option value="setter">DM Setter</option>
                  <option value="outbound">Outbound</option>
                  <option value="triager">Triager</option>
                  <option value="closer">Closer</option>
                  <option value="phone_setter">Phone Setter</option>
                  <option value="call_tracker">Call Tracker</option>
                </select>
              </div>
              <button type="submit" className="btn-gold text-sm" disabled={loading}>{loading ? 'Saving...' : 'Add'}</button>
              <button type="button" onClick={() => setShowAdd(false)} className="btn-outline text-sm">Cancel</button>
            </form>
          </div>
        )}

        {/* Team List */}
        <div className="divide-y divide-brand-slate/10">
          {team.map((member) => (
            <div key={member.id} className="flex items-center gap-4 px-5 py-4 hover:bg-brand-slate/5 transition-colors">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-brand-darkest flex-shrink-0" style={{ backgroundColor: member.color }}>
                {member.name[0]}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{member.name}</p>
                <p className="text-xs text-brand-muted">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {editId === member.id ? (
                  <select
                    value={member.role}
                    onChange={e => handleRoleChange(member.id, e.target.value)}
                    className="bg-brand-darker border border-brand-gold/50 rounded-lg px-3 py-1.5 text-xs text-white"
                    autoFocus
                    onBlur={() => setEditId(null)}
                  >
                    <option value="setter">DM Setter</option>
                    <option value="outbound">Outbound</option>
                    <option value="triager">Triager</option>
                    <option value="closer">Closer</option>
                    <option value="phone_setter">Phone Setter</option>
                    <option value="call_tracker">Call Tracker</option>
                  </select>
                ) : (
                  <button
                    onClick={() => setEditId(member.id)}
                    className={`text-xs px-3 py-1 rounded-full text-white cursor-pointer hover:opacity-80 transition-opacity ${ROLE_COLORS[member.role] || 'bg-brand-slate'}`}
                  >
                    {ROLE_LABELS[member.role]}
                  </button>
                )}
                <button
                  onClick={() => handleRemove(member.id)}
                  className="text-brand-muted hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-red-400/10"
                  title="Remove member"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Integration Status */}
      <div className="bg-brand-surface border border-brand-slate/30 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Integrations</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-brand-darker rounded-lg border border-brand-slate/20">
            <span className="text-lg">🗄️</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Supabase Database</p>
              <p className="text-xs text-brand-muted">Shared database for all team members</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-600/30">Connected</span>
          </div>
          <div className="flex items-center gap-3 p-3 bg-brand-darker rounded-lg border border-brand-slate/20">
            <span className="text-lg">💳</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Stripe</p>
              <p className="text-xs text-brand-muted">Auto-import payments, refunds, and subscriptions</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-600/30">Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
