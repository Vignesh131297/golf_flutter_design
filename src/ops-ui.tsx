import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { DialogData, ToastData, Tournament } from './types'
import { Button, fieldClass } from './components'
import { getCourse } from './data'
import {
  ROUND_STATUS_CODE, ROUND_STATUS_LABEL, cardFor, entriesFor, finishRoundForDemo, groupsFor, leaderboard, myEntry, roundHoles, roundStatus, suspensionFor, teamSizeOf, useLiveVersion,
  type RoundStatus,
} from './live'
import { formatClock, toPar } from './golf'
import { ScoreCell } from './screens/Leaderboard'
import {
  ACTOR_LABEL, INCIDENT_KINDS, LOGIN_RULES, PACE_LABEL, RANK_LABEL, SUSPEND_REASONS, activateLogin, activityFor, addIncidentNote, basesFor, canChangeMarker, claimIncident, correctScore, decideRequest, decidesPlay,
  finishReset, incidentKindLabel, incidentsFor, logIncident, markerCardFor, markerChoices, markerMissing, markerOf, mismatches, officialQueue, overallStandings, paceFor,
  pendingDq, pendingRequests, prizeLabel, prizesFor, raiseRequest, ranking, requestTitle, requestsFor, resolveIncident, resumePlay, roundNumbers, rulingsFor, scoreSheetHtml, sendToCommittee, setMarker, setPlayerStatus, signOffChecks, signOffFor, signOffRound,
  slotStatus, staffRoleOf, startReset, statusChoices, statusNoteFor, suspendPlay, unlockCard, verifyCards, winnersFor,
  STAFF_ROLE_LABEL, useOpsVersion,
  type ActivityKind, type Actor, type GroupPace, type Incident, type IncidentKind, type IncidentStatus, type NeedItem, type OrganiserRequest, type PaceStatus, type RankBasis, type RequestStatus, type SlotStatus, type Standing,
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
  open: ['Open slot', 'bg-canvas text-gray-500'], invited: ['Invite pending', 'bg-amber-50 text-amber-700'], active: ['Active', 'bg-emerald-50 text-emerald-700'],
  locked: ['Locked', 'bg-rose-50 text-rose-700'], removed: ['Taken off', 'bg-gray-100 text-gray-600'], ended: ['Access ended', 'bg-gray-100 text-gray-500'],
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
    if (!resolveIncident(incident.id, actor, decision, change && entryId ? { t, entryId, holeIndex, strokes } : undefined)) {
      // Another official decided it first: theirs stands
      showToast(`Already decided by ${incidentsFor(t.id).find(x => x.id === incident.id)?.decidedBy?.name ?? 'another official'}`, 'info')
      return onClose()
    }
    showToast(change ? 'Decision saved, score updated — the player sees it' : 'Decision saved — the player sees it')
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
          {committee && i.claimedBy && i.status !== 'resolved' && (
            <p className={`mt-1.5 text-[11px] font-bold ${i.claimedBy.name === actor.name ? 'text-pine-700' : 'text-sky-700'}`}>{i.claimedBy.name === actor.name ? 'You’re handling this' : `${i.claimedBy.name} is handling this`}</p>
          )}
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
                ? i.claimedBy && i.claimedBy.name !== actor.name
                  ? <Button size="sm" variant="secondary" fullWidth onClick={() => { claimIncident(i.id, actor); showToast(`You’ve taken this over from ${i.claimedBy!.name}`, 'info') }}>Take over</Button>
                  : <Button size="sm" fullWidth onClick={() => { if (actor.role === 'official') claimIncident(i.id, actor); setDeciding(i) }}>Decide</Button>
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
  const [sub, setSub] = useState<'status' | 'unlock' | 'marker' | null>(null)
  if (!row) return null
  const state = row.state
  const canEdit = editable && state !== 'verified'
  const noMarker = markerMissing(t, round, entryId)
  const markerState = marker ? roundStatus(t.id, marker.id, round) : 'playing'
  const canMove = canEdit && canChangeMarker(t, round, entryId, actor) && row.status === 'playing' && (groupsFor(t.id, round).find(g => g.entryIds.includes(entryId))?.entryIds.length ?? 0) > 1
  if (sub === 'status') return <StatusSheet t={t} entryId={entryId} round={round} actor={actor} onClose={() => setSub(null)} showToast={showToast} />
  if (sub === 'unlock') return <UnlockSheet t={t} entryId={entryId} round={round} actor={actor} onClose={() => setSub(null)} showToast={showToast} />
  if (sub === 'marker') return <MarkerSheet t={t} entryId={entryId} round={round} actor={actor} onClose={() => setSub(null)} showToast={showToast} />

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
        ? <Button fullWidth disabled={diff.length > 0} onClick={() => { verifyCards(t, [entryId], round, actor); showToast('Card verified'); onClose() }}>{diff.length ? 'Settle red holes first' : 'Verify card'}</Button>
        : <Button variant="secondary" fullWidth onClick={() => setSub('unlock')}>Unlock to correct…</Button>) : undefined}>
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
      <p className="text-[11px] text-gray-500">Top: player · bottom: marker{marker ? ` (${marker.name}${markerState !== 'playing' ? `, ${ROUND_STATUS_CODE[markerState]}` : ''})` : ''}. {canEdit ? 'Tap a hole to correct it.' : state === 'verified' ? 'Verified.' : ''}</p>
      {noMarker && <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-800 leading-snug"><span className="font-bold">No marker.</span> {marker?.name} can’t mark any more — give the card to someone else in the group.</p>}
      {pendingDq(t.id, entryId) && <p className="rounded-2xl bg-rose-50 px-4 py-2.5 text-[13px] text-rose-800 leading-snug"><span className="font-bold">Disqualification with the organiser.</span> The player keeps playing until they decide.</p>}
      {row.status === 'dq' && !decidesPlay(actor) && <p className="rounded-2xl bg-canvas px-4 py-2.5 text-[13px] text-gray-600 leading-snug">Only the organiser can change a disqualification.</p>}
      {row.status !== 'playing' && <p className="rounded-2xl bg-canvas px-4 py-2.5 text-[13px] text-gray-600"><span className="font-bold text-ink">{ROUND_STATUS_LABEL[row.status]}.</span> Left out of the results; the card is kept.</p>}
      {canMove && fixing === null && (
        <button onClick={() => setSub('marker')} className={`w-full h-10 rounded-full text-[13px] font-bold font-display ${noMarker ? 'bg-ink text-white' : 'bg-canvas text-ink'}`}>Change marker…</button>
      )}
      {editable && fixing === null && statusChoices(t, entryId, round, actor).length > 0 && (
        <button onClick={() => setSub('status')} className="w-full h-10 rounded-full bg-canvas text-ink text-[13px] font-bold font-display">
          {row.status === 'playing' ? 'Player status (WD, DNF, DQ)…' : 'Reinstate…'}
        </button>
      )}
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
  const attention = (r: { entry: { id: string }; state: string; status: RoundStatus }) => r.status === 'playing' && (mismatches(t, r.entry.id, round).length > 0 || r.state === 'submitted' || markerMissing(t, round, r.entry.id))
  const shown = rows.filter(r => filter === 'all' || (filter === 'verified' ? r.state === 'verified' : attention(r)))
  const closed = t.status === 'completed' || t.status === 'cancelled'
  const editable = canManage && !closed && !signOffFor(t.id, round)
  const clean = rows.filter(r => r.status === 'playing' && r.state === 'submitted' && !mismatches(t, r.entry.id, round).length)

  return (
    <div className="space-y-3">
      <Segments value={filter} onChange={setFilter} options={[
        { value: 'attention', label: 'Check', badge: rows.filter(attention).length },
        { value: 'verified', label: 'Verified' },
        { value: 'all', label: 'All' },
      ]} />
      {editable && clean.length > 0 && (
        <Button variant="secondary" fullWidth size="sm" onClick={() => { verifyCards(t, clean.map(r => r.entry.id), round, actor); showToast(`${clean.length} card${clean.length > 1 ? 's' : ''} verified`) }}>
          Verify {clean.length} clean card{clean.length > 1 ? 's' : ''}
        </Button>
      )}
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
              {pendingDq(t.id, r.entry.id) && <span className={`${CHIP} bg-rose-50 text-rose-700`}>DQ with the organiser</span>}
              {markerMissing(t, round, r.entry.id)
                ? <span className={`${CHIP} bg-rose-50 text-rose-700`}>No marker</span>
                : diff > 0 && r.status === 'playing' && <span className={`${CHIP} bg-rose-50 text-rose-700`}>{diff > 1 ? `${diff} score discrepancies` : 'Score discrepancy'}</span>}
              {r.status !== 'playing' ? <StatusChip status={r.status} /> : (
                <span className={`${CHIP} ${r.state === 'verified' ? 'bg-emerald-50 text-emerald-700' : r.state === 'submitted' ? 'bg-amber-50 text-amber-700' : 'bg-canvas text-gray-500'}`}>
                  {r.state === 'verified' ? 'Verified' : r.state === 'submitted' ? 'Submitted' : 'Playing'}
                </span>
              )}
            </button>
          )
        })}
      </Card>
      {open && <CardSheet t={t} entryId={open} round={round} actor={actor} editable={editable} onClose={() => setOpen(null)} showToast={showToast} />}
    </div>
  )
}

