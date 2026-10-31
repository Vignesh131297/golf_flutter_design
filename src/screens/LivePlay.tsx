import { useState } from 'react'
import type { Point, SharedNavProps } from '../types'
import { Button, ErrorState, RoundButton, IconBack } from '../components'
import { getTournament, getCourse } from '../data'
import {
  addShot, cardFor, cardState, entriesFor, leaderboard, myEntry, roundHoles, setCardState, setStrokes, shotsFor, undoShot, useLiveVersion,
} from '../live'
import { dist, generateHoleMap, playingHandicap, scoreLabel, strokesOnHole, toPar, formatClock } from '../golf'
import { HoleMapView, greenDistances, hazardsAhead } from '../hole-map'
import { ScoreCell } from './Leaderboard'
import { ROUND_STATUS_LABEL, groupBehind, roundStatus, suspensionFor, teeSetIdFor } from '../live'
import { currentRound, incidentsFor, logIncident, markedBy, markerCardFor, markerMissing, markerOf, mismatches, roundNumbers, rulingsFor, setMarkerStrokes, useOpsVersion } from '../ops'
import { IncidentSheet, MyRoundStatus, MyRulingsSheet, Sheet } from '../ops-ui'

interface LivePlayProps extends SharedNavProps {
  tournamentId: string
}

const HAZARD_LABEL = { bunker: 'Bunker', water: 'Water', trees: 'Trees' }

/**
 * On-course scoring for the golfer: distances first, the hole map (tap to measure, mark the
 * ball), and a one-thumb score stepper. On a real phone "GPS" uses the device location; the
 * prototype simulates a ball position along the hole.
 */
