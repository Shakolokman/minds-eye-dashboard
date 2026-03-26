'use client';
import { useState, useEffect } from 'react';
import { getTeam, addEntry, ROLE_LABELS } from '@/lib/store';

const StarRating = ({ value, onChange, label, low = 'Bad', high = 'Great' }) => (
  <div className="mb-5">
    <label className="block text-sm font-medium text-white mb-2">{label}</label>
    <div className="flex items-center gap-1">
      {[1,2,3,4,5,6,7,8,9,10].map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={`w-7 h-7 rounded transition-all text-xs font-bold ${n <= value ? 'bg-brand-gold text-brand-darkest' : 'bg-brand-slate/40 text-brand-muted hover:bg-brand-slate/60'}`}>
          {n}
        </button>
      ))}
    </div>
    <div className="flex justify-between text-xs text-brand-muted mt-1"><span>{low}</span><span>{high}</span></div>
  </div>
);

const Field = ({ label, required, children }) => (
  <div className="mb-4">
    <label className="block text-sm font-medium text-white mb-1.5">{label}{required && <span className="text-brand-gold ml-0.5">*</span>}</label>
    {children}
  </div>
);

const RadioGroup = ({ label, required, options, value, onChange }) => (
  <Field label={label} required={required}>
    <div className="flex gap-3">
      {options.map(opt => (
        <button key={opt.value} type="button" onClick={() => onChange(opt.value)}
          className={`flex-1 py-2.5 rounded-lg text-sm font-medium border transition-all ${
            value === opt.value ? 'bg-brand-gold/15 border-brand-gold/50 text-brand-gold' : 'bg-brand-darker border-brand-slate/40 text-brand-muted hover:border-brand-slate/60'
          }`}>
          {opt.label}
        </button>
      ))}
    </div>
  </Field>
);

