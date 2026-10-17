import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { ToastData, Tournament } from './types'
import { Button, fieldClass } from './components'
import { getCourse } from './data'
import { cardFor, entriesFor, groupsFor, leaderboard, roundHoles, setCardState, useLiveVersion } from './live'
import { formatClock, toPar } from './golf'
import { ScoreCell } from './screens/Leaderboard'
import {
  ACTOR_LABEL, INCIDENT_KINDS, PACE_LABEL, addIncidentNote, correctScore, incidentKindLabel, incidentsFor, logIncident,
  markerCardFor, markerOf, mismatches, paceFor, resolveIncident, scoreChangesFor, sendToCommittee, slotStatus, staffRoleOf,
  STAFF_ROLE_LABEL, useOpsVersion,
  type Actor, type GroupPace, type Incident, type IncidentKind, type IncidentStatus, type PaceStatus, type SlotStatus,
} from './ops'

/*
 * Tournament-day building blocks for the phone: marshals, officials and organisers use the same
 * lists the web console has, laid out for one thumb. Sheets slide up from the bottom of the screen.
 */

type Toast = (message: string, type?: ToastData['type']) => void

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

const CHIP = 'inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-bold font-display whitespace-nowrap'

const PACE_STYLE: Record<PaceStatus, string> = {
  'not-started': 'bg-canvas text-gray-500', 'on-pace': 'bg-emerald-50 text-emerald-700', behind: 'bg-amber-50 text-amber-700',
  'out-of-position': 'bg-rose-50 text-rose-700', finished: 'bg-gray-100 text-gray-500',
}
export const PaceChip = ({ status }: { status: PaceStatus }) => <span className={`${CHIP} ${PACE_STYLE[status]}`}>{PACE_LABEL[status]}</span>

const INCIDENT_STYLE: Record<IncidentStatus, [string, string]> = {
  open: ['On the course', 'bg-amber-50 text-amber-700'], committee: ['Needs a decision', 'bg-rose-50 text-rose-700'], resolved: ['Resolved', 'bg-emerald-50 text-emerald-700'],
}
export const IncidentChip = ({ status }: { status: IncidentStatus }) => <span className={`${CHIP} ${INCIDENT_STYLE[status][1]}`}>{INCIDENT_STYLE[status][0]}</span>

const SLOT_STYLE: Record<SlotStatus, [string, string]> = {
  open: ['Open slot', 'bg-canvas text-gray-500'], invited: ['Invited', 'bg-amber-50 text-amber-700'], active: ['Signed in', 'bg-emerald-50 text-emerald-700'], ended: ['Access ended', 'bg-gray-100 text-gray-500'],
}
export const SlotChip = ({ status }: { status: SlotStatus }) => <span className={`${CHIP} ${SLOT_STYLE[status][1]}`}>{SLOT_STYLE[status][0]}</span>

