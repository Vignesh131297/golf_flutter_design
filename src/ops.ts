import { useSyncExternalStore } from 'react'
import type { Official, Tournament } from './types'
import { MOCK_PROFILE, MOCK_TOURNAMENTS, getCourse } from './data'
import { cardFor, entriesFor, groupsFor, roundHoles, setStrokes, type Entry, type TeeGroup } from './live'
import { addMinutes, uid } from './golf'

/*
 * Tournament-day operations shared by every role (identical copy in the web and mobile prototypes):
 *  - who works a tournament: marshal and official slots with a login for that tournament only
 *  - the incident log: slow play, carts, rules questions, score disputes
 *  - marker scores: playing partners mark each other's cards; mismatches are settled on the spot
 *  - the audit trail of every score changed after entry
 *  - pace of play per group, worked out from the scores entered (GPS cart tags come later)
 * Kept in localStorage like the live store. A real backend owns all of this.
 */

/* ───────── People and roles ───────── */

export type StaffRole = 'marshal' | 'official'
export type ActorRole = StaffRole | 'golfer' | 'organiser' | 'admin'
export interface Actor { name: string; role: ActorRole }

export const STAFF_ROLE_LABEL: Record<StaffRole, string> = { marshal: 'Marshal', official: 'Tournament official' }
export const ACTOR_LABEL: Record<ActorRole, string> = {
  marshal: 'Marshal', official: 'Tournament official', golfer: 'Golfer', organiser: 'Organiser', admin: 'Platform admin',
}

/** What an official's role lets them do: marshals and starters look after the course, officials and rules people are the committee */
export function staffRoleOf(o: Pick<Official, 'role'>): StaffRole | null {
  if (/marshal|starter/i.test(o.role)) return 'marshal'
  if (/official|committee|rules|referee/i.test(o.role)) return 'official'
  return null
}

/** Demo logins. Anyone else the organiser invites signs in with INVITE_PASSWORD until they set their own. */
const DEMO_PASSWORDS: Record<string, string> = { 'marshal@gmail.com': 'marshal', 'official@gmail.com': 'official' }
export const INVITE_PASSWORD = 'golf1234'

/** open = no login yet · invited = waiting for first sign-in · active = signed in · ended = tournament over, access gone */
export type SlotStatus = 'open' | 'invited' | 'active' | 'ended'

const isEnded = (t: Tournament) => t.status === 'completed' || t.status === 'cancelled'
const emailKey = (email?: string) => email?.trim().toLowerCase() ?? ''

export function slotStatus(t: Tournament, o: Official): SlotStatus {
  const key = emailKey(o.email)
  if (!key || !o.name.trim()) return 'open'
  if (isEnded(t)) return 'ended'
  return data.accepted[key] || DEMO_PASSWORDS[key] || key === emailKey(MOCK_PROFILE.email) ? 'active' : 'invited'
}

/** upcoming = before tournament day (read-only tee sheet and contacts) · live = full access · ended = no access */
export type AccessWindow = 'upcoming' | 'live' | 'ended'
export const accessWindow = (t: Tournament): AccessWindow => (t.status === 'in-progress' ? 'live' : isEnded(t) ? 'ended' : 'upcoming')

export interface Assignment { tournament: Tournament; official: Official; role: StaffRole; window: AccessWindow }

const WINDOW_ORDER: Record<AccessWindow, number> = { live: 0, upcoming: 1, ended: 2 }

/** Every tournament this person is a marshal or official for. Roles come with the tournament, never platform-wide. */
export function assignmentsFor(email?: string): Assignment[] {
  const key = emailKey(email)
  if (!key) return []
  return MOCK_TOURNAMENTS
    .filter(t => t.status !== 'draft')
    .flatMap(t => (t.officials ?? [])
      .filter(o => emailKey(o.email) === key && staffRoleOf(o))
      .map(o => ({ tournament: t, official: o, role: staffRoleOf(o)!, window: accessWindow(t) })))
    .sort((a, b) => WINDOW_ORDER[a.window] - WINDOW_ORDER[b.window] || a.tournament.startDate.localeCompare(b.tournament.startDate))
}

export const assignmentFor = (email: string | undefined, tournamentId: string) =>
  assignmentsFor(email).find(a => a.tournament.id === tournamentId)

/** The person filling a role on a tournament (first one with a login), e.g. the marshal on duty */
export const staffOn = (t: Tournament, role: StaffRole) =>
  (t.officials ?? []).find(o => staffRoleOf(o) === role && o.email && o.name)

