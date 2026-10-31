import { useState, type ReactNode } from 'react'
import type { SharedNavProps, Tournament } from '../types'
import { Avatar, Button, StatusBadge, IconSignOut, RoundButton, IconBack } from '../components'
import { MOCK_PROFILE, MOCK_TOURNAMENTS } from '../data'
import { cardState, entriesFor, leaderboard, myEntry, simulateTick, suspensionFor, useLiveVersion } from '../live'
import { formatClock, formatDay, toPar } from '../golf'
import {
  STAFF_ROLE_LABEL, activityFor, assignmentsFor, currentRound, incidentsFor, mismatches, paceFor, pendingRequests, roundNumbers, signOffChecks, signOffFor, useOpsVersion,
  type Actor, type Assignment, type GroupPace,
} from '../ops'
import {
  Card, ChangesList, CourseRules, IncidentList, IncidentSheet, MyRequests, NeedsList, OrganiserDecisions, OverallList, PaceList, ResumeSheet, RoundResults, ScorecardList, Segments, SlotList, SuspendSheet,
  SuspendedBanner, TeeSheetList, WaitingForOrganiser, fmtTime,
} from '../ops-ui'
import type { Account } from '../accounts'

/*
 * Phone screens for marshals, tournament officials and organisers. Each tab works on one tournament:
 * the marshal's or official's assignment, or the organiser's live event.
 */

export interface RoleContext {
  account: Account
  /** The tournament this session is working on */
  t?: Tournament
  assignment?: Assignment
  actor: Actor
  /** Pick another assignment (staff with several tournaments) */
  selectTournament: (id: string) => void
  onSignOut: () => void
  /** The golfer who is also a marshal goes back to their golf */
  switchToGolf?: () => void
}

type RoleProps = SharedNavProps & { ctx: RoleContext }

function Screen({ eyebrow, title, right, onBack, children }: { eyebrow?: string; title: string; right?: ReactNode; onBack?: () => void; children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto no-scrollbar smooth-scroll">
      <div className="px-5 pt-3 pb-8 space-y-4">
        <div className="flex items-end gap-3">
          {onBack && <RoundButton onClick={onBack} label="Back"><IconBack /></RoundButton>}
          <div className="flex-1 min-w-0">
            {eyebrow && <p className="text-[12px] text-gray-500 font-semibold truncate">{eyebrow}</p>}
            <h1 className="font-display font-extrabold text-ink text-[24px] leading-tight tracking-tight">{title}</h1>
          </div>
          {right}
        </div>
        {children}
      </div>
    </div>
  )
}

function Stats({ items }: { items: [string, ReactNode, boolean?][] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {items.map(([label, value, warn], i) => (
        <div key={label} className={`rounded-3xl p-4 ${i === 0 ? 'bg-ink' : warn ? 'bg-rose-50' : 'bg-white shadow-card'}`}>
          <p className={`font-display font-extrabold text-[26px] leading-none ${i === 0 ? 'text-lime-400' : warn ? 'text-rose-700' : 'text-ink'}`}>{value}</p>
          <p className={`text-[12px] font-semibold mt-1.5 ${i === 0 ? 'text-white/55' : warn ? 'text-rose-700' : 'text-gray-500'}`}>{label}</p>
        </div>
      ))}
    </div>
  )
}

function NoTournament({ ctx, push }: RoleProps) {
  return (
    <Card className="p-6 text-center">
      <p className="font-display font-bold text-ink text-[17px]">{ctx.assignment?.window === 'upcoming' ? 'Not tournament day yet' : 'No live tournament'}</p>
      <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">
        {ctx.assignment?.window === 'upcoming'
          ? `Your console opens on ${formatDay(ctx.t!.startDate)}. Until then you can see the tee sheet and contacts.`
          : 'This opens when one of your tournaments starts.'}
      </p>
      <Button size="sm" variant="secondary" className="mt-4" onClick={() => push('staff-profile')}>My assignments</Button>
    </Card>
  )
}

const eyebrow = (ctx: RoleContext) => `${ctx.actor.role === 'organiser' ? 'Organiser' : STAFF_ROLE_LABEL[ctx.actor.role as 'marshal' | 'official']} · ${ctx.t?.name ?? ''}`
const isLive = (ctx: RoleContext) => ctx.t?.status === 'in-progress'

/* ───────── Marshal / official / organiser tabs ───────── */

