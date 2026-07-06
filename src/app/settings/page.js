'use client';
import { useState, useEffect } from 'react';
import { getTeam, addTeamMember, removeTeamMember, updateTeamMemberRoles, ROLE_LABELS, ROLE_COLORS, ALL_ROLES } from '@/lib/store';

// Toggle chips for picking one or more roles. `selected` is an array of role keys.
function RoleChips({ selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ALL_ROLES.map(r => {
        const on = selected.includes(r);
        return (
          <button
            key={r}
            type="button"
            onClick={() => onToggle(r)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
              on
                ? 'bg-brand-gold/15 border-brand-gold/50 text-brand-gold'
                : 'bg-brand-darker border-brand-slate/40 text-brand-muted hover:border-brand-slate/60'
            }`}
          >
            {on ? '✓ ' : ''}{ROLE_LABELS[r]}
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  const [team, setTeam] = useState([]);
  const [mounted, setMounted] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', roles: ['setter'] });
  const [editId, setEditId] = useState(null);
  const [editRoles, setEditRoles] = useState([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { async function load() { setTeam(await getTeam()); setMounted(true); } load(); }, []);

  const toggleIn = (arr, r) => arr.includes(r) ? arr.filter(x => x !== r) : [...arr, r];

  const handleAdd = async (e) => {
    e.preventDefault();
    if (newMember.roles.length === 0) return;
    setLoading(true);
    await addTeamMember(newMember);
    setTeam(await getTeam());
    setNewMember({ name: '', email: '', roles: ['setter'] });
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

  const startEdit = (member) => {
    setEditId(member.id);
    setEditRoles(member.roles && member.roles.length ? member.roles : (member.role ? [member.role] : []));
  };

  const handleRolesSave = async () => {
    if (editRoles.length === 0) return;
    setLoading(true);
    await updateTeamMemberRoles(editId, editRoles);
    setTeam(await getTeam());
    setEditId(null);
    setEditRoles([]);
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
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="flex gap-3 flex-wrap">
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-brand-muted mb-1 block">Name</label>
                  <input className="input-field text-sm" value={newMember.name} onChange={e => setNewMember(f => ({...f, name: e.target.value}))} placeholder="Full name" required />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <label className="text-xs text-brand-muted mb-1 block">Email</label>
                  <input type="email" className="input-field text-sm" value={newMember.email} onChange={e => setNewMember(f => ({...f, email: e.target.value}))} placeholder="email@..." required />
                </div>
              </div>
              <div>
                <label className="text-xs text-brand-muted mb-1.5 block">Roles <span className="text-brand-muted/60">(pick one or more)</span></label>
                <RoleChips selected={newMember.roles} onToggle={r => setNewMember(f => ({...f, roles: toggleIn(f.roles, r)}))} />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-gold text-sm" disabled={loading || newMember.roles.length === 0}>{loading ? 'Saving...' : 'Add'}</button>
                <button type="button" onClick={() => setShowAdd(false)} className="btn-outline text-sm">Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Team List */}
        <div className="divide-y divide-brand-slate/10">
          {team.map((member) => (
            <div key={member.id} className="px-5 py-4 hover:bg-brand-slate/5 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-brand-darkest flex-shrink-0" style={{ backgroundColor: member.color }}>
                  {member.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{member.name}</p>
                  <p className="text-xs text-brand-muted">{member.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {editId !== member.id && (
                    <div className="flex flex-wrap gap-1 justify-end max-w-[280px]">
                      {(member.roles && member.roles.length ? member.roles : [member.role]).map(r => (
                        <span key={r} className={`text-xs px-2.5 py-1 rounded-full text-white ${ROLE_COLORS[r] || 'bg-brand-slate'}`}>
                          {ROLE_LABELS[r] || r}
                        </span>
                      ))}
                    </div>
                  )}
                  {editId !== member.id && (
                    <button onClick={() => startEdit(member)} className="text-brand-muted hover:text-brand-gold transition-colors p-1.5 rounded-lg hover:bg-brand-gold/10" title="Edit roles">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
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

              {/* Inline role editor */}
              {editId === member.id && (
                <div className="mt-3 pl-14 animate-fade-in">
                  <label className="text-xs text-brand-muted mb-1.5 block">Roles <span className="text-brand-muted/60">(pick one or more)</span></label>
                  <RoleChips selected={editRoles} onToggle={r => setEditRoles(prev => toggleIn(prev, r))} />
                  <div className="flex gap-2 mt-3">
                    <button onClick={handleRolesSave} className="btn-gold text-xs" disabled={loading || editRoles.length === 0}>{loading ? 'Saving...' : 'Save roles'}</button>
                    <button onClick={() => { setEditId(null); setEditRoles([]); }} className="btn-outline text-xs">Cancel</button>
                  </div>
                </div>
              )}
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
              <p className="text-sm font-medium text-white">Stripe + FanBasis</p>
              <p className="text-xs text-brand-muted">Auto-import payments, refunds, and subscriptions</p>
            </div>
            <span className="text-xs px-2 py-1 rounded-full bg-emerald-900/30 text-emerald-400 border border-emerald-600/30">Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