/* ───────── Player status (official) ───────── */

const STATUS_STYLE: Record<RoundStatus, string> = {
  playing: 'bg-canvas text-gray-500', wd: 'bg-gray-100 text-gray-600', 'no-show': 'bg-gray-100 text-gray-600', dnf: 'bg-amber-50 text-amber-700', dq: 'bg-rose-50 text-rose-700',
}
export const StatusChip = ({ status }: { status: RoundStatus }) => <span className={`${CHIP} ${STATUS_STYLE[status]}`}>{ROUND_STATUS_LABEL[status]}</span>

const STATUS_HINT: Record<RoundStatus, [string, string]> = {
  playing: ['Back in the field and the results.', 'e.g. Marked no-show by mistake'],
  wd: ['Withdrew during the round. Holes played stay on the card.', 'e.g. Back injury on the 3rd tee'],
  'no-show': ['Didn’t turn up for their tee time.', 'e.g. No contact by 10 min after tee time'],
  dnf: ['Started but couldn’t finish (injury, darkness).', 'e.g. Couldn’t finish before dark'],
  dq: ['Disqualified under the rules. The reason stays with the card.', 'e.g. Rule 3.3b — lower score on the 7th'],
}

function StatusSheet({ t, entryId, round, actor, onClose, showToast }: { t: Tournament; entryId: string; round: number; actor: Actor; onClose: () => void; showToast: Toast }) {
  const name = entriesFor(t.id).find(e => e.id === entryId)?.name ?? 'Player'
  const choices = statusChoices(t, entryId, round, actor)
  const [status, setStatus] = useState<RoundStatus>(choices[0])
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  // A disqualification is the organiser's decision: the official sends it to them
  const asking = status === 'dq' && !decidesPlay(actor)
  function save() {
    if (!reason.trim()) return setError('A reason is required — it goes in the change log')
    if (asking) {
      raiseRequest(t, { round, kind: 'dq', entryId, reason }, actor)
      showToast(`Sent to the organiser — ${name} keeps playing until they decide`, 'info')
      return onClose()
    }
    setPlayerStatus(t, entryId, round, status, reason, actor)
    showToast(status === 'playing' ? `${name} is back in the results` : `${name}: ${ROUND_STATUS_LABEL[status].toLowerCase()}`)
    onClose()
  }
  return (
    <Sheet title={`Player status · ${name}`} subtitle={`Now: ${ROUND_STATUS_LABEL[roundStatus(t.id, entryId, round)]}. Scores already entered stay on the card.`} onClose={onClose}
      footer={<><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button fullWidth variant={status === 'dq' ? 'danger' : 'primary'} onClick={save}>{asking ? 'Send to organiser' : status === 'playing' ? 'Reinstate' : 'Save'}</Button></>}>
      <div>
        <Label>Set to</Label>
        <Chips options={choices.map(c => ({ value: c, label: c === 'playing' ? 'Back to playing' : ROUND_STATUS_LABEL[c] }))} value={status} onChange={v => { setStatus(v); setError('') }} />
        <p className="text-[12px] text-gray-500 mt-2">{asking ? 'The organiser makes the final decision. The player keeps playing until then.' : STATUS_HINT[status][0]}</p>
      </div>
      <div><Label>Reason *</Label><TextArea value={reason} error={error} onChange={v => { setReason(v); setError('') }} placeholder={STATUS_HINT[status][1]} /></div>
    </Sheet>
  )
}