export function PaceScreen(props: RoleProps) {
  useLiveVersion()
  useOpsVersion()
  const { ctx, showToast, canGoBack, pop } = props
  const [log, setLog] = useState<GroupPace | null>(null)
  if (!ctx.t || !isLive(ctx)) return <Screen title="Pace of play"><NoTournament {...props} /></Screen>
  const t = ctx.t
  const round = currentRound(t)
  const pace = paceFor(t, round)
  return (
    <div className="h-full relative">
      <Screen eyebrow={eyebrow(ctx)} title="Pace of play" onBack={canGoBack ? pop : undefined} right={<span className="text-[12px] font-semibold text-gray-500 pb-1">Course clock {formatClock(pace.clock)}</span>}>
        <SuspendedBanner t={t} />
        <Stats items={[
          ['On the course', pace.groups.filter(g => g.onHole).length],
          ['Behind', pace.groups.filter(g => g.status === 'behind').length],
          ['Out of position', pace.groups.filter(g => g.status === 'out-of-position').length, pace.groups.some(g => g.status === 'out-of-position')],
          ['Open incidents', incidentsFor(t.id).filter(i => i.status === 'open').length],
        ]} />
        <PaceList t={t} round={round} onLog={ctx.actor.role === 'marshal' ? setLog : undefined} />
        <p className="text-[11px] text-gray-500 leading-relaxed px-1">Positions come from the scores golfers enter. With GPS cart tags (TagMarshal) this shows live positions and no-cart-zone alerts.</p>
      </Screen>
      {log && (
        <IncidentSheet t={t} round={round} actor={ctx.actor} onClose={() => setLog(null)} showToast={showToast}
          preset={{ kind: 'slow-play', hole: log.onHole ?? undefined, entryIds: log.players.map(p => p.id), note: log.status === 'out-of-position' ? `Out of position: ${log.gapHoles} holes behind the group ahead.` : `${log.behindMinutes} min behind pace.` }} />
      )}
    </div>
  )
}

export function IssuesScreen(props: RoleProps) {
  const { ctx, showToast } = props
  if (!ctx.t || !isLive(ctx)) return <Screen title="Incidents"><NoTournament {...props} /></Screen>
  return (
    <div className="h-full relative">
      <Screen eyebrow={eyebrow(ctx)} title={ctx.actor.role === 'marshal' ? 'Incidents' : 'Disputes & rulings'}>
        <SuspendedBanner t={ctx.t} />
        <IncidentList t={ctx.t} round={currentRound(ctx.t)} actor={ctx.actor} showToast={showToast} />
      </Screen>
    </div>
  )
}

export function CardsScreen(props: RoleProps) {
  useLiveVersion()
  useOpsVersion()
  const { ctx, showToast } = props
  const [view, setView] = useState<'cards' | 'changes'>('cards')
  const [picked, setPicked] = useState<number | null>(null)
  if (!ctx.t || !isLive(ctx)) return <Screen title="Scorecards"><NoTournament {...props} /></Screen>
  const t = ctx.t
  const round = picked ?? currentRound(t)
  const rounds = roundNumbers(t)
  const field = entriesFor(t.id).filter(e => e.status === 'registered')
  return (
    <div className="h-full relative">
      <Screen eyebrow={eyebrow(ctx)} title="Scorecards">
        {rounds.length > 1 && <Segments value={String(round)} onChange={v => setPicked(Number(v))} options={rounds.map(n => ({ value: String(n), label: `Round ${n}` }))} />}
        <Stats items={[
          ['To verify', field.filter(e => cardState(t.id, e.id, round) === 'submitted').length],
          ['Score discrepancies', field.filter(e => mismatches(t, e.id, round).length).length, field.some(e => mismatches(t, e.id, round).length)],
        ]} />
        <Segments value={view} onChange={setView} options={[{ value: 'cards', label: 'Cards' }, { value: 'changes', label: `Change log (${activityFor(t).length})` }]} />
        {view === 'cards' ? <ScorecardList key={round} t={t} round={round} actor={ctx.actor} canManage showToast={showToast} /> : <ChangesList t={t} />}
      </Screen>
    </div>
  )
}