export function authenticateStaff(email: string, password: string):
  { ok: true; email: string; name: string } | { ok: false; reason: 'unknown' | 'invalid' } {
  const key = emailKey(email)
  // The golfer's own account signs in as a golfer; their marshal duties are offered from there
  if (key === emailKey(MOCK_PROFILE.email)) return { ok: false, reason: 'unknown' }
  const list = assignmentsFor(key)
  if (!list.length) return { ok: false, reason: 'unknown' }
  if (password !== (DEMO_PASSWORDS[key] ?? INVITE_PASSWORD)) return { ok: false, reason: 'invalid' }
  // First sign-in accepts the invitation
  if (!data.accepted[key]) { data.accepted[key] = new Date().toISOString(); save() }
  return { ok: true, email: key, name: list[0].official.name }
}

/* ───────── Clock ───────── */

/**
 * Time stamps on tournament day use the course clock (see paceFor), so the log reads like the day it
 * describes. Seconds come from the real clock to keep entries in order.
 */
function stamp(tournamentId: string) {
  const t = MOCK_TOURNAMENTS.find(x => x.id === tournamentId)
  if (!t || t.status !== 'in-progress') return new Date().toISOString().slice(0, 19)
  return `${t.startDate}T${paceFor(t, 1).clock}:${String(new Date().getSeconds()).padStart(2, '0')}`
}

/* ───────── Incidents ───────── */

export type IncidentKind = 'slow-play' | 'cart' | 'rules' | 'score-dispute' | 'safety' | 'other'

export const INCIDENT_KINDS: { value: IncidentKind; label: string; hint: string }[] = [
  { value: 'slow-play', label: 'Slow play', hint: 'Out of position or holding up the groups behind' },
  { value: 'cart', label: 'Cart rule', hint: 'Cart near a green, in a no-cart area, or too many riders' },
  { value: 'rules', label: 'Rules question', hint: 'Drop, penalty area, out of bounds, free relief' },
  { value: 'score-dispute', label: 'Score dispute', hint: 'Players don’t agree on a score' },
  { value: 'safety', label: 'Safety / conduct', hint: 'Hitting into the group ahead, behaviour' },
  { value: 'other', label: 'Other', hint: 'Anything else worth recording' },
]
export const incidentKindLabel = (k: IncidentKind) => INCIDENT_KINDS.find(x => x.value === k)?.label ?? k

/** open = on the course · committee = waiting for an organiser or official to decide · resolved */
export type IncidentStatus = 'open' | 'committee' | 'resolved'

export interface IncidentUpdate { at: string; by: Actor; text: string }

export interface Incident {
  id: string
  tournamentId: string
  round: number
  kind: IncidentKind
  hole?: number
  /** Players involved */
  entryIds: string[]
  note: string
  raisedBy: Actor
  at: string
  status: IncidentStatus
  updates: IncidentUpdate[]
  decision?: string
  decidedBy?: Actor
  decidedAt?: string
  /** Score changes made because of this decision */
  scoreChangeIds?: string[]
}

export const incidentsFor = (tournamentId: string) =>
  data.incidents.filter(i => i.tournamentId === tournamentId).sort((a, b) => b.at.localeCompare(a.at))

export const openIncidentCount = (tournamentId: string) =>
  data.incidents.filter(i => i.tournamentId === tournamentId && i.status !== 'resolved').length

export function logIncident(input: Pick<Incident, 'tournamentId' | 'round' | 'kind' | 'hole' | 'entryIds' | 'note' | 'raisedBy'> & { status?: IncidentStatus }) {
  const incident: Incident = { ...input, id: uid('inc'), at: stamp(input.tournamentId), status: input.status ?? 'open', updates: [] }
  data.incidents.push(incident)
  save()
  return incident
}

export function addIncidentNote(id: string, by: Actor, text: string) {
  const i = data.incidents.find(x => x.id === id)
  if (!i || !text.trim()) return
  i.updates.push({ at: stamp(i.tournamentId), by, text: text.trim() })
  save()
}

/** Marshal can't settle it on the course: the committee (organisers and officials) decides */
export function sendToCommittee(id: string, by: Actor, text?: string) {
  const i = data.incidents.find(x => x.id === id)
  if (!i) return
  i.status = 'committee'
  i.updates.push({ at: stamp(i.tournamentId), by, text: text?.trim() || 'Sent to the committee' })
  save()
}

/**
 * Closes an incident with a decision. A committee decision can change a score; the change goes
 * through correctScore so it lands in the audit trail with the incident attached.
 */