/** A verified card is locked; opening it again needs a reason, which goes in the change log */
function UnlockSheet({ t, entryId, round, actor, onClose, showToast }: { t: Tournament; entryId: string; round: number; actor: Actor; onClose: () => void; showToast: Toast }) {
  const name = entriesFor(t.id).find(e => e.id === entryId)?.name ?? 'Player'
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  function save() {
    if (!reason.trim()) return setError('A reason is required — it goes in the change log')
    if (unlockCard(t, entryId, round, reason, actor)) showToast(`${name}’s card is open to correct`, 'info')
    onClose()
  }
  return (
    <Sheet title={`Unlock ${name}’s card`} subtitle="The card goes back to handed in so you can correct a score, then verify it again. The unlock is kept with your name." onClose={onClose}
      footer={<><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button fullWidth onClick={save}>Unlock card</Button></>}>
      <div><Label>Reason *</Label><TextArea value={reason} error={error} onChange={v => { setReason(v); setError('') }} placeholder="e.g. Player reported a wrong score on the 14th after handing in" /></div>
    </Sheet>
  )
}

/** The marker withdrew or was disqualified (or the group asks for a change): someone else in the group takes the card */
function MarkerSheet({ t, entryId, round, actor, onClose, showToast }: { t: Tournament; entryId: string; round: number; actor: Actor; onClose: () => void; showToast: Toast }) {
  const name = entriesFor(t.id).find(e => e.id === entryId)?.name ?? 'Player'
  const now = markerOf(t.id, round, entryId)
  const nowStatus = now ? roundStatus(t.id, now.id, round) : 'playing'
  const choices = markerChoices(t, round, entryId)
  const [to, setTo] = useState(choices[0]?.id ?? '')
  const [reason, setReason] = useState(now && nowStatus !== 'playing' ? `${now.name}: ${ROUND_STATUS_LABEL[nowStatus].toLowerCase()}` : '')
  const [error, setError] = useState('')
  function save() {
    if (!to) return setError('Nobody else in the group is still playing')
    if (!reason.trim()) return setError('A reason is required — it goes in the change log')
    setMarker(t, round, entryId, to, reason, actor)
    showToast(`${choices.find(c => c.id === to)?.name} now marks ${name}`)
    onClose()
  }
  return (
    <Sheet title={`Change marker · ${name}`} subtitle={`Now: ${now ? `${now.name}${nowStatus !== 'playing' ? ` (${ROUND_STATUS_LABEL[nowStatus].toLowerCase()})` : ''}` : 'nobody'}. Holes already marked stay on the record; the new marker carries on from the next hole.`} onClose={onClose}
      footer={<><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button fullWidth disabled={!choices.length} onClick={save}>Change marker</Button></>}>
      {choices.length
        ? <div><Label>New marker (same group)</Label><Chips options={choices.map(c => ({ value: c.id, label: c.name }))} value={to} onChange={v => { setTo(v); setError('') }} /></div>
        : <p className="rounded-2xl bg-amber-50 text-amber-800 text-[13px] px-4 py-3">Nobody else in the group is still playing. A marshal or official marks the card on paper; enter it when it’s handed in.</p>}
      <div><Label>Reason *</Label><TextArea value={reason} error={error} onChange={v => { setReason(v); setError('') }} placeholder="e.g. Marker withdrew injured on the 6th" /></div>
    </Sheet>
  )
}

/* ───────── Suspending play (the organiser's decision; an official asks) ───────── */

export function SuspendedBanner({ t }: { t: Tournament }) {
  useLiveVersion()
  const s = suspensionFor(t.id)
  if (!s) return null
  return (
    <div role="status" className="rounded-3xl bg-rose-600 text-white px-4 py-3">
      <p className="font-display font-bold text-[15px]">Play suspended · {fmtTime(s.at)}</p>
      <p className="text-[12px] text-white/85 mt-0.5 leading-snug">{s.reason}{s.note ? ` — ${s.note}` : ''}. Players have been told to mark their ball and stop.</p>
    </div>
  )
}

export function SuspendSheet({ t, round, actor, onClose, showToast }: { t: Tournament; round: number; actor: Actor; onClose: () => void; showToast: Toast }) {
  const [reason, setReason] = useState<string>(SUSPEND_REASONS[0])
  const [note, setNote] = useState('')
  const asking = !decidesPlay(actor)
  function save() {
    if (asking) {
      raiseRequest(t, { round, kind: 'suspend', reason, note }, actor)
      showToast('Sent to the organiser — play carries on until they decide', 'info')
    } else {
      suspendPlay(t, round, reason, note, actor)
      showToast('Play suspended — everyone has been told')
    }
    onClose()
  }
  return (
    <Sheet title={asking ? 'Ask the organiser to suspend play' : 'Suspend play'}
      subtitle={asking ? `The organiser makes the final decision and play carries on until they do.${t.contactPhone ? ` Can’t wait? Call them on ${t.contactPhone}.` : ''}` : 'Stops the round for the whole field. Players see it on their scorecard at once.'} onClose={onClose}
      footer={<><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button variant="danger" fullWidth onClick={save}>{asking ? 'Send to organiser' : 'Suspend'}</Button></>}>
      <div><Label>Why</Label><Chips options={SUSPEND_REASONS.map(r => ({ value: r as string, label: r }))} value={reason} onChange={setReason} /></div>
      <div><Label>Message to players (optional)</Label><TextArea value={note} onChange={setNote} placeholder="e.g. Go to the clubhouse. Next update at 3:00 PM." /></div>
    </Sheet>
  )
}

export function ResumeSheet({ t, round, actor, onClose, showToast }: { t: Tournament; round: number; actor: Actor; onClose: () => void; showToast: Toast }) {
  const [note, setNote] = useState('')
  const asking = !decidesPlay(actor)
  function save() {
    if (asking) {
      raiseRequest(t, { round, kind: 'resume', reason: 'Ready to carry on', note }, actor)
      showToast('Sent to the organiser', 'info')
    } else {
      resumePlay(t, round, note, actor)
      showToast('Play resumed — everyone has been told')
    }
    onClose()
  }
  return (
    <Sheet title={asking ? 'Ask the organiser to resume play' : 'Resume play'} subtitle={asking ? 'The organiser makes the final decision. Play stays suspended until they do.' : 'Players replace their ball where they marked it and carry on.'} onClose={onClose}
      footer={<><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button fullWidth onClick={save}>{asking ? 'Send to organiser' : 'Resume play'}</Button></>}>
      <div><Label>Message to players (optional)</Label><TextArea value={note} onChange={setNote} placeholder="e.g. Siren at 3:10 PM. Carry on from your marked ball." /></div>
    </Sheet>
  )
}

