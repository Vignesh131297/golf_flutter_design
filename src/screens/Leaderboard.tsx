import { useEffect, useState } from 'react'
import type { SharedNavProps } from '../types'
import { Button, ErrorState, RoundButton, StatusBadge, IconBack } from '../components'
import { getTournament, getCourse } from '../data'
import { cardFor, myEntry, roundHoles, simulateTick, teamSizeOf, useLiveVersion } from '../live'
import { toPar } from '../golf'
import { RANK_LABEL, basesFor, currentRound, overallStandings, ranking, roundNumbers, useOpsVersion, type RankBasis } from '../ops'
import { ScoreSheetSheet, TieNote, WinnersCard, formatText } from '../ops-ui'

interface LeaderboardProps extends SharedNavProps {
  tournamentId: string
}

/** Score cell colour like a TV graphic: birdie or better circled lime, bogey or worse boxed. */
export function ScoreCell({ strokes, par }: { strokes: number | null; par: number }) {
  if (strokes === null) return <span className="text-gray-300">·</span>
  const d = strokes - par
  const shape = d <= -2 ? 'rounded-full bg-amber-300 ring-2 ring-amber-400' : d === -1 ? 'rounded-full bg-lime-400' : d === 1 ? 'rounded-md ring-1 ring-black/25' : d >= 2 ? 'rounded-md bg-ink text-white' : ''
  return <span className={`inline-flex w-6 h-6 items-center justify-center text-[12px] font-bold ${shape}`}>{strokes}</span>
}

const toParClass = (n: number) => (n < 0 ? 'text-rose-600' : 'text-ink')
const chip = (on: boolean, lime = false) =>
  `h-8 px-3.5 rounded-full text-[12px] font-bold font-display flex-shrink-0 whitespace-nowrap ${on ? (lime ? 'bg-lime-400 text-ink' : 'bg-ink text-white') : 'bg-white text-gray-600 shadow-card'}`