export function resolveIncident(id: string, by: Actor, decision: string, change?: { t: Tournament; entryId: string; holeIndex: number; strokes: number }) {
  const i = data.incidents.find(x => x.id === id)
  if (!i) return
  if (change) {
    const c = correctScore(change.t, change.entryId, i.round, change.holeIndex, change.strokes, `Committee decision: ${decision}`, by, i.id)
    if (c) i.scoreChangeIds = [...(i.scoreChangeIds ?? []), c.id]
  }
  Object.assign(i, { status: 'resolved', decision: decision.trim(), decidedBy: by, decidedAt: stamp(i.tournamentId) })
  save()
}

/* ───────── Score changes (audit trail) ───────── */

export interface ScoreChange {
  id: string
  tournamentId: string
  entryId: string
  round: number
  holeIndex: number
  hole: number
  from: number | null
  to: number | null
  reason: string
  by: Actor
  at: string
  incidentId?: string
}

export const scoreChangesFor = (tournamentId: string, entryId?: string) =>
  data.changes.filter(c => c.tournamentId === tournamentId && (!entryId || c.entryId === entryId)).sort((a, b) => b.at.localeCompare(a.at))

/** Every change to an entered score after the fact goes through here, with a reason. */
export function correctScore(t: Tournament, entryId: string, round: number, holeIndex: number, to: number | null, reason: string, by: Actor, incidentId?: string) {
  const from = cardFor(t, entryId, round)[holeIndex]
  if (from === to) return undefined
  const course = getCourse(t.courseId)
  const hole = course ? roundHoles(t, course, round)[holeIndex]?.hole ?? holeIndex + 1 : holeIndex + 1
  setStrokes(t, entryId, round, holeIndex, to)
  const change: ScoreChange = { id: uid('chg'), tournamentId: t.id, entryId, round, holeIndex, hole, from, to, reason: reason.trim(), by, at: stamp(t.id), incidentId }
  data.changes.push(change)
  save()
  return change
}

/* ───────── Markers ───────── */

/**
 * Partners in a group mark each other: 1st ↔ 2nd and 3rd ↔ 4th (a lone last player is marked by the one
 * before). Each player enters their own score and their partner's; the two cards must agree.
 */
export function markerOf(tournamentId: string, round: number, entryId: string): Entry | undefined {
  const g = groupsFor(tournamentId, round).find(x => x.entryIds.includes(entryId))
  if (!g) return undefined
  const i = g.entryIds.indexOf(entryId)
  const j = i % 2 === 0 ? (i + 1 < g.entryIds.length ? i + 1 : i - 1) : i - 1
  if (j < 0 || j === i) return undefined
  return entriesFor(tournamentId).find(e => e.id === g.entryIds[j])
}

/** The players this person marks */
export function markedBy(tournamentId: string, round: number, entryId: string): Entry[] {
  const g = groupsFor(tournamentId, round).find(x => x.entryIds.includes(entryId))
  if (!g) return []
  return entriesFor(tournamentId).filter(e => g.entryIds.includes(e.id) && e.id !== entryId && markerOf(tournamentId, round, e.id)?.id === entryId)
}

/**
 * The marker's record of a player's card. Simulated markers agree unless the seed or the golfer says
 * otherwise; when the signed-in golfer is the marker, only what they entered counts.
 */
export function markerCardFor(t: Tournament, entryId: string, round: number): (number | null)[] {
  const own = cardFor(t, entryId, round)
  const marker = markerOf(t.id, round, entryId)
  const explicit = data.marker[t.id]?.[entryId]?.[round] ?? []
  return own.map((s, i) => (explicit[i] !== undefined && explicit[i] !== null ? explicit[i] : marker?.isMe ? null : s))
}

export function setMarkerStrokes(t: Tournament, entryId: string, round: number, holeIndex: number, strokes: number | null) {
  const card = [...(data.marker[t.id]?.[entryId]?.[round] ?? [])]
  card[holeIndex] = strokes
  ;((data.marker[t.id] ??= {})[entryId] ??= {})[round] = card
  save()
}

/** Holes where the player's own score and their marker's record differ */
export function mismatches(t: Tournament, entryId: string, round: number): number[] {
  const own = cardFor(t, entryId, round)
  const marked = markerCardFor(t, entryId, round)
  return own.flatMap((s, i) => (s !== null && marked[i] !== null && marked[i] !== s ? [i] : []))
}

/* ───────── Pace of play ───────── */

export type PaceStatus = 'not-started' | 'on-pace' | 'behind' | 'out-of-position' | 'finished'