/** A bottom sheet over the current screen, rendered into the screen container so scrolling content can't clip it */
export function Sheet({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const root = document.getElementById('screen-root')
  const sheet = (
    <>
      <div className="absolute inset-0 bg-black/40 z-40 fade-in" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="absolute left-0 right-0 bottom-0 z-50 bg-white rounded-t-[32px] max-h-[90%] flex flex-col fade-in-up">
        <div className="w-10 h-1 bg-black/15 rounded-full mx-auto mt-3 flex-shrink-0" />
        <div className="px-5 pt-3 flex-shrink-0">
          <h3 className="font-display font-bold text-ink text-[19px] tracking-tight">{title}</h3>
          {subtitle && <p className="text-[13px] text-gray-500 mt-0.5 leading-snug">{subtitle}</p>}
        </div>
        <div className="px-5 py-4 overflow-y-auto no-scrollbar space-y-4 flex-1 min-h-0">{children}</div>
        {footer && <div className="px-5 pb-5 pt-1 flex gap-2 flex-shrink-0">{footer}</div>}
      </div>
    </>
  )
  return root ? createPortal(sheet, root) : sheet
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white rounded-3xl shadow-card ${className}`}>{children}</div>
}

function Chips<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={o.value === value}
          className={`h-9 px-3.5 rounded-full text-[13px] font-semibold font-display ${o.value === value ? 'bg-ink text-white' : 'bg-canvas text-gray-600'}`}>{o.label}</button>
      ))}
    </div>
  )
}

export function Segments<T extends string>({ options, value, onChange }: { options: { value: T; label: string; badge?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 bg-white rounded-full p-1 shadow-card">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)} aria-pressed={o.value === value}
          className={`flex-1 h-9 rounded-full text-[12px] font-bold font-display inline-flex items-center justify-center gap-1.5 ${o.value === value ? 'bg-ink text-white' : 'text-gray-500'}`}>
          {o.label}{o.badge ? <span className={`min-w-4 h-4 px-1 rounded-full text-[10px] inline-flex items-center justify-center ${o.value === value ? 'bg-lime-400 text-ink' : 'bg-rose-500 text-white'}`}>{o.badge}</span> : null}
        </button>
      ))}
    </div>
  )
}

const Label = ({ children }: { children: ReactNode }) => <p className="text-[13px] font-semibold text-gray-600 font-display mb-1.5">{children}</p>
const SELECT = 'h-11 w-full rounded-2xl bg-canvas px-3 text-[14px] font-semibold text-ink'

function TextArea({ value, onChange, placeholder, error }: { value: string; onChange: (v: string) => void; placeholder?: string; error?: string }) {
  return (
    <div>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
        className={`${fieldClass(!!error)} h-auto py-3 leading-relaxed resize-none`} />
      {error && <p className="text-xs text-red-500 font-medium mt-1">{error}</p>}
    </div>
  )
}

const names = (t: Tournament, ids: string[]) => {
  const field = entriesFor(t.id)
  return ids.map(id => field.find(e => e.id === id)?.name).filter(Boolean).join(', ')
}

/* ───────── Pace ───────── */

export function PaceList({ t, round, onLog, compact }: { t: Tournament; round: number; onLog?: (g: GroupPace) => void; compact?: boolean }) {
  useLiveVersion()
  const pace = paceFor(t, round)
  const list = compact ? pace.groups.filter(g => g.status === 'behind' || g.status === 'out-of-position') : pace.groups
  if (!list.length) return <Card className="p-5"><p className="text-[14px] text-gray-500 text-center">{compact ? 'Every group is on pace.' : 'No tee sheet yet.'}</p></Card>
  return (
    <div className="space-y-2.5">
      {list.map(g => (
        <Card key={g.group.id} className={`p-4 ${g.status === 'out-of-position' ? 'ring-2 ring-rose-300' : ''}`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-ink text-white flex flex-col items-center justify-center flex-shrink-0">
              <span className="font-display font-extrabold text-[18px] leading-none text-lime-400">{g.onHole ?? (g.status === 'finished' ? 'F' : '–')}</span>
              <span className="text-[8px] font-bold text-white/55 mt-0.5">{g.onHole ? 'HOLE' : g.status === 'finished' ? 'DONE' : 'OUT'}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-display font-bold text-ink text-[15px]">{formatClock(g.group.time)} <span className="text-gray-400 font-semibold text-[12px]">· tee {g.group.startHole}</span></p>
              <p className="text-[12px] text-gray-500 truncate">{g.players.map(p => p.name.split(' ')[0]).join(' · ')}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <PaceChip status={g.status} />
              {g.behindMinutes > 0 && g.status !== 'finished' && <p className="text-[12px] font-bold text-ink mt-1">+{g.behindMinutes} min</p>}
            </div>
          </div>
          {g.status === 'out-of-position' && <p className="text-[12px] text-rose-700 font-semibold mt-2">Empty hole in front: {g.gapHoles} holes behind the group ahead</p>}
          {onLog && (g.status === 'behind' || g.status === 'out-of-position') && (
            <button onClick={() => onLog(g)} className="mt-3 w-full h-10 rounded-full bg-canvas text-ink text-[13px] font-bold font-display active:bg-gray-200">Log a warning</button>
          )}
        </Card>
      ))}
    </div>
  )
}

/* ───────── Incidents ───────── */

export function IncidentSheet({ t, round, actor, preset, onClose, showToast }: {
  t: Tournament; round: number; actor: Actor; onClose: () => void; showToast: Toast
  preset?: { kind?: IncidentKind; hole?: number; entryIds?: string[]; note?: string }
}) {
  const course = getCourse(t.courseId)
  const holes = course ? roundHoles(t, course, round) : []
  const field = entriesFor(t.id).filter(e => e.status === 'registered')
  const group = groupsFor(t.id, round).find(g => preset?.entryIds?.some(id => g.entryIds.includes(id)))
  const players = group ? field.filter(e => group.entryIds.includes(e.id)) : field
  const [kind, setKind] = useState<IncidentKind>(preset?.kind ?? 'slow-play')
  const [hole, setHole] = useState<number | ''>(preset?.hole ?? '')
  const [entryIds, setEntryIds] = useState<string[]>(preset?.entryIds ?? [])
  const [note, setNote] = useState(preset?.note ?? '')
  const [error, setError] = useState('')
  const escalate = actor.role === 'marshal' || actor.role === 'golfer'

  function save(status: IncidentStatus) {
    if (!note.trim()) return setError('Say what happened')
    logIncident({ tournamentId: t.id, round, kind, hole: hole === '' ? undefined : hole, entryIds, note, raisedBy: actor, status })
    showToast(status === 'committee' ? 'Sent to the committee' : 'Incident logged')
    onClose()
  }

  return (
    <Sheet title={actor.role === 'golfer' ? 'Ask for a ruling' : 'Log an incident'} subtitle="Recorded with your name and the time." onClose={onClose}
      footer={escalate
        ? <><Button variant="secondary" fullWidth onClick={() => save('open')}>{actor.role === 'golfer' ? 'Call a marshal' : 'Log it'}</Button><Button fullWidth onClick={() => save('committee')}>To committee</Button></>
        : <Button fullWidth onClick={() => save('open')}>Log it</Button>}>
      <div><Label>What happened</Label><Chips options={INCIDENT_KINDS.map(k => ({ value: k.value, label: k.label }))} value={kind} onChange={setKind} /></div>
      <div>
        <Label>Hole</Label>
        <select aria-label="Hole" className={SELECT} value={hole} onChange={e => setHole(e.target.value === '' ? '' : Number(e.target.value))}>
          <option value="">Not on a hole</option>
          {holes.map(h => <option key={h.hole} value={h.hole}>Hole {h.hole}</option>)}
        </select>
      </div>
      {actor.role !== 'golfer' && (
        <div>
          <Label>Players</Label>
          <div className="flex flex-wrap gap-1.5 max-h-[96px] overflow-y-auto no-scrollbar">
            {players.map(p => {
              const on = entryIds.includes(p.id)
              return <button key={p.id} type="button" aria-pressed={on} onClick={() => setEntryIds(on ? entryIds.filter(x => x !== p.id) : [...entryIds, p.id])}
                className={`h-8 px-3 rounded-full text-[12px] font-semibold ${on ? 'bg-lime-400 text-ink' : 'bg-canvas text-gray-600'}`}>{p.name}</button>
            })}
          </div>
        </div>
      )}
      <div><Label>Details</Label><TextArea value={note} error={error} onChange={v => { setNote(v); setError('') }} placeholder="e.g. Cart driven onto the apron of the 3rd green" /></div>
    </Sheet>
  )
}

function DecisionSheet({ t, incident, actor, onClose, showToast }: { t: Tournament; incident: Incident; actor: Actor; onClose: () => void; showToast: Toast }) {
  const course = getCourse(t.courseId)
  const holes = course ? roundHoles(t, course, incident.round) : []
  const committee = actor.role !== 'marshal'
  const [decision, setDecision] = useState('')
  const [change, setChange] = useState(committee && incident.kind === 'score-dispute')
  const [entryId, setEntryId] = useState(incident.entryIds[0] ?? '')
  const [holeIndex, setHoleIndex] = useState(Math.max(0, holes.findIndex(h => h.hole === incident.hole)))
  const current = entryId ? cardFor(t, entryId, incident.round)[holeIndex] : null
  const marked = entryId ? markerCardFor(t, entryId, incident.round)[holeIndex] : null
  const [strokes, setStrokes] = useState<number>(marked ?? current ?? 4)
  const [error, setError] = useState('')

  function save() {
    if (!decision.trim()) return setError('Record the decision')
    resolveIncident(incident.id, actor, decision, change && entryId ? { t, entryId, holeIndex, strokes } : undefined)
    showToast(change ? 'Decision saved, score updated' : 'Decision saved')
    onClose()
  }

  return (
    <Sheet title={committee ? 'Committee decision' : 'Handled on the course'} subtitle={`${incidentKindLabel(incident.kind)}${incident.hole ? ` · hole ${incident.hole}` : ''} — ${incident.note}`} onClose={onClose}
      footer={<><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button fullWidth onClick={save}>Save</Button></>}>
      <div><Label>Decision</Label><TextArea value={decision} error={error} onChange={v => { setDecision(v); setError('') }} placeholder={committee ? 'e.g. One-stroke penalty, 7 on the 1st' : 'e.g. Warned the group; back in position'} /></div>
      {committee && incident.entryIds.length > 0 && (
        <div className="rounded-2xl ring-1 ring-black/[0.06] p-3.5 space-y-3">
          <label className="flex items-center gap-2.5 text-[14px] font-semibold text-ink font-display">
            <input type="checkbox" checked={change} onChange={e => setChange(e.target.checked)} className="w-4 h-4" /> Change a score
          </label>
          {change && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="Player" className={SELECT} value={entryId} onChange={e => setEntryId(e.target.value)}>
                  {incident.entryIds.map(id => <option key={id} value={id}>{names(t, [id])}</option>)}
                </select>
                <select aria-label="Hole" className={SELECT} value={holeIndex} onChange={e => setHoleIndex(Number(e.target.value))}>
                  {holes.map((h, i) => <option key={h.hole} value={i}>Hole {h.hole}</option>)}
                </select>
              </div>
              <div className="flex items-center justify-center gap-5">
                <button onClick={() => setStrokes(Math.max(1, strokes - 1))} aria-label="One fewer" className="w-11 h-11 rounded-full bg-canvas text-[22px] font-bold">−</button>
                <span className="font-display font-extrabold text-ink text-[36px] w-12 text-center">{strokes}</span>
                <button onClick={() => setStrokes(Math.min(15, strokes + 1))} aria-label="One more" className="w-11 h-11 rounded-full bg-canvas text-[22px] font-bold">+</button>
              </div>
              <p className="text-[12px] text-gray-500 text-center">Card shows {current ?? '–'}{marked !== null && marked !== current ? ` · marker recorded ${marked}` : ''}. Logged in the audit trail.</p>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}

export function IncidentList({ t, round, actor, canAct = true, showToast }: { t: Tournament; round: number; actor: Actor; canAct?: boolean; showToast: Toast }) {
  useOpsVersion()
  useLiveVersion()
  const committee = actor.role !== 'marshal'
  const all = incidentsFor(t.id)
  const [filter, setFilter] = useState<'active' | 'committee' | 'resolved'>(committee && all.some(i => i.status === 'committee') ? 'committee' : 'active')
  const [logging, setLogging] = useState(false)
  const [deciding, setDeciding] = useState<Incident | null>(null)
  const [noting, setNoting] = useState<{ incident: Incident; escalate: boolean } | null>(null)
  const [note, setNote] = useState('')
  const list = all.filter(i => (filter === 'active' ? i.status !== 'resolved' : i.status === filter))
  const live = t.status === 'in-progress'

  return (
    <div className="space-y-3">
      <Segments value={filter} onChange={setFilter} options={[
        { value: 'active', label: 'Open', badge: all.filter(i => i.status !== 'resolved').length },
        { value: 'committee', label: 'Decide', badge: all.filter(i => i.status === 'committee').length },
        { value: 'resolved', label: 'Resolved' },
      ]} />
      {canAct && live && <Button fullWidth onClick={() => setLogging(true)}>Log an incident</Button>}
      {list.length === 0 && <Card className="p-5"><p className="text-[14px] text-gray-500 text-center">Nothing here.</p></Card>}
      {list.map(i => (
        <Card key={i.id} className="p-4">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-ink text-[15px]">{incidentKindLabel(i.kind)}</span>
            {i.hole && <span className={`${CHIP} bg-canvas text-ink`}>Hole {i.hole}</span>}
            <span className="ml-auto"><IncidentChip status={i.status} /></span>
          </div>
          <p className="text-[11px] text-gray-400 mt-1">{fmtTime(i.at)} · {i.raisedBy.name} ({ACTOR_LABEL[i.raisedBy.role].toLowerCase()})</p>
          {i.entryIds.length > 0 && <p className="text-[12px] font-semibold text-pine-700 mt-1.5">{names(t, i.entryIds)}</p>}
          <p className="text-[13px] text-gray-700 mt-1 leading-relaxed">{i.note}</p>
          {i.updates.map((u, k) => (
            <p key={k} className="text-[12px] text-gray-600 mt-2 pl-2.5 border-l-2 border-black/10 leading-relaxed"><span className="font-semibold text-ink">{u.by.name}</span> — {u.text}</p>
          ))}
          {i.status === 'resolved' && i.decision && (
            <p className="mt-2.5 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900 leading-relaxed"><span className="font-bold">{i.decidedBy?.name}:</span> {i.decision}</p>
          )}
          {canAct && live && i.status !== 'resolved' && (
            <div className="flex gap-2 mt-3">
              {committee
                ? <Button size="sm" fullWidth onClick={() => setDeciding(i)}>Decide</Button>
                : i.status === 'open' && <>
                    <Button size="sm" fullWidth onClick={() => setDeciding(i)}>Handled</Button>
                    <Button size="sm" variant="secondary" fullWidth onClick={() => { setNote(''); setNoting({ incident: i, escalate: true }) }}>To committee</Button>
                  </>}
              <Button size="sm" variant="ghost" onClick={() => { setNote(''); setNoting({ incident: i, escalate: false }) }}>Note</Button>
            </div>
          )}
        </Card>
      ))}
      {logging && <IncidentSheet t={t} round={round} actor={actor} onClose={() => setLogging(false)} showToast={showToast} />}
      {deciding && <DecisionSheet t={t} incident={deciding} actor={actor} onClose={() => setDeciding(null)} showToast={showToast} />}
      {noting && (
        <Sheet title={noting.escalate ? 'Send to the committee' : 'Add a note'} onClose={() => setNoting(null)}
          footer={<Button fullWidth disabled={!note.trim()} onClick={() => {
            if (noting.escalate) { sendToCommittee(noting.incident.id, actor, note); showToast('Sent to the committee') } else addIncidentNote(noting.incident.id, actor, note)
            setNoting(null)
          }}>Save</Button>}>
          <TextArea value={note} onChange={setNote} placeholder={noting.escalate ? 'What the committee needs to know' : 'What happened next'} />
        </Sheet>
      )}
    </div>
  )
}

/* ───────── Scorecards ───────── */

function CardSheet({ t, entryId, round, actor, editable, onClose, showToast }: { t: Tournament; entryId: string; round: number; actor: Actor; editable: boolean; onClose: () => void; showToast: Toast }) {
  useLiveVersion()
  useOpsVersion()
  const course = getCourse(t.courseId)
  const holes = course ? roundHoles(t, course, round) : []
  const row = leaderboard(t, round).find(r => r.entry.id === entryId)
  const card = cardFor(t, entryId, round)
  const marked = markerCardFor(t, entryId, round)
  const diff = mismatches(t, entryId, round)
  const marker = markerOf(t.id, round, entryId)
  const [fixing, setFixing] = useState<number | null>(null)
  const [strokes, setStrokes] = useState(4)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  if (!row) return null
  const state = row.state
  const canEdit = editable && state !== 'verified'

  function open(i: number) {
    if (!canEdit) return
    setFixing(i)
    setStrokes(marked[i] !== null && marked[i] !== card[i] ? marked[i]! : card[i] ?? holes[i].par)
    setReason(marked[i] !== null && marked[i] !== card[i] ? 'Marker’s score confirmed' : '')
    setError('')
  }
  function save() {
    if (fixing === null) return
    if (!reason.trim()) return setError('A reason is required')
    correctScore(t, entryId, round, fixing, strokes, reason, actor)
    showToast(`Hole ${holes[fixing].hole} corrected`)
    setFixing(null)
  }

  return (
    <Sheet title={row.entry.name} subtitle={`${row.position} · gross ${row.thru ? toPar(row.grossToPar) : '–'} · net ${row.thru ? toPar(row.netToPar) : '–'} · thru ${row.thru}`} onClose={onClose}
      footer={editable ? (state !== 'verified'
        ? <Button fullWidth disabled={diff.length > 0} onClick={() => { setCardState(t.id, entryId, round, 'verified'); showToast('Card verified'); onClose() }}>{diff.length ? 'Settle red holes first' : 'Verify card'}</Button>
        : <Button variant="secondary" fullWidth onClick={() => { setCardState(t.id, entryId, round, 'submitted'); showToast('Unlocked for corrections', 'info') }}>Unlock to correct</Button>) : undefined}>
      {[holes.slice(0, 9), holes.slice(9)].filter(n => n.length).map((nine, k) => (
        <div key={k} className="grid grid-cols-9 gap-1">
          {nine.map((h, j) => {
            const i = k * 9 + j
            return (
              <button key={h.hole} onClick={() => open(i)} className={`flex flex-col items-center rounded-xl py-1 ${fixing === i ? 'bg-lime-400/40' : diff.includes(i) ? 'bg-rose-50' : ''}`}>
                <span className="text-[9px] font-bold text-gray-400">{h.hole}</span>
                <ScoreCell strokes={card[i]} par={h.par} />
                <span className={`text-[10px] font-semibold ${diff.includes(i) ? 'text-rose-600' : 'text-gray-300'}`}>{marked[i] ?? '·'}</span>
              </button>
            )
          })}
        </div>
      ))}
      <p className="text-[11px] text-gray-500">Top: player · bottom: marker{marker ? ` (${marker.name})` : ''}. {canEdit ? 'Tap a hole to correct it.' : state === 'verified' ? 'Verified.' : ''}</p>
      {fixing !== null && (
        <div className="rounded-2xl ring-1 ring-black/[0.06] p-3.5 space-y-3">
          <p className="text-[14px] font-bold font-display text-ink">Correct hole {holes[fixing].hole} <span className="text-gray-400 font-semibold">· player {card[fixing] ?? '–'} · marker {marked[fixing] ?? '–'}</span></p>
          <div className="flex items-center justify-center gap-5">
            <button onClick={() => setStrokes(Math.max(1, strokes - 1))} aria-label="One fewer" className="w-11 h-11 rounded-full bg-canvas text-[22px] font-bold">−</button>
            <span className="font-display font-extrabold text-ink text-[36px] w-12 text-center">{strokes}</span>
            <button onClick={() => setStrokes(Math.min(15, strokes + 1))} aria-label="One more" className="w-11 h-11 rounded-full bg-canvas text-[22px] font-bold">+</button>
          </div>
          <input aria-label="Reason" value={reason} onChange={e => { setReason(e.target.value); setError('') }} placeholder="Reason (goes in the audit trail)" className={fieldClass(!!error)} />
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          <div className="flex gap-2"><Button variant="secondary" fullWidth size="sm" onClick={() => setFixing(null)}>Cancel</Button><Button fullWidth size="sm" onClick={save}>Save correction</Button></div>
        </div>
      )}
    </Sheet>
  )
}

export function ScorecardList({ t, round, actor, canManage, showToast }: { t: Tournament; round: number; actor: Actor; canManage: boolean; showToast: Toast }) {
  useLiveVersion()
  useOpsVersion()
  const rows = leaderboard(t, round)
  const [filter, setFilter] = useState<'attention' | 'verified' | 'all'>('attention')
  const [open, setOpen] = useState<string | null>(null)
  const attention = (id: string, state: string) => mismatches(t, id, round).length > 0 || state === 'submitted'
  const shown = rows.filter(r => filter === 'all' || (filter === 'verified' ? r.state === 'verified' : attention(r.entry.id, r.state)))
  const closed = t.status === 'completed' || t.status === 'cancelled'

  return (
    <div className="space-y-3">
      <Segments value={filter} onChange={setFilter} options={[
        { value: 'attention', label: 'Check', badge: rows.filter(r => attention(r.entry.id, r.state)).length },
        { value: 'verified', label: 'Verified' },
        { value: 'all', label: 'All' },
      ]} />
      <Card className="overflow-hidden">
        {shown.length === 0 && <p className="text-[14px] text-gray-500 text-center p-5">{filter === 'attention' ? 'Nothing to check right now.' : 'No cards.'}</p>}
        {shown.map((r, k) => {
          const diff = mismatches(t, r.entry.id, round).length
          return (
            <button key={r.entry.id} onClick={() => setOpen(r.entry.id)} className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-canvas ${k ? 'border-t border-black/[0.05]' : ''}`}>
              <span className="w-8 font-display font-extrabold text-ink text-[14px]">{r.position}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold text-ink truncate">{r.entry.name}</span>
                <span className="block text-[11px] text-gray-500">{r.thru ? toPar(r.grossToPar) : '–'} · thru {r.thru === r.holes ? 'F' : r.thru}</span>
              </span>
              {diff > 0 && <span className={`${CHIP} bg-rose-50 text-rose-700`}>{diff} differ</span>}
              <span className={`${CHIP} ${r.state === 'verified' ? 'bg-emerald-50 text-emerald-700' : r.state === 'submitted' ? 'bg-amber-50 text-amber-700' : 'bg-canvas text-gray-500'}`}>
                {r.state === 'verified' ? 'Verified' : r.state === 'submitted' ? 'Submitted' : 'Playing'}
              </span>
            </button>
          )
        })}
      </Card>
      {open && <CardSheet t={t} entryId={open} round={round} actor={actor} editable={canManage && !closed} onClose={() => setOpen(null)} showToast={showToast} />}
    </div>
  )
}