export default function Leaderboard({ tournamentId, pop, push }: LeaderboardProps) {
  useLiveVersion()
  useOpsVersion()
  const t = getTournament(tournamentId)
  const [view, setView] = useState<number | 'overall'>(() => (t ? currentRound(t) : 1))
  const [basisPick, setBasis] = useState<RankBasis | null>(null)
  const [division, setDivision] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [sheet, setSheet] = useState(false)
  const [updated, setUpdated] = useState(() => new Date())
  const round = view === 'overall' ? 1 : view

  // Live: poll for new scores (a real app gets them pushed)
  useEffect(() => {
    if (t?.status !== 'in-progress') return
    const timer = setInterval(() => { simulateTick(t, currentRound(t)); setUpdated(new Date()) }, 8000)
    return () => clearInterval(timer)
  }, [t])

  if (!t) {
    return (
      <div className="h-full flex flex-col bg-canvas">
        <div className="px-5 pt-3"><RoundButton onClick={pop} label="Back"><IconBack /></RoundButton></div>
        <ErrorState title="Leaderboard unavailable" message="This tournament could not be found." onRetry={pop} />
      </div>
    )
  }

  const bases = basesFor(t)
  const basis = basisPick ?? bases[0]
  const rounds = roundNumbers(t)
  const course = getCourse(t.courseId)
  const holes = course ? roundHoles(t, course, round) : []
  const list = view === 'overall' ? [] : ranking(t, view, { basis, divisionId: division || undefined })
  const overall = view === 'overall' ? overallStandings(t, rounds[rounds.length - 1], { basis, divisionId: division || undefined }) : []
  const live = t.status === 'in-progress'
  const published = t.status === 'completed' && !!t.resultsPublished
  const me = myEntry(t.id)
  const started = view === 'overall' ? overall.some(r => r.byRound.some(v => v !== null)) : list.some(s => s.row.thru > 0)
  const team = teamSizeOf(t) > 1
  const myPlayed = !!me && rounds.some(n => cardFor(t, me.id, n).some(s => s !== null))
  const points = basis === 'points'
  const overallCols = { gridTemplateColumns: `36px minmax(0,1fr) repeat(${rounds.length}, 28px) 34px 34px` }
  const showFooter = myPlayed || (live && me?.status === 'registered')

  return (
    <div className="h-full flex flex-col bg-canvas">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-3 pb-3">
        <div className="flex items-center gap-3">
          <RoundButton onClick={pop} label="Back"><IconBack /></RoundButton>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] text-gray-500 font-semibold truncate">{t.name}</p>
            <h1 className="font-display font-extrabold text-ink text-[22px] leading-tight tracking-tight">{live ? 'Live leaderboard' : t.status === 'completed' ? 'Results' : 'Leaderboard'}</h1>
          </div>
          {live && <StatusBadge status="in-progress" />}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-4 -mx-5 px-5">
          {rounds.map(n => <button key={n} onClick={() => setView(n)} aria-pressed={view === n} className={chip(view === n)}>R{n}</button>)}
          {rounds.length > 1 && <button onClick={() => setView('overall')} aria-pressed={view === 'overall'} className={chip(view === 'overall')}>Overall</button>}
          {bases.length > 1 && <span className="w-px h-5 self-center bg-black/10 mx-0.5 flex-shrink-0" />}
          {bases.length > 1 && bases.map(b => <button key={b} onClick={() => setBasis(b)} aria-pressed={basis === b} className={chip(basis === b)}>{RANK_LABEL[b]}</button>)}
        </div>
        {(t.divisions?.length ?? 0) > 1 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar mt-1.5 -mx-5 px-5">
            {[{ id: '', name: 'All' }, ...(t.divisions ?? [])].map(d => (
              <button key={d.id} onClick={() => setDivision(d.id)} aria-pressed={division === d.id} className={chip(division === d.id, true)}>{d.name.replace(/\s*\(.*\)/, '')}</button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar smooth-scroll px-5 pb-5">
        {published && <WinnersCard t={t} />}
        {t.status === 'completed' && !published && (
          <p className="mb-3 rounded-2xl bg-amber-50 text-amber-800 text-[13px] px-4 py-2.5 leading-snug">Provisional — the committee is checking the cards. Final results and winners appear once the organiser publishes them.</p>
        )}
        {!started ? (
          <div className="bg-white rounded-3xl shadow-card p-6 text-center">
            <p className="font-display font-bold text-ink">No scores yet</p>
            <p className="text-[13px] text-gray-500 mt-1">{view === 'overall' ? 'Scores appear here once play begins.' : `Round ${view} hasn't started.`}</p>
          </div>
        ) : view === 'overall' ? (
          <div className="bg-white rounded-3xl shadow-card overflow-hidden">
            <div className="grid gap-1 px-4 py-2.5 text-[11px] font-bold font-display text-gray-400 border-b border-black/[0.05]" style={overallCols}>
              <span>Pos</span><span>{team ? 'Team' : 'Player'}</span>
              {rounds.map(n => <span key={n} className="text-right">R{n}</span>)}
              <span className="text-right">Tot</span><span className="text-right">{points ? '' : 'Par'}</span>
            </div>
            {overall.map(r => {
              const played = r.byRound.some(v => v !== null)
              return (
                <div key={r.id} className={`grid gap-1 px-4 py-3 items-start border-b border-black/[0.04] last:border-b-0 text-[13px] ${r.isMe ? 'bg-lime-300/40' : ''}`} style={overallCols}>
                  <span className="font-display font-extrabold text-ink text-[14px]">{r.position}</span>
                  <span className="min-w-0">
                    <span className="block font-display font-bold text-ink text-[14px] truncate">{r.name}{r.isMe && ' (you)'}</span>
                    <TieNote note={r.tieNote} />
                  </span>
                  {r.byRound.map((v, k) => <span key={k} className="text-right text-gray-600">{v ?? '–'}</span>)}
                  <span className="text-right font-display font-extrabold text-ink">{played ? r.total : '–'}</span>
                  <span className={`text-right font-display font-bold ${toParClass(r.toPar)}`}>{!points && played ? toPar(r.toPar) : ''}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-3xl shadow-card overflow-hidden">
            <div className="grid grid-cols-[40px_1fr_52px_44px] gap-2 px-4 py-2.5 text-[11px] font-bold font-display text-gray-400 border-b border-black/[0.05]">
              <span>Pos</span><span>{team ? 'Team' : 'Player'}</span><span className="text-right">{points ? 'Pts' : RANK_LABEL[basis]}</span><span className="text-right">Thru</span>
            </div>
            {list.map(({ row, position, tieNote }) => {
              const main = points ? row.points : basis === 'net' ? row.netToPar : row.grossToPar
              const other = basis === 'gross' ? row.netToPar : row.grossToPar
              const isTeam = row.members.length > 1
              const isOpen = open === row.id
              const finished = row.thru === row.holes
              const out = row.status !== 'playing'
              return (
                <div key={row.id} className={`border-b border-black/[0.04] last:border-b-0 ${row.isMe ? 'bg-lime-300/40' : ''}`}>
                  <button onClick={() => setOpen(isOpen ? null : row.id)} className="w-full grid grid-cols-[40px_1fr_52px_44px] gap-2 items-center px-4 py-3 text-left active:bg-canvas">
                    <span className="font-display font-extrabold text-ink text-[14px]">{position}</span>
                    <span className="min-w-0">
                      <span className="block font-display font-bold text-ink text-[14px] truncate">{row.name}{row.isMe && ' (you)'}</span>
                      <span className="block text-[11px] text-gray-500 leading-snug">
                        {isTeam ? `${row.members.map(m => m.name).join(' · ')} · ${t.format === 'Scramble' ? `team handicap ${row.playing}` : `HCP ${row.handicaps.join(' / ')}`}`
                          : `HCP ${row.entry.handicapIndex.toFixed(1)}`}
                        {!out && !points && bases.length > 1 && row.thru > 0 ? ` · ${basis === 'gross' ? 'net' : 'gross'} ${toPar(other)}` : ''}
                      </span>
                      {finished && <TieNote note={tieNote} />}
                    </span>
                    <span className={`text-right font-display font-extrabold text-[16px] ${points ? 'text-ink' : toParClass(main)}`}>{out || !row.thru ? '–' : points ? main : toPar(main)}</span>
                    <span className="text-right text-[13px] font-semibold text-gray-500">{finished ? 'F' : row.thru}</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-3">
                      <div className="overflow-x-auto no-scrollbar">
                        <table className="text-center">
                          <tbody>
                            <tr>
                              <td className="sticky left-0 bg-white pr-2 text-left text-[9px] font-bold text-gray-400">Hole</td>
                              {holes.map(h => <td key={h.hole} className="w-7 text-[9px] font-bold text-gray-400">{h.hole}</td>)}
                            </tr>
                            {row.members.map(m => {
                              const card = cardFor(t, m.id, round)
                              return (
                                <tr key={m.id}>
                                  <td className="sticky left-0 bg-white pr-2 text-left text-[11px] font-semibold text-ink whitespace-nowrap">{isTeam ? m.name.split(' ')[0] : 'Score'}</td>
                                  {holes.map((h, i) => <td key={h.hole} className="py-0.5"><ScoreCell strokes={card[i]} par={h.par} /></td>)}
                                </tr>
                              )
                            })}
                            {isTeam && (
                              <tr>
                                <td className="sticky left-0 bg-white pr-2 text-left text-[11px] font-bold text-pine-700 whitespace-nowrap">{t.format === 'Four-Ball' ? 'Better ball' : 'Team'}{basis === 'net' ? ' (net)' : ''}</td>
                                {holes.map((h, i) => <td key={h.hole} className="py-0.5"><ScoreCell strokes={(basis === 'net' ? row.perHole.net : row.perHole.gross)[i]} par={h.par} /></td>)}
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1.5">
                        {out ? 'Out of the results' : row.state === 'verified' ? 'Card verified' : row.state === 'submitted' ? 'Card handed in — awaiting verification' : 'Card in progress'}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <p className="text-[11px] text-gray-400 mt-3 px-1 leading-relaxed">
          {live ? `Updated ${updated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · refreshes automatically` : published ? 'Final results' : 'Provisional'}
          {' · '}{formatText(t)} · ties by countback (back 9, last 6, last 3, last hole){view === 'overall' ? '' : ` · tap a ${team ? 'team' : 'player'} for the card`}
        </p>
      </div>

      {showFooter && (
        <div className="flex-shrink-0 bg-white px-5 pt-3 pb-3 border-t border-black/[0.05] flex gap-2">
          {myPlayed && <Button variant="secondary" fullWidth onClick={() => setSheet(true)}>My score sheet</Button>}
          {live && me?.status === 'registered' && <Button fullWidth onClick={() => push('live-play', { id: t.id })}>Enter my scores</Button>}
        </div>
      )}
      {sheet && me && <ScoreSheetSheet t={t} entryId={me.id} onClose={() => setSheet(false)} />}
    </div>
  )
}