export default function SubmitPage() {
  const [team, setTeam] = useState([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [mounted, setMounted] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    winOfDay: '', hoursWorked: '', timeManagement: 0, performance: 0, analyzeDay: '',
    outbounds: '', inbounds: '', followUpsFirst: '', followUpsInConvo: '', replies: '',
    qualifiedConvos: '', pitchedCalls: '', bookingLinksSent: '', bookedTC: '', bookedSC: '', notes: '',
    // Triage
    leadName: '', leadEmail: '', showUp: '', qualified: '', bookedForSC: '',
    leadQuality: 0, callNotes: '', callRecording: '',
    // Closer
    closed: '', totalDealSize: '', cashCollected: '', paymentDetails: '',
    discoveryRating: 0, pitchRating: 0, objectionRating: 0, performanceNotes: '',
  });

  useEffect(() => { setTeam(getTeam()); setMounted(true); }, []);

  const member = team.find(m => m.id === selectedMember);
  const role = member?.role;

  const updateForm = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedMember) return;
    addEntry({ ...form, memberId: selectedMember, formType: role });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setForm(prev => ({
        ...prev, date: new Date().toISOString().split('T')[0],
        winOfDay: '', hoursWorked: '', timeManagement: 0, performance: 0, analyzeDay: '',
        outbounds: '', inbounds: '', followUpsFirst: '', followUpsInConvo: '', replies: '',
        qualifiedConvos: '', pitchedCalls: '', bookingLinksSent: '', bookedTC: '', bookedSC: '', notes: '',
        leadName: '', leadEmail: '', showUp: '', qualified: '', bookedForSC: '',
        leadQuality: 0, callNotes: '', callRecording: '',
        closed: '', totalDealSize: '', cashCollected: '', paymentDetails: '',
        discoveryRating: 0, pitchRating: 0, objectionRating: 0, performanceNotes: '',
      }));
      if (role === 'setter' || role === 'outbound') setSelectedMember('');
    }, 2000);
  };

  if (!mounted) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-2 border-brand-gold border-t-transparent rounded-full animate-spin" /></div>;

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center animate-slide-up">
          <div className="w-16 h-16 bg-brand-gold/15 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h2 className="text-xl font-display font-bold text-white mb-1">Report Submitted!</h2>
          <p className="text-brand-muted text-sm">{role === 'setter' || role === 'outbound' ? 'Redirecting...' : 'Submit another call report or go back.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-display font-bold text-white mb-1">Submit Report</h1>
      <p className="text-sm text-brand-muted mb-6">Select your name to see your form.</p>

      {/* Member Selection */}
      <Field label="Who are you?" required>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {team.map(m => (
            <button key={m.id} type="button" onClick={() => setSelectedMember(m.id)}
              className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-left ${
                selectedMember === m.id ? 'bg-brand-gold/10 border-brand-gold/50' : 'bg-brand-darker border-brand-slate/30 hover:border-brand-slate/50'
              }`}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-brand-darkest flex-shrink-0" style={{ backgroundColor: m.color }}>
                {m.name[0]}
              </div>
              <div>
                <p className={`text-sm font-medium ${selectedMember === m.id ? 'text-brand-gold' : 'text-white'}`}>{m.name}</p>
                <p className="text-xs text-brand-muted">{ROLE_LABELS[m.role]}</p>
              </div>
            </button>
          ))}
        </div>
      </Field>

      {/* Form */}
      {role && (
        <form onSubmit={handleSubmit} className="mt-6 animate-fade-in">
          <div className="bg-brand-surface border border-brand-slate/30 rounded-xl p-6">
            <h2 className="text-lg font-display font-bold text-white mb-1">
              {role === 'setter' && 'DM Setter EOD Report'}
              {role === 'outbound' && 'Outbound Report'}
              {role === 'triager' && 'Triage Call Report'}
              {role === 'closer' && 'Sales Call Report'}
            </h2>
            <p className="text-xs text-brand-muted mb-5">
              {(role === 'setter' || role === 'outbound') ? 'One report per day' : 'One report per call'}
            </p>

            {/* Date */}
            <Field label="Report Date" required>
              <input type="date" className="input-field" value={form.date} onChange={e => updateForm('date', e.target.value)} required />
            </Field>

            {/* ========== SETTER FORM ========== */}
            {role === 'setter' && (
              <>
                <Field label="Win of the Day 🏆" required>
                  <input className="input-field" value={form.winOfDay} onChange={e => updateForm('winOfDay', e.target.value)} placeholder="What was your biggest win today?" required />
                </Field>
                <Field label="Hours Worked" required>
                  <input className="input-field" value={form.hoursWorked} onChange={e => updateForm('hoursWorked', e.target.value)} placeholder="e.g. 3pm - 11pm" required />
                </Field>
                <StarRating label="Time Management" value={form.timeManagement} onChange={v => updateForm('timeManagement', v)} />
                <StarRating label="Performance Satisfaction" value={form.performance} onChange={v => updateForm('performance', v)} />
                <Field label="Analyze Your Day" required>
                  <textarea className="input-field min-h-[80px]" value={form.analyzeDay} onChange={e => updateForm('analyzeDay', e.target.value)} placeholder="What went well? What can be improved?" required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Outbounds" required><input type="number" className="input-field" value={form.outbounds} onChange={e => updateForm('outbounds', e.target.value)} required /></Field>
                  <Field label="Inbounds" required><input type="number" className="input-field" value={form.inbounds} onChange={e => updateForm('inbounds', e.target.value)} required /></Field>
                  <Field label="Follow Ups (1st msg)" required><input type="number" className="input-field" value={form.followUpsFirst} onChange={e => updateForm('followUpsFirst', e.target.value)} required /></Field>
                  <Field label="Follow Ups (In convo)" required><input type="number" className="input-field" value={form.followUpsInConvo} onChange={e => updateForm('followUpsInConvo', e.target.value)} required /></Field>
                  <Field label="Replies" required><input type="number" className="input-field" value={form.replies} onChange={e => updateForm('replies', e.target.value)} required /></Field>
                  <Field label="Qualified Convos" required><input type="number" className="input-field" value={form.qualifiedConvos} onChange={e => updateForm('qualifiedConvos', e.target.value)} required /></Field>
                  <Field label="Pitched Calls" required><input type="number" className="input-field" value={form.pitchedCalls} onChange={e => updateForm('pitchedCalls', e.target.value)} required /></Field>
                  <Field label="Booking Links Sent" required><input type="number" className="input-field" value={form.bookingLinksSent} onChange={e => updateForm('bookingLinksSent', e.target.value)} required /></Field>
                  <Field label="Triage Calls Booked" required><input type="number" className="input-field" value={form.bookedTC} onChange={e => updateForm('bookedTC', e.target.value)} required /></Field>
                  <Field label="Sales Calls Booked" required><input type="number" className="input-field" value={form.bookedSC} onChange={e => updateForm('bookedSC', e.target.value)} required /></Field>
                </div>
                <Field label="Notes"><textarea className="input-field min-h-[60px]" value={form.notes} onChange={e => updateForm('notes', e.target.value)} /></Field>
              </>
            )}

            {/* ========== OUTBOUND FORM ========== */}
            {role === 'outbound' && (
              <>
                <Field label="Win of the Day 🏆"><input className="input-field" value={form.winOfDay} onChange={e => updateForm('winOfDay', e.target.value)} /></Field>
                <Field label="Hours Worked" required>
                  <input className="input-field" value={form.hoursWorked} onChange={e => updateForm('hoursWorked', e.target.value)} placeholder="e.g. 3pm - 11pm" required />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Outbounds" required><input type="number" className="input-field" value={form.outbounds} onChange={e => updateForm('outbounds', e.target.value)} required /></Field>
                  <Field label="Follow Ups (1st msg)" required><input type="number" className="input-field" value={form.followUpsFirst} onChange={e => updateForm('followUpsFirst', e.target.value)} required /></Field>
                  <Field label="Follow Ups (In convo)"><input type="number" className="input-field" value={form.followUpsInConvo} onChange={e => updateForm('followUpsInConvo', e.target.value)} /></Field>
                </div>
                <Field label="Notes"><textarea className="input-field min-h-[60px]" value={form.notes} onChange={e => updateForm('notes', e.target.value)} /></Field>
              </>
            )}

            {/* ========== TRIAGE FORM ========== */}
            {role === 'triager' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Lead Name" required><input className="input-field" value={form.leadName} onChange={e => updateForm('leadName', e.target.value)} required /></Field>
                  <Field label="Lead Email" required><input type="email" className="input-field" value={form.leadEmail} onChange={e => updateForm('leadEmail', e.target.value)} required /></Field>
                </div>
                <RadioGroup label="Show up?" required options={[{value:'live',label:'Live Call'},{value:'noshow',label:'No Show'}]} value={form.showUp} onChange={v => updateForm('showUp', v)} />
                {form.showUp === 'live' && (
                  <>
                    <RadioGroup label="Qualified triage?" required options={[{value:'yes',label:'Yes'},{value:'no',label:'No'}]} value={form.qualified} onChange={v => updateForm('qualified', v)} />
                    <RadioGroup label="Booked in for sales call?" required options={[{value:'yes',label:'Yes'},{value:'no',label:'No'}]} value={form.bookedForSC} onChange={v => updateForm('bookedForSC', v)} />
                    <StarRating label="Lead Quality" value={form.leadQuality} onChange={v => updateForm('leadQuality', v)} low="DQ" high="Super qualified" />
                  </>
                )}
                <Field label="Quick explanation of the call"><textarea className="input-field min-h-[80px]" value={form.callNotes} onChange={e => updateForm('callNotes', e.target.value)} /></Field>
                <Field label="Call Recording Link"><input className="input-field" value={form.callRecording} onChange={e => updateForm('callRecording', e.target.value)} placeholder="https://..." /></Field>
              </>
            )}

            {/* ========== CLOSER FORM ========== */}
            {role === 'closer' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Lead Name" required><input className="input-field" value={form.leadName} onChange={e => updateForm('leadName', e.target.value)} required /></Field>
                  <Field label="Lead Email" required><input type="email" className="input-field" value={form.leadEmail} onChange={e => updateForm('leadEmail', e.target.value)} required /></Field>
                </div>
                <RadioGroup label="Show up?" required options={[{value:'live',label:'Live Call'},{value:'noshow',label:'No Show'}]} value={form.showUp} onChange={v => updateForm('showUp', v)} />
                {form.showUp === 'live' && (
                  <>
                    <RadioGroup label="Closed?" required options={[{value:'yes',label:'Yes'},{value:'no',label:'No'}]} value={form.closed} onChange={v => updateForm('closed', v)} />
                    {form.closed === 'yes' && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Total Deal Size" required><input type="number" className="input-field" value={form.totalDealSize} onChange={e => updateForm('totalDealSize', e.target.value)} placeholder="$" required /></Field>
                          <Field label="Cash Collected on Call" required>
                            <input type="number" className="input-field" value={form.cashCollected} onChange={e => updateForm('cashCollected', e.target.value)} placeholder="$" required />
                            <p className="text-xs text-brand-muted mt-1">Initial payment collected. Stripe will track recurring payments separately.</p>
                          </Field>
                        </div>
                        <Field label="Payment Details (PIF / deposit / split pay)" required>
                          <textarea className="input-field min-h-[60px]" value={form.paymentDetails} onChange={e => updateForm('paymentDetails', e.target.value)} placeholder='e.g. PIF or "$2000 × 3 every 30 days"' required />
                        </Field>
                      </>
                    )}
                    <StarRating label="Lead Quality" value={form.leadQuality} onChange={v => updateForm('leadQuality', v)} />
                    <Field label="General notes from the call"><textarea className="input-field min-h-[80px]" value={form.callNotes} onChange={e => updateForm('callNotes', e.target.value)} /></Field>
                    <StarRating label="Rate your Discovery" value={form.discoveryRating} onChange={v => updateForm('discoveryRating', v)} />
                    <StarRating label="Rate your Pitch" value={form.pitchRating} onChange={v => updateForm('pitchRating', v)} />
                    <StarRating label="Rate your Objection Handling" value={form.objectionRating} onChange={v => updateForm('objectionRating', v)} />
                    <Field label="Performance notes"><textarea className="input-field min-h-[60px]" value={form.performanceNotes} onChange={e => updateForm('performanceNotes', e.target.value)} placeholder="What went well? What to improve?" /></Field>
                    <Field label="Call Recording Link"><input className="input-field" value={form.callRecording} onChange={e => updateForm('callRecording', e.target.value)} placeholder="https://..." /></Field>
                  </>
                )}
              </>
            )}

            <button type="submit" className="btn-gold w-full mt-4 text-sm">Submit Report</button>
          </div>
        </form>
      )}
    </div>
  );
}