export function ChangesList({ t }: { t: Tournament }) {
  useOpsVersion()
  const changes = scoreChangesFor(t.id)
  if (!changes.length) return <Card className="p-5"><p className="text-[14px] text-gray-500 text-center">No scores have been changed.</p></Card>
  return (
    <div className="space-y-2.5">
      {changes.map(c => (
        <Card key={c.id} className="p-4">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-ink text-[15px] flex-1 truncate">{names(t, [c.entryId])}</span>
            <span className="font-display font-extrabold text-ink">H{c.hole} · {c.from ?? '–'} → {c.to ?? '–'}</span>
          </div>
          <p className="text-[13px] text-gray-600 mt-1 leading-relaxed">{c.reason}</p>
          <p className="text-[11px] text-gray-400 mt-1">{fmtTime(c.at)} · {c.by.name} ({ACTOR_LABEL[c.by.role].toLowerCase()})</p>
        </Card>
      ))}
    </div>
  )
}

/* ───────── Tee sheet, contacts and slots ───────── */

export function TeeSheetList({ t, round }: { t: Tournament; round: number }) {
  useLiveVersion()
  const groups = groupsFor(t.id, round)
  const field = entriesFor(t.id)
  const contacts = (t.officials ?? []).filter(o => o.name.trim())
  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        {groups.length === 0 && <p className="text-[14px] text-gray-500 text-center p-5">The organiser hasn’t built the tee sheet yet.</p>}
        {groups.map((g, k) => (
          <div key={g.id} className={`flex gap-3 px-4 py-3 ${k ? 'border-t border-black/[0.05]' : ''}`}>
            <span className="w-16 flex-shrink-0"><span className="block font-display font-extrabold text-ink text-[15px]">{formatClock(g.time)}</span><span className="block text-[11px] text-gray-500">Hole {g.startHole}</span></span>
            <span className="text-[13px] text-gray-600 leading-relaxed">{g.entryIds.map(id => field.find(e => e.id === id)?.name).filter(Boolean).join(' · ')}</span>
          </div>
        ))}
      </Card>
      <div>
        <p className="text-[13px] font-bold text-gray-500 font-display px-1 mb-2">Contacts</p>
        <Card className="overflow-hidden">
          {contacts.map((o, k) => (
            <div key={k} className={`flex items-center gap-3 px-4 py-3 ${k ? 'border-t border-black/[0.05]' : ''}`}>
              <span className="flex-1 min-w-0"><span className="block text-[14px] font-semibold text-ink">{o.name}</span><span className="block text-[12px] text-gray-500">{o.role}</span></span>
              {o.phone && <a href={`tel:${o.phone}`} className="h-9 px-3.5 rounded-full bg-canvas text-[12px] font-bold font-display text-ink inline-flex items-center">Call</a>}
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

export function SlotList({ t }: { t: Tournament }) {
  useOpsVersion()
  const slots = (t.officials ?? []).filter(o => staffRoleOf(o))
  return (
    <Card className="overflow-hidden">
      {slots.map((o, k) => (
        <div key={k} className={`flex items-center gap-3 px-4 py-3 ${k ? 'border-t border-black/[0.05]' : ''}`}>
          <span className="w-10 h-10 rounded-full bg-canvas flex items-center justify-center font-display font-extrabold text-ink text-[12px]">{o.name ? o.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('') : '?'}</span>
          <span className="flex-1 min-w-0"><span className="block text-[14px] font-semibold text-ink truncate">{o.name || 'Open slot'}</span><span className="block text-[12px] text-gray-500">{STAFF_ROLE_LABEL[staffRoleOf(o)!]}</span></span>
          <SlotChip status={slotStatus(t, o)} />
        </div>
      ))}
    </Card>
  )
}