/** Round results and sign-off for the official; the organiser follows the same list and publishes from the web console */
export function ResultsScreen(props: RoleProps) {
  useLiveVersion()
  useOpsVersion()
  const { ctx, showToast, showDialog } = props
  const [picked, setPicked] = useState<number | 'overall' | null>(null)
  const t = ctx.t
  if (!t || (t.status !== 'in-progress' && t.status !== 'completed')) return <Screen title="Results"><NoTournament {...props} /></Screen>
  const rounds = roundNumbers(t)
  const view = picked ?? currentRound(t)
  return (
    <div className="h-full relative">
      <Screen eyebrow={eyebrow(ctx)} title="Results">
        {rounds.length > 1 && (
          <Segments value={String(view)} onChange={v => setPicked(v === 'overall' ? 'overall' : Number(v))}
            options={[...rounds.map(n => ({ value: String(n), label: `Round ${n}` })), { value: 'overall', label: 'Overall' }]} />
        )}
        {view === 'overall' ? <OverallList t={t} /> : <RoundResults key={view} t={t} round={view} actor={ctx.actor} canSignOff={ctx.actor.role === 'official'} showToast={showToast} showDialog={showDialog} />}
        {ctx.actor.role === 'organiser' && <p className="text-[11px] text-gray-500 px-1 leading-relaxed">Confirming winners, publishing results and reports are on the web console.</p>}
      </Screen>
    </div>
  )
}

export function TeeSheetScreen(props: RoleProps) {
  const { ctx, canGoBack, pop } = props
  if (!ctx.t) return <Screen title="Tee sheet"><NoTournament {...props} /></Screen>
  return (
    <Screen eyebrow={eyebrow(ctx)} title="Tee sheet & contacts" onBack={canGoBack ? pop : undefined}>
      {ctx.assignment?.window === 'upcoming' && (
        <p className="rounded-2xl bg-amber-50 text-amber-800 text-[13px] px-4 py-3 leading-relaxed"><span className="font-bold">Opens {formatDay(ctx.t.startDate)}.</span> Full console on tournament day.</p>
      )}
      <TeeSheetList t={ctx.t} round={currentRound(ctx.t)} />
    </Screen>
  )
}

/** Organiser's tournament-day overview on the phone; set-up and field changes stay on the web console */
export function TodayScreen(props: RoleProps) {
  useLiveVersion()
  useOpsVersion()
  const { ctx, showToast, push } = props
  const [sheet, setSheet] = useState<'suspend' | 'resume' | null>(null)
  const t = ctx.t
  if (!t) return <Screen title="Today"><Card className="p-6 text-center"><p className="font-display font-bold text-ink text-[17px]">No tournaments yet</p><p className="text-[13px] text-gray-500 mt-1.5">Create tournaments on the web console.</p></Card></Screen>
  const round = currentRound(t)
  const field = entriesFor(t.id).filter(e => e.status === 'registered')
  const verified = field.filter(e => cardState(t.id, e.id, round) === 'verified').length
  const decisions = incidentsFor(t.id).filter(i => i.status === 'committee').length
  const live = isLive(ctx)
  const s = suspensionFor(t.id)
  return (
    <div className="h-full relative">
    <Screen eyebrow={(ctx.account as { orgName?: string }).orgName ?? 'Organiser'} title="Today"
      right={live ? <StatusBadge status="in-progress" /> : undefined}>
      <Card className="p-4">
        <p className="font-display font-bold text-ink text-[17px] leading-tight">{t.name}</p>
        <p className="text-[12px] text-gray-500 mt-0.5">{t.dateRange} · {t.venue}</p>
        {live && <Button size="sm" variant="secondary" className="mt-3" onClick={() => { simulateTick(t, round); showToast('Simulated the next hole', 'info') }}>Simulate next hole</Button>}
      </Card>
      {live ? (
        <>
          <SuspendedBanner t={t} />
          <OrganiserDecisions t={t} actor={ctx.actor} showToast={showToast} />
          <Stats items={[
            ['Players', field.length],
            ['Cards verified', `${verified}/${field.length}`],
            ['Need a decision', decisions, decisions > 0],
            ['Behind pace', paceFor(t, round).groups.filter(g => g.status === 'behind' || g.status === 'out-of-position').length],
          ]} />
          {decisions > 0 && <Button fullWidth onClick={() => push('issues')}>Decide {decisions} dispute{decisions > 1 ? 's' : ''}</Button>}
          {s
            ? <Button fullWidth onClick={() => setSheet('resume')}>Resume play</Button>
            : <button onClick={() => setSheet('suspend')} className="w-full h-12 rounded-full bg-red-50 text-red-600 ring-1 ring-red-200 text-[14px] font-bold font-display">Suspend play (weather, darkness)</button>}
          <p className="text-[13px] font-bold text-gray-500 font-display px-1 pt-1">Groups needing attention</p>
          <PaceList t={t} round={round} compact />
        </>
      ) : (
        <p className="text-[13px] text-gray-500 px-1">{t.status === 'completed' ? 'This tournament is closed. The Results tab has the final order.' : `Starts ${formatDay(t.startDate)}. Tournament-day tools appear here once it’s live.`}</p>
      )}
      <p className="text-[13px] font-bold text-gray-500 font-display px-1 pt-1">Marshals & officials</p>
      <SlotList t={t} />
      <p className="text-[11px] text-gray-500 px-1 leading-relaxed">Set-up, the field, tee sheet changes and sending logins are on the web console.</p>
    </Screen>
    {sheet === 'suspend' && <SuspendSheet t={t} round={round} actor={ctx.actor} onClose={() => setSheet(null)} showToast={showToast} />}
    {sheet === 'resume' && <ResumeSheet t={t} round={round} actor={ctx.actor} onClose={() => setSheet(null)} showToast={showToast} />}
    </div>
  )
}