/* ───────── Decisions that belong to the organiser ───────── */

const REQUEST_STYLE: Record<RequestStatus, [string, string]> = {
  pending: ['With the organiser', 'bg-amber-50 text-amber-700'], approved: ['Approved', 'bg-emerald-50 text-emerald-700'], declined: ['Declined', 'bg-gray-100 text-gray-600'],
}

export const WaitingForOrganiser = ({ t, at }: { t: Tournament; at: string }) => (
  <p className="rounded-2xl bg-amber-50 text-amber-800 text-[13px] px-4 py-3 leading-snug">
    <span className="font-bold">Waiting for the organiser.</span> You asked at {fmtTime(at)}.{t.contactPhone ? ` Can’t wait? Call them on ${t.contactPhone}.` : ''}
  </p>
)

/** Official: what they've sent to the organiser, and the answers */
export function MyRequests({ t }: { t: Tournament }) {
  useOpsVersion()
  const list = requestsFor(t.id)
  if (!list.length) return null
  return (
    <>
      <p className="text-[13px] font-bold text-gray-500 font-display px-1 pt-1">Sent to the organiser</p>
      <Card className="overflow-hidden">
        {list.map((r, k) => (
          <div key={r.id} className={`px-4 py-3 ${k ? 'border-t border-black/[0.05]' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-display font-bold text-ink text-[14px] leading-snug">{requestTitle(t, r)}</p>
              <span className={`${CHIP} ${REQUEST_STYLE[r.status][1]}`}>{REQUEST_STYLE[r.status][0]}</span>
            </div>
            <p className="text-[12px] text-gray-500 mt-0.5 leading-snug">{r.by.name} at {fmtTime(r.at)}: {r.reason}</p>
            {r.decidedBy && r.answer && <p className="text-[12px] text-gray-700 mt-1 leading-snug"><span className="font-semibold text-ink">{r.decidedBy.name}:</span> {r.answer}</p>}
          </div>
        ))}
      </Card>
    </>
  )
}

function DecideSheet({ t, request: r, actor, onClose, showToast }: { t: Tournament; request: OrganiserRequest; actor: Actor; onClose: () => void; showToast: Toast }) {
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const action = r.kind === 'dq' ? 'Disqualify player' : r.kind === 'suspend' ? 'Suspend play' : 'Resume play'
  function decide(approve: boolean) {
    if (!approve && !answer.trim()) return setError('Say why, so the official knows')
    decideRequest(t, r.id, approve, answer, actor)
    showToast(approve ? `${action}: done — everyone has been told` : 'Declined — the official sees your answer', approve ? 'success' : 'info')
    onClose()
  }
  return (
    <Sheet title={requestTitle(t, r)} subtitle={`Asked by ${r.by.name} at ${fmtTime(r.at)}, round ${r.round}. You make the final decision.`} onClose={onClose}
      footer={<><Button variant="secondary" fullWidth onClick={() => decide(false)}>Decline</Button><Button fullWidth variant={r.kind === 'resume' ? 'primary' : 'danger'} onClick={() => decide(true)}>{action}</Button></>}>
      <div className="rounded-2xl bg-canvas px-4 py-3 text-[14px] text-ink leading-snug">
        {r.reason}
        {r.note && <span className="block text-[12px] text-gray-600 mt-1">Message to players: “{r.note}”</span>}
      </div>
      <div><Label>Your answer (needed to decline)</Label><TextArea value={answer} error={error} onChange={v => { setAnswer(v); setError('') }} placeholder="e.g. Spoke to the player; a warning is enough" /></div>
    </Sheet>
  )
}

/** Organiser: what officials have sent for a final decision. Empty most of the day. */
export function OrganiserDecisions({ t, actor, showToast }: { t: Tournament; actor: Actor; showToast: Toast }) {
  useOpsVersion()
  const [deciding, setDeciding] = useState<OrganiserRequest | null>(null)
  const pending = pendingRequests(t.id)
  if (!pending.length) return null
  return (
    <>
      <p className="text-[13px] font-bold text-gray-500 font-display px-1 pt-1">Needs your decision</p>
      <Card className="overflow-hidden">
        {pending.map((r, k) => (
          <div key={r.id} className={`px-4 py-3.5 flex items-start gap-3 ${k ? 'border-t border-black/[0.05]' : ''}`}>
            <span className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 bg-rose-500" aria-hidden="true" />
            <span className="flex-1 min-w-0">
              <span className="block font-display font-bold text-ink text-[14px] leading-snug">{requestTitle(t, r)}</span>
              <span className="block text-[12px] text-gray-600 mt-0.5 leading-snug">{r.by.name}: {r.reason}</span>
            </span>
            <Button size="sm" onClick={() => setDeciding(r)}>Decide</Button>
          </div>
        ))}
      </Card>
      {deciding && <DecideSheet t={t} request={deciding} actor={actor} onClose={() => setDeciding(null)} showToast={showToast} />}
    </>
  )
}

/* ───────── What needs the official now ───────── */

const TONE: Record<NeedItem['tone'], string> = { urgent: 'bg-rose-500', normal: 'bg-amber-400', info: 'bg-gray-300' }

export function NeedsList({ t, round, onOpen }: { t: Tournament; round: number; onOpen: (tab: NeedItem['tab']) => void }) {
  useOpsVersion()
  useLiveVersion()
  const items = officialQueue(t, round)
  if (!items.length) return <Card className="p-5"><p className="text-[14px] text-gray-500 text-center">Nothing waiting for you.</p></Card>
  return (
    <Card className="overflow-hidden">
      {items.map((i, k) => (
        <button key={i.id} onClick={() => onOpen(i.tab)} className={`w-full text-left flex items-start gap-3 px-4 py-3.5 active:bg-canvas ${k ? 'border-t border-black/[0.05]' : ''}`}>
          <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${TONE[i.tone]}`} aria-hidden="true" />
          <span className="flex-1 min-w-0">
            <span className="block font-display font-bold text-ink text-[14px] leading-snug">{i.title}</span>
            <span className="block text-[12px] text-gray-600 mt-0.5 leading-snug line-clamp-2">{i.detail}</span>
          </span>
          <span className="text-gray-300 text-[18px] leading-none mt-1" aria-hidden="true">›</span>
        </button>
      ))}
    </Card>
  )
}

/* ───────── Results: round results and sign-off (official), overall, winners, the golfer's own sheet ───────── */