export const PACE_LABEL: Record<PaceStatus, string> = {
  'not-started': 'Not started', 'on-pace': 'On pace', behind: 'Behind', 'out-of-position': 'Out of position', finished: 'Finished',
}

export interface GroupPace {
  group: TeeGroup
  players: Entry[]
  /** Holes the whole group has finished */
  thru: number
  /** Hole they're on now (null before the start or after the last hole) */
  onHole: number | null
  behindMinutes: number
  /** Holes between this group and the one ahead (2+ means an empty hole in front of them) */
  gapHoles: number | null
  status: PaceStatus
}

const toMinutes = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0) }

/**
 * Pace from the scores entered. The prototype's clock is set by the group furthest ahead of schedule,
 * so every other group's lag is relative to them. With GPS cart tags (TagMarshal) this would use
 * real positions and times instead.
 */
export function paceFor(t: Tournament, round = 1) {
  const course = getCourse(t.courseId)
  const holes = course ? roundHoles(t, course, round).length : 18
  const minutesPerHole = (t.pace?.targetMinutes ?? 255) / holes
  const flagMinutes = t.pace?.flagMinutes ?? 10
  const field = entriesFor(t.id)
  const base = groupsFor(t.id, round)
    .slice()
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time) || a.startHole - b.startHole)
    .map(group => {
      const players = group.entryIds.map(id => field.find(e => e.id === id)).filter((e): e is Entry => !!e)
      const thrus = players.map(p => cardFor(t, p.id, round).filter(s => s !== null).length)
      return { group, players, thru: thrus.length ? Math.min(...thrus) : 0 }
    })

  const first = base.length ? toMinutes(base[0].group.time) : 0
  const clock = t.status === 'in-progress' && base.some(b => b.thru > 0)
    ? Math.max(...base.map(b => toMinutes(b.group.time) + (b.thru + 0.5) * minutesPerHole))
    : t.status === 'completed' ? first + holes * minutesPerHole + 60 : first - 15

  const groups: GroupPace[] = base.map((b, i) => {
    const elapsed = clock - toMinutes(b.group.time)
    const expected = Math.max(0, Math.min(holes, Math.floor(elapsed / minutesPerHole)))
    const behindMinutes = Math.max(0, Math.round((expected - b.thru) * minutesPerHole))
    const ahead = base.slice(0, i).reverse().find(x => x.group.startHole === b.group.startHole)
    const gapHoles = ahead ? ahead.thru - b.thru : null
    const finished = b.thru >= holes || t.status === 'completed'
    const status: PaceStatus =
      finished ? 'finished'
      : elapsed < 0 || (b.thru === 0 && t.status !== 'in-progress') ? 'not-started'
      : gapHoles !== null && gapHoles >= 2 && behindMinutes > 0 ? 'out-of-position'
      : behindMinutes >= flagMinutes ? 'behind'
      : 'on-pace'
    const onHole = finished || status === 'not-started' ? null : ((b.group.startHole - 1 + b.thru) % holes) + 1
    return { ...b, thru: finished ? holes : b.thru, onHole, behindMinutes: finished ? 0 : behindMinutes, gapHoles, status }
  })

  return { clock: addMinutes('00:00', Math.max(0, Math.round(clock))), minutesPerHole, flagMinutes, holes, groups }
}

/* ───────── Store ───────── */

interface OpsData {
  incidents: Incident[]
  changes: ScoreChange[]
  /** marker[tournamentId][entryId][round] = the marker's entries for that player (gaps = not entered) */
  marker: Record<string, Record<string, Record<number, (number | null)[]>>>
  /** email → when they first signed in (accepted their invitation) */
  accepted: Record<string, string>
}

const STORAGE_KEY = 'gtp-ops-v1'

let data: OpsData = { incidents: [], changes: [], marker: {}, accepted: {} }
let version = 0
const listeners = new Set<() => void>()

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* private mode: session only */ }
  version++
  listeners.forEach(l => l())
}

export function useOpsVersion() {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => version)
}