/** The tournament official's day on the phone: what needs them, stopping play, and how close the round is to sign-off */
export function OfficialTodayScreen(props: RoleProps) {
  useLiveVersion()
  useOpsVersion()
  const { ctx, push, showToast } = props
  const [sheet, setSheet] = useState<'suspend' | 'resume' | null>(null)
  if (!ctx.t || !isLive(ctx)) return <Screen title="Today"><NoTournament {...props} /></Screen>
  const t = ctx.t
  const round = currentRound(t)
  const field = entriesFor(t.id).filter(e => e.status === 'registered')
  const s = suspensionFor(t.id)
  const checks = signOffChecks(t, round)
  const signed = signOffFor(t.id, round)
  const decisions = incidentsFor(t.id).filter(i => i.status === 'committee').length
  const asked = pendingRequests(t.id).find(r => r.kind !== 'dq')
  const open = (tab: 'incidents' | 'scorecards' | 'pace') => push(tab === 'incidents' ? 'issues' : tab === 'scorecards' ? 'cards' : 'pace')
  return (
    <div className="h-full relative">
      <Screen eyebrow={eyebrow(ctx)} title="Today" right={<StatusBadge status="in-progress" />}>
        <Stats items={[
          ['Cards to verify', field.filter(e => cardState(t.id, e.id, round) === 'submitted').length],
          ['Need a decision', decisions, decisions > 0],
          ['Score discrepancies', field.filter(e => mismatches(t, e.id, round).length).length],
          ['Behind pace', paceFor(t, round).groups.filter(g => g.status === 'behind' || g.status === 'out-of-position').length],
        ]} />
        {s ? (
          <div className="rounded-3xl bg-rose-600 text-white p-4">
            <p className="font-display font-bold text-[16px]">Play suspended · {fmtTime(s.at)}</p>
            <p className="text-[13px] text-white/85 mt-0.5 leading-snug">{s.reason}{s.note ? ` — ${s.note}` : ''}</p>
            {!asked && <button onClick={() => setSheet('resume')} className="mt-3 w-full h-11 rounded-full bg-white text-rose-700 text-[14px] font-bold font-display">Ask the organiser to resume</button>}
          </div>
        ) : !asked && (
          <button onClick={() => setSheet('suspend')} disabled={!!signed}
            className="w-full h-12 rounded-full bg-red-50 text-red-600 ring-1 ring-red-200 text-[14px] font-bold font-display disabled:opacity-40">Ask the organiser to suspend play</button>
        )}
        {asked && <WaitingForOrganiser t={t} at={asked.at} />}
        <p className="text-[13px] font-bold text-gray-500 font-display px-1 pt-1">Needs you now</p>
        <NeedsList t={t} round={round} onOpen={open} />
        <MyRequests t={t} />
        <p className="text-[13px] font-bold text-gray-500 font-display px-1 pt-1">Round {round} sign-off</p>
        <Card className="p-4">
          {signed ? (
            <p className="text-[13px] text-emerald-800 leading-relaxed"><span className="font-bold">Signed off by {signed.by.name}</span> at {fmtTime(signed.at)}. The organiser publishes the results.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between">
                <span className="font-display font-extrabold text-ink text-[22px]">{checks.verified}/{checks.playing}</span>
                <span className="text-[12px] font-semibold text-gray-500">cards verified</span>
              </div>
              <div className="h-2 rounded-full bg-canvas mt-2 overflow-hidden"><div className="h-full bg-lime-400" style={{ width: `${checks.playing ? (checks.verified / checks.playing) * 100 : 0}%` }} /></div>
              {(checks.decisions > 0 || checks.requests > 0) && <p className="text-[12px] text-gray-500 mt-2.5 leading-relaxed">{checks.decisions > 0 ? `${checks.decisions} dispute${checks.decisions > 1 ? 's' : ''} to decide first. ` : ''}{checks.requests > 0 ? `${checks.requests} decision${checks.requests > 1 ? 's' : ''} with the organiser.` : ''}</p>}
              <Button size="sm" variant="secondary" fullWidth className="mt-3" onClick={() => push('results')}>Go to results</Button>
            </>
          )}
        </Card>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" size="sm" onClick={() => push('tee-sheet')}>Tee sheet & contacts</Button>
          <Button variant="secondary" size="sm" onClick={() => push('course-rules')}>Course & rules</Button>
          <Button variant="secondary" size="sm" className="col-span-2" onClick={() => push('pace')}>Pace of play</Button>
        </div>
      </Screen>
      {sheet === 'suspend' && <SuspendSheet t={t} round={round} actor={ctx.actor} onClose={() => setSheet(null)} showToast={showToast} />}
      {sheet === 'resume' && <ResumeSheet t={t} round={round} actor={ctx.actor} onClose={() => setSheet(null)} showToast={showToast} />}
    </div>
  )
}