const shortDivision = (t: Tournament, id: string) => t.divisions?.find(d => d.id === id)?.name.replace(/\s*\(.*\)$/, '') ?? ''
const tieText = (t: Tournament) => {
  const tie = t.scoring?.tieBreak ?? 'countback'
  return tie === 'countback' ? 'countback (back 9, last 6, last 3, last hole)' : tie === 'playoff' ? 'a playoff on the course' : 'a shared place'
}
export const formatText = (t: Tournament) =>
  t.format === 'Four-Ball' ? `Four-Ball better ball · ${t.scoring?.allowancePct ?? 85}% of course handicap each`
  : t.format === 'Scramble' ? `Scramble · team handicap ${teamSizeOf(t) === 2 ? '35/15' : teamSizeOf(t) === 3 ? '30/20/10' : '25/20/15/10'}% of course handicaps`
  : t.format

const CardChip = ({ state }: { state: string }) => (
  <span className={`${CHIP} ${state === 'verified' ? 'bg-emerald-50 text-emerald-700' : state === 'submitted' ? 'bg-amber-50 text-amber-700' : 'bg-canvas text-gray-500'}`}>
    {state === 'verified' ? 'Verified' : state === 'submitted' ? 'Handed in' : 'Playing'}
  </span>
)

export const TieNote = ({ note }: { note?: string }) =>
  note ? <span className="mt-1 inline-flex items-center h-5 px-2 rounded-full bg-lime-400/40 text-[10px] font-semibold text-pine-800 whitespace-nowrap">{note}</span> : null

/** Gross / net list and division picker (only the choices this tournament has) */
export function ResultFilters({ t, basis, onBasis, division, onDivision }: { t: Tournament; basis: RankBasis; onBasis: (b: RankBasis) => void; division: string; onDivision: (d: string) => void }) {
  const bases = basesFor(t)
  const divisions = t.divisions ?? []
  if (bases.length < 2 && divisions.length < 2) return null
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {bases.length > 1 && bases.map(b => (
        <button key={b} onClick={() => onBasis(b)} aria-pressed={basis === b}
          className={`h-8 px-3.5 rounded-full text-[12px] font-bold font-display ${basis === b ? 'bg-ink text-white' : 'bg-white text-gray-600 shadow-card'}`}>{RANK_LABEL[b]}</button>
      ))}
      {divisions.length > 1 && (
        <select aria-label="Division" value={division} onChange={e => onDivision(e.target.value)} className="h-8 rounded-full bg-white shadow-card px-3 text-[12px] font-bold text-ink">
          <option value="">All divisions</option>
          {divisions.map(d => <option key={d.id} value={d.id}>{shortDivision(t, d.id)}</option>)}
        </select>
      )}
    </div>
  )
}

type Row = Standing['row']
const mainScore = (r: Row, basis: RankBasis) =>
  !r.thru ? '–' : basis === 'points' ? `${r.points} pts` : basis === 'net' ? `${r.net} (${toPar(r.netToPar)})` : `${r.gross} (${toPar(r.grossToPar)})`
const otherScore = (r: Row, basis: RankBasis) =>
  !r.thru ? '–' : basis === 'gross' ? `net ${r.net} (${toPar(r.netToPar)})` : `gross ${r.gross} (${toPar(r.grossToPar)})`

function RoundLines({ t, list, basis }: { t: Tournament; list: Standing[]; basis: RankBasis }) {
  const team = teamSizeOf(t) > 1
  const divisions = t.divisions ?? []
  return (
    <Card className="overflow-hidden">
      {list.length === 0 && <p className="text-[14px] text-gray-500 text-center p-5">No scores yet.</p>}
      {list.map(({ row: r, position, tieNote }, k) => (
        <div key={r.id} className={`grid grid-cols-[34px_1fr_auto] gap-2 px-4 py-3 ${k ? 'border-t border-black/[0.05]' : ''}`}>
          <span className="font-display font-extrabold text-ink text-[14px]">{position}</span>
          <span className="min-w-0">
            <span className="block text-[14px] font-semibold text-ink truncate">{r.name}</span>
            {team && <span className="block text-[11px] text-gray-500 leading-snug">{r.members.map(m => m.name).join(' · ')}{t.format === 'Scramble' ? ` · team handicap ${r.playing}` : ` · HCP ${r.handicaps.join(' / ')}`}</span>}
            {!team && divisions.length > 1 && <span className="block text-[11px] text-gray-500">{shortDivision(t, r.divisionId)}</span>}
            <span className="block text-[11px] text-gray-500">{r.thru === r.holes ? 'Finished' : `Thru ${r.thru}`} · {otherScore(r, basis)}</span>
            {r.thru === r.holes && <TieNote note={tieNote} />}
          </span>
          <span className="text-right">
            <span className="block font-display font-bold text-ink text-[14px] whitespace-nowrap">{mainScore(r, basis)}</span>
            <span className="inline-block mt-1">{r.status !== 'playing' ? <StatusChip status={r.status} /> : <CardChip state={r.state} />}</span>
          </span>
        </div>
      ))}
    </Card>
  )
}

