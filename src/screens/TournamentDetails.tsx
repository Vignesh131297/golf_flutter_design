import { useState, useEffect, type ReactNode } from 'react'
import type { Division, SharedNavProps, Tournament } from '../types'
import {
  Button, StatusBadge, GlassChip, InfoTile, SpotsBar, RoundButton, SkeletonRow, ErrorState,
  IconBack, IconCalendar, IconPin, IconClock, IconCourse, IconUsers, IconCheckCircle,
} from '../components'
import { getTournament, getCourse, MOCK_PROFILE } from '../data'
import { ratingsGenderOf } from '../account-rules'
import { entriesFor, groupOf, myEntry, registerMe, registrantsFor, useLiveVersion, withdrawMe } from '../live'
import { Sheet } from '../ops-ui'
import {
  TIE_BREAK_OPTIONS, formatClock, formatDateTime, formatDay, formatMoney, isoDate, isoLocalDateTime, teeSwatch, teeTotal,
} from '../golf'
import { PaymentSheet } from '../payments'

interface TournamentDetailsProps extends SharedNavProps {
  tournamentId: string
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-7">
      <h2 className="font-display font-bold text-ink text-[17px] tracking-tight mb-3">{title}</h2>
      {children}
    </div>
  )
}

/** Registrant list (client, 17 Oct): only golfers registered for the tournament see who's playing */
function WhosPlaying({ t, players, isRegistered }: { t: Tournament; players: number; isRegistered: boolean }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const list = registrantsFor(t.id)
  const division = (id: string) => t.divisions?.find(d => d.id === id)?.name ?? ''
  const hi = (n: number) => (n < 0 ? `+${Math.abs(n).toFixed(1)}` : n.toFixed(1))
  const row = (e: (typeof list)[number]) => (
    <li key={e.id} className="flex items-center gap-3 py-2.5 border-b border-black/[0.05] last:border-0">
      <span className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-extrabold text-[12px] flex-shrink-0 ${e.isMe ? 'bg-lime-400 text-ink' : 'bg-canvas text-ink'}`}>
        {e.name.split(/\s+/).map(w => w[0]).slice(0, 2).join('')}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[14px] font-semibold text-ink truncate">{e.name}{e.isMe && <span className="ml-1.5 text-[11px] font-bold text-pine-700">You</span>}</span>
        <span className="block text-[11px] text-gray-500 truncate">{division(e.divisionId)}</span>
      </span>
      <span className="text-[13px] font-semibold text-gray-600">{hi(e.handicapIndex)}</span>
    </li>
  )
  if (!isRegistered) {
    return (
      <div className="rounded-2xl bg-white shadow-card px-4 py-3.5 flex items-center gap-3">
        <span className="w-9 h-9 rounded-full bg-canvas flex items-center justify-center text-gray-400 flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M8 10.5V7.5a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </span>
        <p className="text-[13px] text-gray-600 leading-snug">{players} registered. Register to see who else is playing.</p>
      </div>
    )
  }
  const shown = list.filter(e => !q.trim() || e.name.toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <>
      <div className="bg-white rounded-3xl shadow-card px-4 py-1">
        <ul>{list.slice(0, 5).map(row)}</ul>
      </div>
      <button onClick={() => setOpen(true)} className="mt-2.5 w-full h-11 rounded-full bg-white shadow-card text-[13px] font-bold font-display text-ink active:scale-[0.99]">
        See all {list.length} players
      </button>
      {open && (
        <Sheet title="Who's playing" subtitle={`${players} registered · name, division and handicap only`} onClose={() => setOpen(false)}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Find a player" aria-label="Find a player"
            className="h-11 w-full rounded-full bg-canvas px-4 text-[14px]" />
          <ul>{shown.map(row)}</ul>
          {shown.length === 0 && <p className="text-[14px] text-gray-500">No player matches "{q}".</p>}
        </Sheet>
      )}
    </>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-[13px] text-gray-500">{label}</dt>
      <dd className="text-[13px] font-semibold text-ink text-right">{value}</dd>
    </div>
  )
}

/** Why the signed-in golfer can't enter, or null when eligible. */
function eligibilityProblem(t: Tournament): string | null {
  const e = t.eligibility
  const hcp = MOCK_PROFILE.handicapIndex
  if (!e) return null
  if (e.maxHandicap !== undefined && hcp > e.maxHandicap) return `Handicap index ${e.maxHandicap} or lower is required (yours is ${hcp.toFixed(1)}).`
  if (e.minHandicap !== undefined && hcp < e.minHandicap) return `Handicap index ${e.minHandicap} or higher is required.`
  if (e.gender === 'men' && ratingsGenderOf(MOCK_PROFILE) === 'women') return 'This event is for men.'
  if (e.gender === 'women' && ratingsGenderOf(MOCK_PROFILE) !== 'women') return 'This event is for women.'
  if (e.officialHandicapRequired && !MOCK_PROFILE.handicapBody) return 'An official handicap is required.'
  if (e.membersOnly && MOCK_PROFILE.membership !== 'Member') return 'This event is for members of the host club.'
  return null
}

const divisionFor = (divisions: Division[] = [], hcp: number) => divisions.find(d => hcp >= d.minHandicap && hcp <= d.maxHandicap)

export default function TournamentDetails({ tournamentId, push, pop, showToast, showDialog }: TournamentDetailsProps) {
  useLiveVersion()
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const tournament = getTournament(tournamentId)

  useEffect(() => {
    const id = setTimeout(() => setLoading(false), 700)
    return () => clearTimeout(id)
  }, [])

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-canvas relative">
        <div className="h-72 skeleton flex-shrink-0" />
        <div className="absolute top-3 left-4 z-10">
          <RoundButton onClick={pop} tone="glass" label="Back"><IconBack /></RoundButton>
        </div>
        <div className="flex-1 -mt-8 bg-white rounded-t-[32px] px-5 pt-6 space-y-4 relative">
          <SkeletonRow /><SkeletonRow /><SkeletonRow /><SkeletonRow />
        </div>
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="h-full flex flex-col bg-canvas">
        <div className="px-5 pt-3">
          <RoundButton onClick={pop} label="Back"><IconBack /></RoundButton>
        </div>
        <ErrorState title="Tournament not found" message="This tournament may have been removed or the link is invalid." onRetry={pop} />
      </div>
    )
  }

  const t = tournament
  const course = getCourse(t.courseId)
  const me = myEntry(t.id)
  const field = entriesFor(t.id).filter(e => e.status === 'registered')
  const players = Math.max(t.players, field.length)
  const spotsLeft = t.maxPlayers - players
  const fees = t.fees!
  const reg = t.registration!
  const scoring = t.scoring!
  const sheet = t.teeSheet!
  const now = isoLocalDateTime()
  const windowOpen = !reg.opensAt || (now >= reg.opensAt && now <= reg.closesAt)

  const isCancelled  = t.status === 'cancelled'
  const isCompleted  = t.status === 'completed'
  const isLive       = t.status === 'in-progress'
  const isRegistered = me?.status === 'registered'
  const isWaitlisted = me?.status === 'waitlist'
  const isOpen       = t.registrationStatus === 'open' && !isCancelled && !isCompleted && !isLive
  const isComingSoon = t.registrationStatus === 'coming-soon'
  const isClosed     = (t.registrationStatus === 'closed' || t.status === 'registration-closed') && !isCancelled && !isCompleted && !isLive
  const problem      = eligibilityProblem(t)
  const myDivision   = t.divisions?.find(d => d.id === me?.divisionId) ?? divisionFor(t.divisions, MOCK_PROFILE.handicapIndex)
  const myGroup      = me ? groupOf(t.id, 1, me.id) : undefined
  const earlyBird    = fees.earlyBirdAmount !== undefined && fees.earlyBirdUntil && isoDate(new Date()) <= fees.earlyBirdUntil
  const priceNow     = earlyBird ? fees.earlyBirdAmount! : MOCK_PROFILE.membership === 'Member' && fees.memberAmount !== undefined ? fees.memberAmount : fees.amount

  const badgeStatus =
    isLive ? 'in-progress' : isCancelled ? 'cancelled' : isCompleted ? 'completed' : isRegistered ? 'registered'
    : isOpen ? 'open' : isComingSoon ? 'coming-soon' : 'closed'

  function register() {
    if (MOCK_PROFILE.emailVerified === false) {
      showDialog({
        title: 'Verify your email to register',
        message: `Enter the code we sent to ${MOCK_PROFILE.email} — then you can register for ${t.name}.`,
        confirmLabel: 'Verify now (demo)',
        cancelLabel: 'Later',
        onConfirm: () => { MOCK_PROFILE.emailVerified = true; showToast('Email verified — you can register now') },
      })
      return
    }
    if (!myDivision) { showToast('No division matches your handicap', 'error'); return }
    // No waiting list (client answer T-04); paid entry online from the first release (T-06)
    if (spotsLeft <= 0) { showToast('The field is full — contact the organiser', 'info'); return }
    if (priceNow > 0) { setPaying(true); return }
    showDialog({
      title: 'Confirm your entry',
      message: `${myDivision.name} division · free entry. Free withdrawal until ${formatDateTime(reg.withdrawBy)}.`,
      confirmLabel: 'Register',
      onConfirm: () => { registerMe(t, myDivision.id, false, 'free'); showToast(`You're registered for ${t.name}!`) },
    })
  }

  function withdraw() {
    const late = reg.withdrawBy && now > reg.withdrawBy
    showDialog({
      title: isWaitlisted ? 'Leave the waiting list?' : 'Withdraw?',
      message: late ? `The free withdrawal deadline has passed. ${reg.refundPolicy}` : reg.refundPolicy || 'Your spot will be released.',
      confirmLabel: 'Withdraw',
      cancelLabel: 'Keep my spot',
      destructive: true,
      onConfirm: () => { withdrawMe(t.id); showToast('You have withdrawn', 'info') },
    })
  }

  const primaryAction =
    isLive && isRegistered ? <Button fullWidth onClick={() => push('live-play', { id: t.id })}>Enter my scores</Button>
    : isLive || isCompleted ? <Button fullWidth onClick={() => push('leaderboard', { id: t.id })}>{isLive ? 'Live leaderboard' : 'Results'}</Button>
    : isCancelled ? <Button variant="ghost" disabled fullWidth>Cancelled</Button>
    : isRegistered || isWaitlisted ? <Button variant="danger" fullWidth onClick={withdraw}>{isWaitlisted ? 'Leave waitlist' : 'Withdraw'}</Button>
    : isClosed || !windowOpen ? <Button variant="ghost" disabled fullWidth>{now < reg.opensAt ? `Opens ${formatDay(reg.opensAt)}` : 'Registration closed'}</Button>
    : isComingSoon ? <Button fullWidth onClick={() => showToast("You'll be notified when registration opens")}>Notify me</Button>
    : problem ? <Button variant="ghost" disabled fullWidth>Not eligible</Button>
    : spotsLeft <= 0 ? <Button variant="ghost" disabled fullWidth>Field is full</Button>
    : <Button fullWidth onClick={register}>{priceNow > 0 ? `Register & pay ${formatMoney(priceNow, fees.currency)}` : 'Register'}</Button>

  return (
    <div className="h-full flex flex-col bg-canvas relative">
      <div className="absolute top-3 left-4 z-10">
        <RoundButton onClick={pop} tone="glass" label="Back"><IconBack /></RoundButton>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar smooth-scroll">
        {/* Hero image */}
        <div className="relative h-72 bg-pine-100">
          <img src={t.imageUrl} alt={t.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 scrim-top" />
          <div className="absolute inset-0 scrim-bottom" />
          {t.prizes?.[0] && !isCancelled && (
            <div className="absolute top-3 right-4 rounded-2xl px-3 py-2 max-w-[200px] shadow-md" style={{ background: 'rgba(201,162,39,0.95)' }}>
              <p className="text-[10px] text-ink/60 font-bold font-display uppercase tracking-wider leading-none">{t.prizes[0].label}</p>
              <p className="text-[12px] text-ink font-bold font-display leading-tight mt-1">{t.prizes[0].value}</p>
            </div>
          )}
          <div className="absolute bottom-12 left-5 right-5 flex items-center gap-2 flex-wrap">
            <StatusBadge status={badgeStatus} size="md" onImage={badgeStatus !== 'in-progress'} />
            <GlassChip>{t.format}</GlassChip>
            {(t.rounds?.length ?? 1) > 1 && <GlassChip>{t.rounds!.length} rounds</GlassChip>}
          </div>
        </div>

        {/* Content sheet */}
        <div className="relative -mt-8 bg-white rounded-t-[32px] px-5 pt-6 pb-8">
          <p className="text-[12px] font-bold text-pine-500 font-display">{t.category}</p>
          <h1 className="font-display font-extrabold text-ink text-[26px] leading-[1.15] tracking-tight mt-1">{t.name}</h1>
          <button onClick={() => push('course-details', { id: t.courseId })} className="flex items-center gap-1.5 mt-2.5 text-left active:opacity-60">
            <IconPin />
            <span className="text-[13px] text-gray-500">{t.venue} · {t.location}</span>
            <span className="text-[12px] font-bold font-display text-pine-600 underline underline-offset-4 ml-1 flex-shrink-0">Course</span>
          </button>

          <div className="grid grid-cols-2 gap-2.5 mt-5">
            <InfoTile icon={<IconCalendar />} label="Date" value={t.dateRange} />
            <InfoTile icon={<IconClock />} label={sheet.startType === 'shotgun' ? 'Shotgun' : 'First tee'} value={formatClock(sheet.firstTeeTime)} />
            <InfoTile icon={<IconCourse />} label="Format" value={t.format} />
            <InfoTile icon={<IconUsers />} label="Field" value={`${players} / ${t.maxPlayers}`} />
          </div>

          {/* Your entry */}
          <div className="mt-6 space-y-3">
            {isLive && (
              <div className="rounded-2xl px-4 py-3.5 bg-rose-50 text-rose-700">
                <p className="text-sm font-bold font-display">Live now</p>
                <p className="text-xs opacity-80 mt-0.5">{isRegistered ? "You're in the field — enter your scores hole by hole." : 'Follow the leaderboard as scores come in.'}</p>
              </div>
            )}
            {isRegistered && !isCancelled && !isCompleted && (
              <div className="flex items-center gap-3 bg-lime-300/50 rounded-2xl px-4 py-3.5">
                <IconCheckCircle />
                <div>
                  <p className="text-sm font-bold text-ink font-display">{isLive ? 'You’re playing' : "You're registered!"}</p>
                  <p className="text-xs text-pine-700 mt-0.5">
                    {myDivision?.name} division{myGroup ? ` · tee time ${formatClock(myGroup.time)} off hole ${myGroup.startHole}` : ' · tee times published before the event'}
                  </p>
                </div>
              </div>
            )}
            {isWaitlisted && <Notice tone="amber" title="You're on the waiting list" body="We'll let you know if a spot opens up." />}
            {isOpen && !isRegistered && !isWaitlisted && problem && <Notice tone="amber" title="Not eligible" body={problem} />}
            {isOpen && !isRegistered && !isWaitlisted && !problem && (
              <div className="bg-canvas rounded-2xl p-4"><SpotsBar players={players} maxPlayers={t.maxPlayers} /></div>
            )}
            {isClosed && <Notice tone="rose" title="Registration closed" body="The registration period for this tournament has ended." />}
            {isComingSoon && <Notice tone="amber" title="Registration opening soon" body={reg.opensAt ? `Opens ${formatDateTime(reg.opensAt)}.` : 'Details will be announced shortly.'} />}
            {isCancelled && <Notice tone="rose" title="Tournament cancelled" body="If you were registered, you will receive a full refund within 5–7 business days." />}
            {isCompleted && <Notice tone="gray" title="Tournament completed" body={t.resultsPublished ? 'Final results are published.' : 'Results will be published once cards are verified.'} />}
          </div>

          {myGroup && myGroup.entryIds.length > 1 && (
            <p className="text-[12px] text-gray-500 mt-2 px-1">
              Playing with {myGroup.entryIds.filter(e => e !== me?.id).map(eid => field.find(f => f.id === eid)?.name).filter(Boolean).join(', ')}
            </p>
          )}

          <Section title="About">
            <p className={`text-[14px] leading-relaxed ${isCancelled ? 'text-rose-600' : 'text-gray-500'}`}>{t.description}</p>
          </Section>

          <Section title="Entry & registration">
            <div className="bg-canvas rounded-2xl p-4">
              <p className="font-display font-extrabold text-ink text-[26px] leading-none">
                {formatMoney(priceNow, fees.currency)}<span className="text-[13px] text-gray-500 font-semibold">{fees.perTeam ? ' / team' : ''}</span>
              </p>
              {earlyBird && <p className="text-[12px] text-pine-600 font-semibold mt-1">Early-bird until {formatDay(fees.earlyBirdUntil!)}, then {formatMoney(fees.amount, fees.currency)}</p>}
              {fees.memberAmount !== undefined && fees.memberAmount !== fees.amount && <p className="text-[12px] text-gray-500 mt-1">Members {formatMoney(fees.memberAmount, fees.currency)} · Guests {formatMoney(fees.amount, fees.currency)}</p>}
              {!!fees.includes.length && <p className="text-[12px] text-gray-500 mt-1">Includes {fees.includes.join(', ').toLowerCase()}</p>}
            </div>
            <dl className="divide-y divide-black/[0.05] mt-1">
              <Row label="Registration opens" value={formatDateTime(reg.opensAt)} />
              <Row label="Closes" value={formatDateTime(reg.closesAt)} />
              <Row label="Free withdrawal until" value={formatDateTime(reg.withdrawBy)} />
            </dl>
            {reg.refundPolicy && <p className="text-[12px] text-gray-400 leading-relaxed mt-1">{reg.refundPolicy}</p>}
          </Section>

          <Section title="Schedule">
            <ul className="space-y-2">
              {t.rounds!.map(r => (
                <li key={r.number} className="flex items-center gap-3 bg-canvas rounded-2xl px-3 py-2.5">
                  <span className="w-9 h-9 rounded-full bg-ink text-white text-[12px] font-bold font-display flex items-center justify-center flex-shrink-0">R{r.number}</span>
                  <span className="min-w-0">
                    <span className="block font-display font-bold text-ink text-[14px]">{formatDay(r.date)}</span>
                    <span className="block text-[12px] text-gray-500">
                      {r.holes === 'all' ? `${course?.holes ?? 18} holes` : r.holes === 'front' ? 'Front 9' : 'Back 9'} · {sheet.startType === 'shotgun' ? `Shotgun ${formatClock(sheet.firstTeeTime)}` : `From ${formatClock(sheet.firstTeeTime)}, every ${sheet.intervalMinutes} min`}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Format & scoring">
            <dl className="divide-y divide-black/[0.05]">
              {t.format !== 'Stableford' && <Row label="Results" value={scoring.basis === 'gross-and-net' ? 'Gross and net' : scoring.basis === 'net' ? 'Net' : 'Gross'} />}
              <Row label="Handicap allowance" value={`${scoring.allowancePct}%`} />
              <Row label="Max handicap" value={scoring.maxHandicap} />
              <Row label="Ties" value={TIE_BREAK_OPTIONS.find(o => o.value === scoring.tieBreak)?.label} />
              {scoring.cutAfterRound > 0 && <Row label="Cut" value={`Top ${scoring.cutSize} after R${scoring.cutAfterRound}`} />}
            </dl>
          </Section>

          <Section title="Divisions">
            <div className="space-y-2">
              {t.divisions!.map(d => {
                const tee = course?.teeSets?.find(ts => ts.id === d.teeSetId)
                const mine = myDivision?.id === d.id
                return (
                  <div key={d.id} className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 ${mine ? 'bg-lime-300/50' : 'bg-canvas'}`}>
                    <span className="w-4 h-4 rounded-full ring-1 ring-black/15 flex-shrink-0" style={{ background: teeSwatch(tee?.color ?? '') }} />
                    <span className="min-w-0">
                      <span className="block font-display font-bold text-ink text-[13px]">{d.name}{mine && ' · yours'}</span>
                      <span className="block text-[12px] text-gray-500">HCP {d.minHandicap}–{d.maxHandicap} · {tee ? `${tee.name} tees, ${teeTotal(tee).toLocaleString()} yds` : 'Tees TBC'}</span>
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="text-[12px] text-gray-500 mt-2.5">
              {t.eligibility!.gender === 'open' ? 'Open to all' : t.eligibility!.gender === 'men' ? 'Men only' : 'Women only'}
              {t.eligibility!.membersOnly ? ' · members only' : ''}
              {t.eligibility!.officialHandicapRequired ? ' · official handicap required' : ''}
            </p>
          </Section>

          {!!t.prizes?.length && (
            <Section title="Prizes">
              <dl className="divide-y divide-black/[0.05]">
                {t.prizes.map(p => (
                  <Row key={p.id} label={`${p.label}${p.divisionId ? ` · ${t.divisions?.find(d => d.id === p.divisionId)?.name ?? ''}` : ''}`} value={p.value} />
                ))}
              </dl>
            </Section>
          )}

          {t.localRules && (
            <Section title="Local rules">
              <ul className="text-[13px] text-gray-600 space-y-1.5 list-disc pl-5">
                {t.localRules.split('\n').filter(Boolean).map((rule, i) => <li key={i}>{rule}</li>)}
              </ul>
            </Section>
          )}

          {!isCancelled && (
            <Section title="Who's playing">
              <WhosPlaying t={t} players={players} isRegistered={isRegistered} />
            </Section>
          )}

          {(t.contactEmail || t.contactPhone || !!t.officials?.length) && (
            <Section title="Contacts">
              <dl className="divide-y divide-black/[0.05]">
                {t.contactEmail && <Row label="Email" value={<a className="underline decoration-lime-500 underline-offset-4" href={`mailto:${t.contactEmail}`}>{t.contactEmail}</a>} />}
                {t.contactPhone && <Row label="Phone" value={<a href={`tel:${t.contactPhone}`}>{t.contactPhone}</a>} />}
                {t.officials?.filter(o => o.name.trim()).map(o => <Row key={o.name} label={o.role} value={o.name} />)}
              </dl>
            </Section>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex-shrink-0 bg-white px-5 pt-3 pb-3 border-t border-black/[0.05]">
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={() => push(isLive && isRegistered ? 'leaderboard' : 'course-details', { id: isLive && isRegistered ? t.id : t.courseId })} className="flex-shrink-0">
            {isLive && isRegistered ? 'Leaderboard' : <><IconCourse /><span>Course</span></>}
          </Button>
          {primaryAction}
        </div>
      </div>
      {paying && myDivision && (
        <PaymentSheet title={`Enter ${t.name}`} currency={fees.currency} total={priceNow} onClose={() => setPaying(false)}
          lines={[['Division', myDivision.name], [fees.perTeam ? 'Entry (per team)' : 'Entry', formatMoney(priceNow, fees.currency)]]}
          onPaid={() => { registerMe(t, myDivision.id, false, 'paid'); showToast(`Paid ${formatMoney(priceNow, fees.currency)} — you're registered!`) }} />
      )}
    </div>
  )
}

function Notice({ tone, title, body }: { tone: 'rose' | 'amber' | 'gray'; title: string; body: string }) {
  const tones = {
    rose:  'bg-rose-50 text-rose-700',
    amber: 'bg-amber-50 text-amber-700',
    gray:  'bg-canvas text-gray-700',
  }
  return (
    <div className={`rounded-2xl px-4 py-3.5 ${tones[tone]}`}>
      <p className="text-sm font-bold font-display">{title}</p>
      <p className="text-xs opacity-80 mt-0.5 leading-relaxed">{body}</p>
    </div>
  )
}