export function CourseRulesScreen(props: RoleProps) {
  const { ctx, canGoBack, pop } = props
  if (!ctx.t) return <Screen title="Course & rules"><NoTournament {...props} /></Screen>
  return (
    <Screen eyebrow={eyebrow(ctx)} title="Course & rules" onBack={canGoBack ? pop : undefined}>
      <CourseRules t={ctx.t} round={currentRound(ctx.t)} />
    </Screen>
  )
}

/* ───────── Me (staff / organiser profile) ───────── */

const WINDOW_LABEL = { live: ['Live now', 'bg-rose-500 text-white'], upcoming: ['Upcoming', 'bg-amber-50 text-amber-700'], ended: ['Access ended', 'bg-gray-100 text-gray-500'] } as const

export function MeScreen({ ctx }: RoleProps) {
  useOpsVersion()
  const a = ctx.account
  const name = a.kind === 'golfer' ? `${MOCK_PROFILE.firstName} ${MOCK_PROFILE.lastName}` : a.name
  const email = a.kind === 'golfer' ? MOCK_PROFILE.email : a.email
  const list = a.kind === 'staff' || a.kind === 'golfer' ? assignmentsFor(email) : []
  return (
    <Screen title="Me">
      <Card className="p-5 flex items-center gap-4">
        <Avatar initials={name.split(/\s+/).map(w => w[0]).slice(0, 2).join('')} size="lg" />
        <div className="min-w-0">
          <p className="font-display font-extrabold text-ink text-[19px] leading-tight truncate">{name}</p>
          <p className="text-[13px] text-gray-500 truncate">{email}</p>
          <p className="text-[12px] font-bold text-pine-700 mt-1">
            {a.kind === 'organiser' ? `Organiser · ${a.orgName}` : a.kind === 'admin' ? 'Platform admin' : [...new Set(list.map(x => STAFF_ROLE_LABEL[x.role]))].join(' · ')}
          </p>
        </div>
      </Card>
      {list.length > 0 && (
        <>
          <p className="text-[13px] font-bold text-gray-500 font-display px-1">My assignments</p>
          <div className="space-y-2.5">
            {list.map(x => {
              const [label, cls] = WINDOW_LABEL[x.window]
              const current = ctx.t?.id === x.tournament.id
              return (
                <button key={x.tournament.id} disabled={x.window === 'ended'} onClick={() => ctx.selectTournament(x.tournament.id)}
                  className={`w-full text-left bg-white rounded-3xl shadow-card p-4 ${current ? 'ring-2 ring-lime-400' : ''} ${x.window === 'ended' ? 'opacity-60' : 'active:scale-[0.99]'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-bold font-display ${cls}`}>{label}</span>
                    <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-bold font-display bg-canvas text-ink">{STAFF_ROLE_LABEL[x.role]}</span>
                    {current && <span className="ml-auto text-[11px] font-bold text-pine-700">Open</span>}
                  </div>
                  <p className="font-display font-bold text-ink text-[15px] mt-2">{x.tournament.name}</p>
                  <p className="text-[12px] text-gray-500">{x.tournament.dateRange} · {x.window === 'ended' ? 'closed — your access ended' : x.tournament.venue}</p>
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-gray-500 px-1 leading-relaxed">Your login opens only these tournaments: tee sheet and contacts before the day, the full console on the day, nothing after it closes.</p>
        </>
      )}
      {ctx.switchToGolf && <Button variant="secondary" fullWidth onClick={ctx.switchToGolf}>⇄ Switch to my golf</Button>}
      <button onClick={ctx.onSignOut} className="w-full h-12 rounded-full bg-white shadow-card text-rose-600 text-[14px] font-bold font-display flex items-center justify-center gap-2">
        <IconSignOut /> Sign out
      </button>
    </Screen>
  )
}

/* ───────── Admin: web only ───────── */

export function WebOnlyScreen({ ctx }: RoleProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-8 text-center">
      <div className="w-20 h-20 rounded-full bg-ink flex items-center justify-center font-display font-extrabold text-lime-400 text-[22px]">GT</div>
      <h1 className="font-display font-extrabold text-ink text-[22px] mt-5">The admin console is on the web</h1>
      <p className="text-[14px] text-gray-500 mt-2 leading-relaxed">Organiser approvals, courses, roles and users are managed on a larger screen. Sign in at the web console with the same account.</p>
      <Button variant="secondary" className="mt-6" onClick={ctx.onSignOut}>Sign out</Button>
    </div>
  )
}

/* ───────── Golfer: Play tab ───────── */

/** The live tournament the golfer is playing in today, if any */
function liveRound() {
  const tournament = MOCK_TOURNAMENTS.find(x => x.status === 'in-progress' && myEntry(x.id)?.status === 'registered')
  const me = tournament ? myEntry(tournament.id) : undefined
  return tournament && me ? { tournament, me } : undefined
}

export function PlayScreen({ push }: RoleProps) {
  useLiveVersion()
  useOpsVersion()
  const live = liveRound()
  if (!live) {
    return (
      <Screen title="Play">
        <Card className="p-6 text-center">
          <p className="font-display font-bold text-ink text-[17px]">No round today</p>
          <p className="text-[13px] text-gray-500 mt-1.5 leading-relaxed">On tournament day this is where you score, mark the player you’re paired to mark and see the leaderboard.</p>
          <Button size="sm" variant="secondary" className="mt-4" onClick={() => push('tournaments')}>Find a tournament</Button>
        </Card>
      </Screen>
    )
  }
  const { tournament, me } = live
  const round = currentRound(tournament)
  const row = leaderboard(tournament, round).find(r => r.entry.id === me.id)
  const diff = mismatches(tournament, me.id, round).length
  const handedIn = cardState(tournament.id, me.id, round) !== 'in-progress'
  return (
    <Screen eyebrow={`${tournament.name} · round ${round}`} title="Play" right={<StatusBadge status="in-progress" />}>
      <div className="bg-ink rounded-[28px] p-5 text-white">
        <div className="grid grid-cols-3 gap-2 text-center">
          {[['Position', row?.position ?? '–'], ['To par', row?.thru ? toPar(row.grossToPar) : 'E'], ['Thru', row?.thru === row?.holes ? 'F' : String(row?.thru ?? 0)]].map(([l, v], i) => (
            <div key={l} className={`rounded-2xl py-3 ${i === 0 ? 'bg-lime-400 text-ink' : 'bg-white/[0.08]'}`}>
              <p className="font-display font-extrabold text-[26px] leading-none">{v}</p>
              <p className={`text-[11px] font-semibold mt-1 ${i === 0 ? 'text-pine-800' : 'text-white/55'}`}>{l}</p>
            </div>
          ))}
        </div>
        <button onClick={() => push('live-play', { id: tournament.id })}
          className="mt-4 w-full h-[52px] rounded-full bg-lime-400 text-ink text-[15px] font-bold font-display active:scale-[0.98] transition-transform">
          {handedIn ? `My scorecard · round ${round}` : `Continue scoring · hole ${Math.min((row?.thru ?? 0) + 1, row?.holes ?? 18)}`}
        </button>
      </div>
      {diff > 0 && (
        <button onClick={() => push('live-play', { id: tournament.id })} className="w-full text-left bg-rose-50 rounded-3xl p-4">
          <p className="font-display font-bold text-rose-800 text-[15px]">Score discrepancy on {diff} hole{diff > 1 ? 's' : ''}</p>
          <p className="text-[12px] text-rose-700 mt-0.5">Settle it before you submit your card.</p>
        </button>
      )}
      <Button variant="secondary" fullWidth onClick={() => push('leaderboard', { id: tournament.id })}>Live leaderboard</Button>
    </Screen>
  )
}