const Tick = ({ ok }: { ok: boolean }) => <span aria-hidden="true" className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-extrabold ${ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{ok ? '✓' : '!'}</span>

function SignOffList({ t, round }: { t: Tournament; round: number }) {
  const c = signOffChecks(t, round)
  const rows: [boolean, string][] = [
    [c.unverified.length === 0 && c.playing > 0, `Cards verified · ${c.verified} of ${c.playing}`],
    [c.decisions === 0, c.decisions ? `${c.decisions} dispute${c.decisions > 1 ? 's' : ''} waiting for a decision` : 'No disputes waiting'],
    [c.requests === 0, c.requests ? `${c.requests} decision${c.requests > 1 ? 's' : ''} with the organiser` : 'Nothing waiting for the organiser'],
    [!c.suspended, c.suspended ? 'Play is suspended' : 'Play isn’t suspended'],
  ]
  return (
    <ul className="space-y-2">
      {rows.map(([ok, text]) => <li key={text} className="flex items-center gap-2 text-[13px]"><Tick ok={ok} /><span className={ok ? 'text-ink' : 'text-gray-600'}>{text}</span></li>)}
      {c.excluded > 0 && <li className="text-[12px] text-gray-500 pl-7">{c.excluded} player{c.excluded > 1 ? 's' : ''} out of the results (WD, NS, DNF or DQ)</li>}
    </ul>
  )
}

/** One round in order, and (for the official) the sign-off that locks it */
export function RoundResults({ t, round, actor, canSignOff, showToast, showDialog }: { t: Tournament; round: number; actor: Actor; canSignOff: boolean; showToast: Toast; showDialog: (d: DialogData) => void }) {
  useLiveVersion()
  useOpsVersion()
  const [basis, setBasis] = useState<RankBasis>(basesFor(t)[0])
  const [division, setDivision] = useState('')
  const list = ranking(t, round, { basis, divisionId: division || undefined })
  const checks = signOffChecks(t, round)
  const signed = signOffFor(t.id, round)
  const inResults = list.filter(s => s.row.status === 'playing')
  const out = list.filter(s => s.row.status !== 'playing')
  const unfinished = inResults.filter(s => s.row.thru < s.row.holes).length
  const live = t.status === 'in-progress'

  function signOff() {
    showDialog({
      title: `Sign off round ${round}?`,
      message: 'The cards and results are locked. You can’t change scores or statuses after this; the organiser confirms the winners, publishes the results to players and closes the tournament.',
      confirmLabel: 'Sign off',
      onConfirm: () => { if (signOffRound(t, round, actor)) showToast(`Round ${round} signed off — the organiser has been told to publish`) },
    })
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-gray-500 px-1 leading-relaxed">{formatText(t)} · ties by {tieText(t)}</p>
      <ResultFilters t={t} basis={basis} onBasis={setBasis} division={division} onDivision={setDivision} />
      {unfinished > 0 && <p className="rounded-2xl bg-amber-50 text-amber-800 text-[13px] px-4 py-2.5 leading-snug">{unfinished} {teamSizeOf(t) > 1 ? `team${unfinished > 1 ? 's are' : ' is'}` : `player${unfinished > 1 ? 's are' : ' is'}`} still on the course — positions can change.</p>}
      <RoundLines t={t} list={inResults} basis={basis} />
      {out.length > 0 && (
        <>
          <p className="text-[13px] font-bold text-gray-500 font-display px-1 pt-1">Not in the results</p>
          <Card className="overflow-hidden">
            {out.map(({ row: r }, k) => (
              <div key={r.id} className={`flex items-center justify-between gap-3 px-4 py-3 ${k ? 'border-t border-black/[0.05]' : ''}`}>
                <span className="text-[14px] font-semibold text-ink min-w-0">{r.name}<span className="block text-[11px] text-gray-500 font-normal">Thru {r.thru} · gross {r.thru ? r.gross : '–'} · card kept</span></span>
                <StatusChip status={r.status} />
              </div>
            ))}
          </Card>
        </>
      )}
      <p className="text-[13px] font-bold text-gray-500 font-display px-1 pt-1">Round {round} sign-off</p>
      <Card className="p-4">
        {signed
          ? <p className="text-[13px] text-emerald-800 leading-relaxed"><span className="font-bold">Signed off by {signed.by.name}</span> at {fmtTime(signed.at)}. Cards and results are locked; the organiser confirms the winners and publishes.</p>
          : (
            <>
              <SignOffList t={t} round={round} />
              {canSignOff && <Button fullWidth className="mt-4" disabled={!checks.ready} onClick={signOff}>Sign off round {round}</Button>}
              {canSignOff && !checks.ready && <p className="text-[12px] text-gray-500 mt-2 leading-relaxed">Verify every card and decide every dispute first. Players out of the results don’t hold it up.</p>}
              {canSignOff && live && unfinished > 0 && (
                <button onClick={() => { finishRoundForDemo(t, round); showToast('Demo: everyone finished and handed in their card', 'info') }}
                  className="mt-3 block mx-auto text-[12px] font-semibold text-pine-700 underline underline-offset-4">Demo only: play out the round</button>
              )}
            </>
          )}
      </Card>
    </div>
  )
}

/** The rounds added up, the same order on every console. Ties go to countback on the last round's card. */
export function OverallList({ t }: { t: Tournament }) {
  useLiveVersion()
  useOpsVersion()
  const [basis, setBasis] = useState<RankBasis>(basesFor(t)[0])
  const [division, setDivision] = useState('')
  const rounds = roundNumbers(t)
  const rows = overallStandings(t, rounds[rounds.length - 1], { basis, divisionId: division || undefined })
  const points = basis === 'points'
  const cols = { gridTemplateColumns: `34px minmax(0,1fr) repeat(${rounds.length}, 28px) 34px 34px` }
  return (
    <div className="space-y-3">
      <p className="text-[12px] text-gray-500 px-1 leading-relaxed">Final results need every round signed off — {rounds.map(n => `round ${n}: ${signOffFor(t.id, n) ? 'signed off' : 'not yet'}`).join(' · ')}.</p>
      <ResultFilters t={t} basis={basis} onBasis={setBasis} division={division} onDivision={setDivision} />
      <Card className="overflow-hidden">
        <div className="grid gap-1 px-4 py-2.5 text-[11px] font-bold font-display text-gray-400 border-b border-black/[0.05]" style={cols}>
          <span>Pos</span><span>{teamSizeOf(t) > 1 ? 'Team' : 'Player'}</span>
          {rounds.map(n => <span key={n} className="text-right">R{n}</span>)}
          <span className="text-right">Tot</span><span className="text-right">{points ? '' : 'Par'}</span>
        </div>
        {rows.map((r, k) => {
          const played = r.byRound.some(v => v !== null)
          return (
            <div key={r.id} className={`grid gap-1 px-4 py-3 items-start text-[13px] ${k ? 'border-t border-black/[0.05]' : ''} ${r.isMe ? 'bg-lime-300/40' : ''} ${r.out ? 'text-gray-400' : ''}`} style={cols}>
              <span className="font-display font-extrabold text-ink">{r.position}</span>
              <span className="min-w-0">
                <span className="block font-semibold text-ink truncate">{r.name}</span>
                {r.out && <span className="block text-[11px] text-gray-500">{ROUND_STATUS_LABEL[r.out.status]} in round {r.out.round}</span>}
                <TieNote note={r.tieNote} />
              </span>
              {r.byRound.map((v, i) => <span key={i} className="text-right text-gray-600">{v ?? '–'}</span>)}
              <span className="text-right font-display font-bold text-ink">{played ? r.total : '–'}</span>
              <span className="text-right text-gray-600">{!points && played ? toPar(r.toPar) : ''}</span>
            </div>
          )
        })}
      </Card>
    </div>
  )
}

/** Published winners at the top of the results; the golfer's own prize stands out */
export function WinnersCard({ t }: { t: Tournament }) {
  const prizes = prizesFor(t)
  const winners = winnersFor(t).filter(w => w.name)
  if (!winners.length) return null
  const me = myEntry(t.id)
  return (
    <section className="bg-ink text-white rounded-[28px] p-4 mb-3">
      <p className="text-[11px] font-bold font-display text-lime-400 uppercase tracking-wider px-1">Winners</p>
      <ul className="space-y-2 mt-2.5">
        {winners.map(w => {
          const mine = !!me && (w.rowId === me.id || (!!me.teamId && w.rowId === me.teamId))
          return (
            <li key={w.prizeId} className={`rounded-2xl px-3.5 py-2.5 ${mine ? 'bg-lime-400 text-ink' : 'bg-white/10'}`}>
              <p className={`text-[11px] font-semibold ${mine ? 'text-ink/70' : 'text-white/60'}`}>{prizeLabel(t, prizes.find(p => p.id === w.prizeId))}</p>
              <p className="font-display font-extrabold text-[15px] leading-snug">{w.name}{mine && ' — you!'}</p>
              {w.detail && <p className={`text-[11px] ${mine ? 'text-ink/70' : 'text-white/60'}`}>{w.detail}</p>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** The golfer's own score sheet: every round, ready to print or save as PDF. Players get only their own. */
export function ScoreSheetSheet({ t, entryId, onClose }: { t: Tournament; entryId: string; onClose: () => void }) {
  const [frame, setFrame] = useState<HTMLIFrameElement | null>(null)
  return (
    <Sheet title="My score sheet" subtitle="Your card for every round, with par, stroke index, net and points. Only you can download your sheet." onClose={onClose}
      footer={<><Button variant="secondary" fullWidth onClick={onClose}>Close</Button><Button fullWidth onClick={() => frame?.contentWindow?.print()}>Save as PDF</Button></>}>
      <iframe ref={setFrame} title="Score sheet" srcDoc={scoreSheetHtml(t, entryId)} className="w-full h-[380px] rounded-2xl ring-1 ring-black/[0.08] bg-white" />
    </Sheet>
  )
}

/* ───────── Change log ───────── */

const ACT_LABEL: Record<ActivityKind, string> = {
  score: 'Score', decision: 'Decision', status: 'Player status', suspend: 'Play', resume: 'Play', 'sign-off': 'Sign-off', staff: 'Staff',
  card: 'Card', marker: 'Marker', winners: 'Winners', publish: 'Results', request: 'Organiser',
}
const ACT_STYLE: Record<ActivityKind, string> = {
  score: 'bg-canvas text-ink', decision: 'bg-emerald-50 text-emerald-700', status: 'bg-amber-50 text-amber-700',
  suspend: 'bg-rose-50 text-rose-700', resume: 'bg-rose-50 text-rose-700', 'sign-off': 'bg-lime-400/40 text-ink', staff: 'bg-sky-50 text-sky-800',
  card: 'bg-canvas text-gray-600', marker: 'bg-amber-50 text-amber-700', winners: 'bg-lime-400/40 text-ink', publish: 'bg-ink text-white', request: 'bg-sky-50 text-sky-800',
}

/** Every score change, decision, player status and stoppage, newest first */
export function ChangesList({ t }: { t: Tournament }) {
  useOpsVersion()
  const list = activityFor(t)
  if (!list.length) return <Card className="p-5"><p className="text-[14px] text-gray-500 text-center">Nothing has been changed.</p></Card>
  return (
    <div className="space-y-2.5">
      {list.map(a => (
        <Card key={a.id} className="p-4">
          <span className={`${CHIP} ${ACT_STYLE[a.kind]}`}>{ACT_LABEL[a.kind]}</span>
          <p className="font-display font-bold text-ink text-[14px] mt-1.5">{a.title}</p>
          {a.detail && <p className="text-[13px] text-gray-600 mt-0.5 leading-relaxed">{a.detail}</p>}
          <p className="text-[11px] text-gray-400 mt-1">{fmtTime(a.at)} · {a.by.name} ({ACTOR_LABEL[a.by.role].toLowerCase()})</p>
        </Card>
      ))}
    </div>
  )
}

/* ───────── Marshal and official logins: set up, forgot password ───────── */

const PW_HINT = 'At least 8 characters, with letters and numbers'

function Field({ label, error, ...props }: { label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Label>{label}</Label>
      <input aria-label={label} {...props} className={fieldClass(!!error)} />
      {error && <p className="text-xs text-red-500 font-medium mt-1">{error}</p>}
    </div>
  )
}

/** Marshals and officials set their own password with the code from the organiser's invite */
export function SetUpLoginSheet({ onClose, showToast }: { onClose: () => void; showToast: Toast }) {
  const [f, setF] = useState({ email: '', code: '', password: '', again: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (patch: Partial<typeof f>) => { setF(v => ({ ...v, ...patch })); setErrors({}) }
  function save() {
    if (f.password !== f.again) return setErrors({ again: 'The two passwords don’t match' })
    const r = activateLogin(f.email, f.code, f.password)
    if (!r.ok) return setErrors({ [r.field]: r.error })
    showToast('Your login is ready — sign in')
    onClose()
  }
  return (
    <Sheet title="Set up your login" subtitle={`Marshals and officials: use the 6-digit code from your invite. It works once, for ${LOGIN_RULES.inviteHours} hours.`} onClose={onClose}
      footer={<><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button fullWidth onClick={save}>Set password</Button></>}>
      <Field label="Email" type="email" value={f.email} error={errors.email} onChange={e => set({ email: e.target.value })} />
      <Field label="Invite code" inputMode="numeric" maxLength={6} placeholder="6 digits" value={f.code} error={errors.code} onChange={e => set({ code: e.target.value.replace(/\D/g, '') })} />
      <Field label="New password" type="password" placeholder={PW_HINT} value={f.password} error={errors.password} onChange={e => set({ password: e.target.value })} />
      <Field label="Type it again" type="password" value={f.again} error={errors.again} onChange={e => set({ again: e.target.value })} />
    </Sheet>
  )
}

/** Forgot password: a code by email and text (5 minutes, 3 tries); same message whether or not the login exists */
export function ForgotPasswordSheet({ initialEmail = '', onClose, showToast }: { initialEmail?: string; onClose: () => void; showToast: Toast }) {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [f, setF] = useState({ email: initialEmail, code: '', password: '', again: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const set = (patch: Partial<typeof f>) => { setF(v => ({ ...v, ...patch })); setErrors({}) }
  function send() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErrors({ email: 'Enter the email you sign in with' })
    const code = startReset(f.email)
    const sent = 'If there’s a login for this email, we’ve sent a 6-digit code.'
    if (!code) { showToast(sent, 'info'); return onClose() }
    showToast(`${sent} (Demo code: ${code})`, 'info')
    setStep('code')
  }
  function save() {
    if (f.password !== f.again) return setErrors({ again: 'The two passwords don’t match' })
    const r = finishReset(f.email, f.code, f.password)
    if (!r.ok) return setErrors({ [r.field]: r.error })
    showToast('Password changed — sign in with the new one')
    onClose()
  }
  return (
    <Sheet title="Reset your password" subtitle={step === 'email' ? 'We’ll send a code to the email and phone on your login.' : `Enter the code within ${LOGIN_RULES.resetMinutes} minutes · ${LOGIN_RULES.resetTries} tries.`} onClose={onClose}
      footer={<><Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button><Button fullWidth onClick={step === 'email' ? send : save}>{step === 'email' ? 'Send code' : 'Set password'}</Button></>}>
      {step === 'email'
        ? <Field label="Email" type="email" value={f.email} error={errors.email} onChange={e => set({ email: e.target.value })} />
        : <>
            <Field label="Code" inputMode="numeric" maxLength={6} placeholder="6 digits" value={f.code} error={errors.code} onChange={e => set({ code: e.target.value.replace(/\D/g, '') })} />
            <Field label="New password" type="password" placeholder={PW_HINT} value={f.password} error={errors.password} onChange={e => set({ password: e.target.value })} />
            <Field label="Type it again" type="password" value={f.again} error={errors.again} onChange={e => set({ again: e.target.value })} />
          </>}
    </Sheet>
  )
}

/* ───────── What the golfer sees about the official's decisions ───────── */

export function MyRoundStatus({ t, entryId, round }: { t: Tournament; entryId: string; round: number }) {
  useLiveVersion()
  useOpsVersion()
  const status = roundStatus(t.id, entryId, round)
  if (status === 'playing') return null
  const note = statusNoteFor(t.id, entryId, round)
  return (
    <div role="alert" className="flex-shrink-0 mx-4 mb-2 rounded-2xl bg-ink text-white px-4 py-3">
      <p className="font-display font-bold text-[15px]">Round {round}: {ROUND_STATUS_LABEL[status]}</p>
      <p className="text-[12px] text-white/75 mt-0.5 leading-snug">{note ? `${note.by.name}: “${note.reason}”. ` : ''}Your scores so far are kept. Speak to the official if this is wrong.</p>
    </div>
  )
}

const ASK_STYLE: Record<IncidentStatus, [string, string]> = {
  open: ['With the marshal', 'bg-amber-50 text-amber-700'], committee: ['With the committee', 'bg-rose-50 text-rose-700'], resolved: ['Decided', 'bg-emerald-50 text-emerald-700'],
}

export function MyRulingsSheet({ t, entryId, onClose }: { t: Tournament; entryId: string; onClose: () => void }) {
  useOpsVersion()
  const list = rulingsFor(t.id, entryId)
  return (
    <Sheet title="Your rulings" subtitle="Rules questions and score disputes about you, and what was decided." onClose={onClose}>
      {list.length === 0 && <p className="text-[14px] text-gray-500">None yet.</p>}
      {list.map(({ incident: i, changes }) => (
        <div key={i.id} className="rounded-2xl ring-1 ring-black/[0.06] p-3.5">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-ink text-[14px] flex-1">{i.kind === 'rules' ? 'Rules question' : 'Score dispute'}{i.hole ? ` · hole ${i.hole}` : ''}</span>
            <span className={`${CHIP} ${ASK_STYLE[i.status][1]}`}>{ASK_STYLE[i.status][0]}</span>
          </div>
          <p className="text-[12px] text-gray-600 mt-1 leading-relaxed">{i.note}</p>
          {i.status === 'resolved' && i.decision && (
            <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900 leading-relaxed">
              <span className="font-bold">{i.decidedBy?.name}:</span> {i.decision}
              {changes.map(c => <span key={c.id} className="block font-semibold mt-0.5">Your card: hole {c.hole} {c.from ?? '–'} → {c.to ?? '–'}</span>)}
            </p>
          )}
        </div>
      ))}
    </Sheet>
  )
}

/* ───────── Course and local rules (read-only) ───────── */

export function CourseRules({ t, round }: { t: Tournament; round: number }) {
  const course = getCourse(t.courseId)
  const holes = course ? roundHoles(t, course, round) : []
  const s = t.scoring
  const facts: [string, string][] = [
    ['Format', formatText(t)],
    ['Results on', basesFor(t).map(b => RANK_LABEL[b]).join(' and ')],
    ['Handicap allowance', s ? `${s.allowancePct}%` : '—'],
    ['Ties', s?.tieBreak === 'playoff' ? 'Playoff' : s?.tieBreak === 'shared' ? 'Shared place' : 'Countback (back 9, 6, 3, 1)'],
    ['Pace', `${Math.floor((t.pace?.targetMinutes ?? 255) / 60)} h ${(t.pace?.targetMinutes ?? 255) % 60} min a round`],
  ]
  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-2">
        {facts.map(([k, v]) => <div key={k} className="flex justify-between gap-3 text-[13px]"><span className="text-gray-500">{k}</span><span className="font-semibold text-ink text-right">{v}</span></div>)}
      </Card>
      <div>
        <p className="text-[13px] font-bold text-gray-500 font-display px-1 mb-2">Local rules</p>
        <Card className="p-4"><p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-line">{t.localRules?.trim() || 'No local rules. The Rules of Golf apply.'}</p></Card>
      </div>
      <div>
        <p className="text-[13px] font-bold text-gray-500 font-display px-1 mb-2">{course?.name ?? 'Holes'} · par {holes.reduce((n, h) => n + h.par, 0)}</p>
        <Card className="overflow-hidden">
          <div className="grid grid-cols-4 px-4 py-2 text-[11px] font-bold text-gray-400 font-display"><span>Hole</span><span className="text-right">Par</span><span className="text-right">SI</span><span className="text-right">Yards</span></div>
          {holes.map(h => (
            <div key={h.hole} className="grid grid-cols-4 px-4 py-2 border-t border-black/[0.05] text-[13px]">
              <span className="font-display font-extrabold text-ink">{h.hole}</span><span className="text-right">{h.par}</span><span className="text-right text-gray-600">{h.handicap}</span><span className="text-right text-gray-600">{h.yards}</span>
            </div>
          ))}
        </Card>
      </div>
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