export default function LivePlay({ tournamentId, pop, push, showToast, showDialog }: LivePlayProps) {
  useLiveVersion()
  useOpsVersion()
  const t = getTournament(tournamentId)
  const course = t ? getCourse(t.courseId) : undefined
  const me = t ? myEntry(t.id) : undefined
  const round = t ? currentRound(t) : 1
  const holes = t && course ? roundHoles(t, course, round) : []
  const card = t && me ? cardFor(t, me.id, round) : []
  const firstOpen = card.findIndex(s => s === null)
  const [index, setIndex] = useState(firstOpen < 0 ? 0 : firstOpen)
  const [target, setTarget] = useState<Point | undefined>()
  const [draft, setDraft] = useState<number | null>(null)
  const [showCard, setShowCard] = useState(false)
  const [showRulings, setShowRulings] = useState(false)
  const [settling, setSettling] = useState(false)
  const [asking, setAsking] = useState(false)
  // The official signed off the last round while this screen was open: carry on from the new round's first open hole
  const [seenRound, setSeenRound] = useState(round)
  if (round !== seenRound) { setSeenRound(round); setIndex(firstOpen < 0 ? 0 : firstOpen) }

  if (!t || !course || !me || me.status !== 'registered' || t.status !== 'in-progress') {
    return (
      <div className="h-full flex flex-col bg-canvas">
        <div className="px-5 pt-3"><RoundButton onClick={pop} label="Back"><IconBack /></RoundButton></div>
        <ErrorState
          title={t?.status !== 'in-progress' ? 'Scoring isn’t open' : 'You’re not in this field'}
          message={t?.status !== 'in-progress' ? 'Live scoring opens when the tournament starts.' : 'Only registered players can enter scores.'}
          onRetry={pop}
        />
      </div>
    )
  }

  // A handed-in card, or an official's WD / NS / DNF / DQ, ends scoring for the round
  const status = roundStatus(t.id, me.id, round)
  const locked = cardState(t.id, me.id, round) !== 'in-progress' || status !== 'playing'
  const rulings = rulingsFor(t.id, me.id)
  const hole = holes[index]
  const map = hole.map ?? generateHoleMap(hole)
  const division = t.divisions?.find(d => d.id === me.divisionId)
  const tee = course.teeSets?.find(ts => ts.id === teeSetIdFor(t, me))
  void division
  const coursePar = course.holeData.reduce((s, h) => s + h.par, 0)
  const playing = playingHandicap(me.handicapIndex, tee, coursePar, t.scoring?.allowancePct ?? 100, me.gender)
  const received = strokesOnHole(playing, hole.handicap, holes.length)
  const holeYards = tee?.yards[hole.hole - 1] ?? hole.yards
  const shots = shotsFor(t.id, me.id, round, hole.hole)
  const ball = shots.length ? shots[shots.length - 1].at : map.tee
  const toGreen = greenDistances(map, ball)
  const ahead = hazardsAhead(map, ball)[0]
  const saved = card[index]
  const strokes = draft ?? saved ?? hole.par
  const row = leaderboard(t, round).find(r => r.entry.id === me.id)
  const blanks = card.filter(s => s === null).length
  // Each player marks the next one in the group; the two cards must agree before the card goes in
  const marker = markerOf(t.id, round, me.id)
  const markees = markedBy(t.id, round, me.id).filter(p => roundStatus(t.id, p.id, round) === 'playing')
  const noMarker = markerMissing(t, round, me.id)
  const myMarked = markerCardFor(t, me.id, round)
  const disputed = new Set(incidentsFor(t.id).filter(i => i.kind === 'score-dispute' && i.status !== 'resolved' && i.entryIds.includes(me.id)).map(i => i.hole))
  const unsettled = mismatches(t, me.id, round).filter(i => !disputed.has(holes[i].hole))
  const behind = groupBehind(t.id, round, me.id)

  function goTo(i: number) {
    setIndex(Math.max(0, Math.min(holes.length - 1, i)))
    setTarget(undefined)
    setDraft(null)
  }

  function saveScore() {
    setStrokes(t!, me!.id, round, index, strokes)
    showToast(`Hole ${hole.hole}: ${strokes} — ${scoreLabel(strokes, hole.par)}`)
    setDraft(null)
    if (index < holes.length - 1) goTo(index + 1)
    else setShowCard(true)
  }

  function markBall(at: Point) {
    addShot(t!.id, me!.id, round, hole.hole, { at, ts: Date.now() })
    setTarget(undefined)
  }

  /** Prototype GPS: a believable spot further along the hole than the last ball. */
  function locateBall() {
    const next = map.path[Math.min(map.path.length - 1, shots.length + 1)] ?? map.greenCentre
    const remaining = dist(ball, map.greenCentre)
    const step = Math.min(remaining, 60 + Math.random() * 180)
    const k = Math.min(1, step / Math.max(1, dist(ball, next)))
    const at = remaining < 25
      ? { x: map.greenCentre.x + Math.round((Math.random() - 0.5) * 10), y: map.greenCentre.y + Math.round((Math.random() - 0.5) * 10) }
      : { x: Math.round(ball.x + (next.x - ball.x) * k + (Math.random() - 0.5) * 16), y: Math.round(ball.y + (next.y - ball.y) * k) }
    markBall(at)
    showToast('Ball marked from GPS (simulated)', 'info')
  }

  /** Players don't report the group ahead, but they notice the group behind falling back (client, 21 Oct) */
  function reportGroupBehind() {
    if (!behind) return
    const names = entriesFor(t!.id).filter(e => behind.entryIds.includes(e.id)).map(e => e.name)
    showDialog({
      title: 'Report the group behind?',
      message: `The marshal gets a quiet note that the ${formatClock(behind.time)} group (${names.join(', ')}) is falling behind while you're on hole ${hole.hole}. Only the marshal and the committee see it.`,
      confirmLabel: 'Tell the marshal',
      onConfirm: () => {
        logIncident({
          tournamentId: t!.id, round, kind: 'slow-play', hole: hole.hole, entryIds: behind.entryIds,
          note: `Player report: we're on hole ${hole.hole} and the group behind (${formatClock(behind.time)} tee time) is well back — ${names.join(', ')}.`,
          raisedBy: { name: me!.name, role: 'golfer' },
        })
        showToast('Sent to the marshal — thanks')
      },
    })
  }

  function submitCard() {
    // Golfers submit what they've entered and are responsible for it (client answer T-09)
    showDialog({
      title: blanks ? `Submit with ${blanks} blank hole${blanks > 1 ? 's' : ''}?` : 'Submit your scorecard?',
      message: `${blanks ? 'Holes without a score stay blank. ' : ''}Gross ${row?.gross ?? '—'} (${toPar(row?.grossToPar ?? 0)}), net ${row?.net ?? '—'}. The committee verifies it next; you can't change it after submitting.`,
      confirmLabel: 'Submit card',
      onConfirm: () => { setCardState(t!.id, me!.id, round, 'submitted'); setShowCard(false); showToast('Scorecard submitted') },
    })
  }

  return (
    <div className="h-full flex flex-col bg-canvas relative">
      {/* Hole header */}
      <div className="flex-shrink-0 px-4 pt-2 pb-2 flex items-center gap-2">
        <RoundButton onClick={pop} label="Back"><IconBack /></RoundButton>
        <button onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous hole"
          className="w-9 h-9 rounded-full bg-white shadow-card text-ink font-bold disabled:opacity-30">‹</button>
        <div className="flex-1 text-center min-w-0">
          <p className="font-display font-extrabold text-ink text-[18px] leading-tight">Hole {hole.hole}{hole.name ? ` · ${hole.name}` : ''}</p>
          <p className="text-[12px] text-gray-500">{roundNumbers(t).length > 1 ? `R${round} · ` : ''}Par {hole.par} · {holeYards} yds · SI {hole.handicap}{received ? ` · +${received}` : ''}</p>
        </div>
        <button onClick={() => goTo(index + 1)} disabled={index === holes.length - 1} aria-label="Next hole"
          className="w-9 h-9 rounded-full bg-white shadow-card text-ink font-bold disabled:opacity-30">›</button>
        <button onClick={() => push('leaderboard', { id: t.id })} aria-label="Leaderboard"
          className="h-9 px-3 rounded-full bg-ink text-lime-400 text-[12px] font-bold font-display">{row?.position ?? '–'}</button>
      </div>

      <MyRoundStatus t={t} entryId={me.id} round={round} />

      {noMarker && (
        <div role="status" className="flex-shrink-0 mx-4 mb-2 rounded-2xl bg-amber-50 text-amber-900 px-4 py-2.5">
          <p className="font-display font-bold text-[13px] leading-snug">{marker?.name} can’t mark your card any more</p>
          <p className="text-[11px] mt-0.5 leading-snug">Keep playing and scoring. The official gives your card to someone else in your group.</p>
        </div>
      )}

      {/* An official stopped play: shown until they resume it */}
      {suspensionFor(t.id) && (
        <div role="alert" className="flex-shrink-0 mx-4 mb-2 rounded-2xl bg-rose-600 text-white px-4 py-3">
          <p className="font-display font-bold text-[15px] leading-snug">Play suspended — {suspensionFor(t.id)!.reason.toLowerCase()}. Mark your ball and stop.</p>
          <p className="text-[12px] text-white/85 mt-0.5 leading-snug">
            {suspensionFor(t.id)!.note ? `${suspensionFor(t.id)!.by}: “${suspensionFor(t.id)!.note}”` : 'Wait for the official to resume play. Your scores so far are saved.'}
          </p>
        </div>
      )}

      {/* Distances */}
      <div className="flex-shrink-0 mx-4 bg-ink rounded-3xl p-3 grid grid-cols-3 gap-2 text-center">
        {[['Front', toGreen.front], ['Centre', toGreen.centre], ['Back', toGreen.back]].map(([label, yards], i) => (
          <div key={label} className={`rounded-2xl py-2 ${i === 1 ? 'bg-lime-400 text-ink' : 'text-white'}`}>
            <p className="font-display font-extrabold text-[26px] leading-none">{yards}</p>
            <p className={`text-[10px] font-semibold mt-1 ${i === 1 ? 'text-pine-800' : 'text-white/55'}`}>{label}</p>
          </div>
        ))}
      </div>
      {ahead && (
        <p className="flex-shrink-0 text-center text-[11px] text-gray-500 mt-1.5">
          {HAZARD_LABEL[ahead.hazard.type]}: <span className="font-semibold text-ink">{ahead.reach}</span> to reach · <span className="font-semibold text-ink">{ahead.carry}</span> to carry
        </p>
      )}

      {unsettled.length > 0 && (
        <button onClick={() => setSettling(true)} className="flex-shrink-0 mx-4 mt-2 rounded-2xl bg-rose-50 px-4 py-2.5 text-left flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
          <span className="flex-1 text-[12px] text-rose-800"><span className="font-bold">Score discrepancy on hole {unsettled.map(i => holes[i].hole).join(', ')}</span> — check with {marker?.name.split(' ')[0] ?? 'your marker'}</span>
          <span className="text-[12px] font-bold text-rose-700">Settle ›</span>
        </button>
      )}

      {/* Map */}
      <div className="flex-1 min-h-0 relative mx-4 mt-2">
        <div className="absolute inset-0">
          <HoleMapView
            map={map}
            size="fill"
            shots={shots.map((s, i) => ({ at: s.at, label: String(i + 1) }))}
            ball={ball}
            target={target}
            onPick={locked ? undefined : setTarget}
            ariaLabel={`Hole ${hole.hole} map — tap to measure`}
          />
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex justify-between gap-2">
          {target ? (
            <>
              <button onClick={() => setTarget(undefined)} className="h-10 px-4 rounded-full bg-white/90 text-ink text-[12px] font-bold font-display shadow-card">Clear</button>
              <button onClick={() => markBall(target)} className="h-10 px-4 rounded-full bg-lime-400 text-ink text-[12px] font-bold font-display shadow-card">Mark ball · {dist(ball, target)} yds</button>
            </>
          ) : (
            <>
              <button onClick={() => undoShot(t.id, me.id, round, hole.hole)} disabled={locked || !shots.length}
                className="h-10 px-4 rounded-full bg-white/90 text-ink text-[12px] font-bold font-display shadow-card disabled:opacity-40">Undo shot</button>
              <button onClick={locateBall} disabled={locked}
                className="h-10 px-4 rounded-full bg-ink text-white text-[12px] font-bold font-display shadow-card disabled:opacity-40">◎ GPS my ball</button>
            </>
          )}
        </div>
      </div>

      {/* Score */}
      <div className="flex-shrink-0 bg-white rounded-t-[28px] shadow-float mt-3 px-5 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <button disabled={locked || strokes <= 1} onClick={() => setDraft(strokes - 1)} aria-label="One fewer stroke"
            className="w-12 h-12 rounded-full bg-canvas text-ink text-[24px] font-bold disabled:opacity-40">−</button>
          <div className="flex-1 text-center">
            <p className="font-display font-extrabold text-ink text-[40px] leading-none">{strokes}</p>
            <p className="text-[11px] font-semibold text-gray-500 mt-0.5">{scoreLabel(strokes, hole.par)} · net {strokes - received}</p>
          </div>
          <button disabled={locked || strokes >= 15} onClick={() => setDraft(strokes + 1)} aria-label="One more stroke"
            className="w-12 h-12 rounded-full bg-canvas text-ink text-[24px] font-bold disabled:opacity-40">+</button>
        </div>
        {shots.length > 0 && !locked && strokes !== shots.length + 1 && (
          <button onClick={() => setDraft(shots.length + 1)} className="block mx-auto mt-1 text-[11px] font-semibold text-pine-600 underline underline-offset-4">
            Use marked shots ({shots.length} + 1 putt)
          </button>
        )}
        {markees.map(p => {
          const mine = markerCardFor(t, p.id, round)[index]
          const theirs = cardFor(t, p.id, round)[index]
          const value = mine ?? hole.par
          return (
            <div key={p.id} className="flex items-center gap-2 mt-3 rounded-2xl bg-canvas px-3 py-2">
              <span className="flex-1 min-w-0">
                <span className="block text-[12px] font-bold text-ink truncate">Marking {p.name.split(' ')[0]}</span>
                <span className={`block text-[11px] ${mine !== null && theirs !== null && mine !== theirs ? 'text-rose-600 font-semibold' : 'text-gray-500'}`}>
                  {mine === null ? 'Enter their score' : theirs === null ? 'Waiting for theirs' : mine === theirs ? 'Matches ✓' : `They have ${theirs}`}
                </span>
              </span>
              <button disabled={locked || value <= 1} onClick={() => setMarkerStrokes(t, p.id, round, index, value - 1)} aria-label={`One fewer for ${p.name}`}
                className="w-9 h-9 rounded-full bg-white text-ink text-[18px] font-bold disabled:opacity-40">−</button>
              <span className={`w-6 text-center font-display font-extrabold text-[20px] ${mine === null ? 'text-gray-300' : 'text-ink'}`}>{value}</span>
              <button disabled={locked || value >= 15} onClick={() => setMarkerStrokes(t, p.id, round, index, mine === null ? value : value + 1)} aria-label={`${mine === null ? 'Confirm' : 'One more for'} ${p.name}`}
                className="w-9 h-9 rounded-full bg-white text-ink text-[16px] font-bold disabled:opacity-40">{mine === null ? '✓' : '+'}</button>
            </div>
          )
        })}
        <div className="flex gap-2 mt-3">
          <Button variant="secondary" onClick={() => setShowCard(true)} className="flex-shrink-0">Card</Button>
          <Button fullWidth onClick={saveScore} disabled={locked}>
            {status !== 'playing' ? ROUND_STATUS_LABEL[status] : locked ? 'Card submitted' : index === holes.length - 1 ? 'Save last hole' : 'Save & next hole'}
          </Button>
        </div>
        <div className="flex justify-center gap-4 mt-2">
          {rulings.length > 0 && (
            <button onClick={() => setShowRulings(true)} className="text-[12px] font-semibold text-pine-600 underline underline-offset-4">
              Your rulings ({rulings.filter(r => r.incident.status === 'resolved').length}/{rulings.length} decided)
            </button>
          )}
          <button onClick={() => setAsking(true)} className="text-[12px] font-semibold text-pine-600 underline underline-offset-4">Ask for a ruling</button>
          {behind && <button onClick={reportGroupBehind} className="text-[12px] font-semibold text-pine-600 underline underline-offset-4">Group behind slow?</button>}
        </div>
      </div>

      {/* Scorecard sheet */}
      {showCard && (
        <>
          <div className="absolute inset-0 bg-black/40 z-30 fade-in" onClick={() => setShowCard(false)} />
          <div className="absolute left-0 right-0 bottom-0 z-40 bg-white rounded-t-[32px] p-5 fade-in-up">
            <div className="w-10 h-1 bg-black/15 rounded-full mx-auto mb-4" />
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[12px] text-gray-500 font-semibold">My scorecard · round {round}</p>
                <p className="font-display font-extrabold text-ink text-[22px]">
                  {row?.gross ?? 0} <span className="text-[14px] text-gray-500">({toPar(row?.grossToPar ?? 0)}) · net {toPar(row?.netToPar ?? 0)}</span>
                </p>
              </div>
              <p className="text-[12px] font-semibold text-gray-500">Thru {row?.thru ?? 0}</p>
            </div>
            {[holes.slice(0, 9), holes.slice(9)].filter(n => n.length).map((nine, k) => (
              <div key={k} className="mt-3 grid grid-cols-9 gap-1">
                {nine.map((h, j) => {
                  const i = k * 9 + j
                  return (
                    <button key={h.hole} onClick={() => { goTo(i); setShowCard(false) }} className={`flex flex-col items-center rounded-xl py-1 ${i === index ? 'bg-canvas' : ''}`}>
                      <span className="text-[9px] font-bold text-gray-400">{h.hole}</span>
                      <span className={unsettled.includes(i) ? 'rounded-lg ring-2 ring-rose-400' : ''}><ScoreCell strokes={card[i]} par={h.par} /></span>
                      <span className={`text-[9px] font-semibold ${unsettled.includes(i) ? 'text-rose-600' : 'text-gray-300'}`}>{myMarked[i] ?? '·'}</span>
                    </button>
                  )
                })}
              </div>
            ))}
            <div className="mt-4">
              {locked
                ? <p className="text-center text-[13px] font-semibold text-pine-600">{cardState(t.id, me.id, round) === 'verified' ? 'Verified by the committee' : 'Submitted — awaiting verification'}</p>
                : <Button fullWidth onClick={submitCard} disabled={unsettled.length > 0}>{unsettled.length ? 'Settle red holes first' : blanks ? `Submit card (${blanks} blank)` : 'Submit card'}</Button>}
              <button onClick={() => { setShowCard(false); setAsking(true) }} className="block mx-auto mt-3 text-[12px] font-semibold text-pine-600 underline underline-offset-4">Need a ruling? Ask a marshal or the committee</button>
            </div>
          </div>
        </>
      )}

      {settling && (
        <Sheet title="Settle with your marker" subtitle={`${marker?.name ?? 'Your marker'} wrote down a different score. Agree now, or let the committee decide.`} onClose={() => setSettling(false)}>
          {unsettled.length === 0 && <p className="text-[14px] text-gray-500">All settled.</p>}
          {unsettled.map(i => (
            <div key={i} className="rounded-2xl ring-1 ring-black/[0.06] p-3.5">
              <p className="text-[14px] text-ink"><span className="font-bold">Hole {holes[i].hole}:</span> you {card[i]} · {marker?.name.split(' ')[0] ?? 'marker'} {myMarked[i]}</p>
              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <Button size="sm" onClick={() => { setStrokes(t, me.id, round, i, myMarked[i]); showToast(`Hole ${holes[i].hole}: ${myMarked[i]}`) }}>Use {myMarked[i]}</Button>
                <Button size="sm" variant="secondary" onClick={() => { setMarkerStrokes(t, me.id, round, i, card[i]); showToast('Marker updated their card') }}>Marker: {card[i]}</Button>
              </div>
              <button onClick={() => {
                logIncident({ tournamentId: t.id, round, kind: 'score-dispute', hole: holes[i].hole, entryIds: [me.id], status: 'committee', raisedBy: { name: me.name, role: 'golfer' },
                  note: `${me.name} has ${card[i]} on hole ${holes[i].hole}; marker ${marker?.name ?? ''} recorded ${myMarked[i]}. We couldn’t agree.` })
                showToast('Sent to the committee — keep playing')
              }} className="mt-2.5 w-full h-9 rounded-full bg-canvas text-[12px] font-bold font-display text-ink">Can’t agree — send to committee</button>
            </div>
          ))}
        </Sheet>
      )}
      {asking && (
        <IncidentSheet t={t} round={round} actor={{ name: me.name, role: 'golfer' }} onClose={() => setAsking(false)} showToast={showToast}
          preset={{ kind: 'rules', hole: hole.hole, entryIds: [me.id] }} />
      )}
      {showRulings && <MyRulingsSheet t={t} entryId={me.id} onClose={() => setShowRulings(false)} />}
    </div>
  )
}