/** Seeds the live tournament with a day's worth of marshal and committee work to look at. */
function seed(): OpsData {
  const fresh: OpsData = { incidents: [], changes: [], marker: {}, accepted: {} }
  data = fresh
  const t = MOCK_TOURNAMENTS.find(x => x.status === 'in-progress')
  if (!t) return fresh
  const round = 1
  const groups = groupsFor(t.id, round)
  if (!groups.length) return fresh
  const field = entriesFor(t.id)
  const name = (id: string) => field.find(e => e.id === id)?.name ?? 'A player'
  // Seeded entries happened shortly before the course clock
  const clock = paceFor(t, round).clock
  const at = (minutesAgo: number) => `${t.startDate}T${addMinutes(clock, -minutesAgo)}:00`
  const marshal: Actor = { name: staffOn(t, 'marshal')?.name ?? 'Marshal', role: 'marshal' }
  const setMarker = (entryId: string, card: (number | null)[]) => { ((fresh.marker[t.id] ??= {})[entryId] ??= {})[round] = card }

  // The golfer's marker wrote down one stroke more on a hole: the golfer sees it on their card
  const me = field.find(e => e.isMe)
  if (me) {
    const own = cardFor(t, me.id, round)
    const played = own.filter(s => s !== null).length
    const idx = own[1] !== null ? 1 : own.findIndex(s => s !== null)
    if (idx >= 0) { const c: (number | null)[] = []; c[idx] = (own[idx] ?? 4) + 1; setMarker(me.id, c) }
    // …and the golfer has marked their partner on every hole so far
    for (const p of markedBy(t.id, round, me.id)) setMarker(p.id, cardFor(t, p.id, round).map((s, i) => (i < played ? s : null)))
  }

  // Another pair couldn't agree and went to the committee: the furthest-along player outside the golfer's group
  const played = (id: string) => cardFor(t, id, round).filter(s => s !== null).length
  const disputed = groups
    .filter(g => !g.entryIds.some(id => id === me?.id))
    .flatMap(g => g.entryIds)
    .filter(id => played(id) >= 1 && markerOf(t.id, round, id))
    .sort((a, b) => played(b) - played(a))[0]
  if (disputed) {
    const own = cardFor(t, disputed, round)
    const hi = played(disputed) - 1
    const holeNo = (getCourse(t.courseId) ? roundHoles(t, getCourse(t.courseId)!, round)[hi]?.hole : undefined) ?? hi + 1
    const c: (number | null)[] = []
    c[hi] = (own[hi] ?? 4) + 1
    setMarker(disputed, c)
    const markerName = name(markerOf(t.id, round, disputed)?.id ?? '')
    fresh.incidents.push({
      id: 'inc-seed-dispute', tournamentId: t.id, round, kind: 'score-dispute', hole: holeNo, entryIds: [disputed],
      note: `${name(disputed)} has ${own[hi]} on hole ${holeNo}; their marker ${markerName} recorded ${c[hi]}. They couldn't agree on the course.`,
      raisedBy: { name: markerName, role: 'golfer' }, at: at(9), status: 'committee',
      updates: [{ at: at(6), by: marshal, text: 'Spoke to both players. The ball moved while addressing it in the bunker; they disagree whether it counts. Sent to the committee.' }],
    })
  }

  const g = (i: number) => groups[Math.min(i, groups.length - 1)]
  fresh.incidents.push(
    {
      id: 'inc-seed-slow', tournamentId: t.id, round, kind: 'slow-play', hole: 1, entryIds: g(2).entryIds,
      note: 'Group a full hole behind the group ahead after a lost-ball search on the 1st.',
      raisedBy: marshal, at: at(52), status: 'resolved', updates: [],
      decision: 'Warned the group and timed them on the next hole; back in position.', decidedBy: marshal, decidedAt: at(40),
    },
    {
      id: 'inc-seed-cart', tournamentId: t.id, round, kind: 'cart', hole: 3, entryIds: g(0).entryIds.slice(0, 2),
      note: 'Cart 16 driven onto the apron of the 3rd green.',
      raisedBy: marshal, at: at(12), status: 'open', updates: [],
    },
    {
      id: 'inc-seed-rules', tournamentId: t.id, round, kind: 'rules', hole: 2, entryIds: g(1).entryIds.slice(0, 1),
      note: 'Ball in the red-staked area left of the 2nd fairway. Player asked about relief.',
      raisedBy: marshal, at: at(30), status: 'resolved', updates: [],
      decision: 'Explained penalty-area relief: one stroke, drop within two club-lengths. Player took it.', decidedBy: marshal, decidedAt: at(28),
    },
  )
  return fresh
}

export function resetOpsData() {
  data = seed()
  save()
}

/* ───────── Load (last, so every helper above is initialised) ───────── */

;(function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) { data = { ...{ incidents: [], changes: [], marker: {}, accepted: {} }, ...JSON.parse(raw) }; return }
  } catch { /* fall through to seed */ }
  data = seed()
})()
