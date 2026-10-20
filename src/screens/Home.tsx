import { handicapText, headlineStat } from '../account-rules'
import { useState, useEffect } from 'react'
import type { SharedNavProps } from '../types'
import {
  SectionHeader, TournamentCard, SkeletonCard,
  Avatar, StatusBadge, GlassChip, IconArrowRight,
} from '../components'
import { MOCK_PROFILE, MOCK_TOURNAMENTS } from '../data'
import { leaderboard, myEntry, useLiveVersion } from '../live'
import { toPar } from '../golf'

const DISCOVER   = MOCK_TOURNAMENTS.filter(t => t.registrationStatus === 'open').slice(0, 2)

function daysUntil(date: string) {
  const ms = new Date(`${date}T00:00:00`).getTime() - new Date().setHours(0, 0, 0, 0)
  return Math.round(ms / 86_400_000)
}

export default function Home({ push, showToast }: SharedNavProps) {
  useLiveVersion()
  const [loading, setLoading] = useState(true)
  const profile = MOCK_PROFILE

  // Tournaments the golfer is in, from the live store (registering/withdrawing updates these)
  const mine = MOCK_TOURNAMENTS.filter(t => myEntry(t.id)?.status === 'registered')
  const playing = mine.find(t => t.status === 'in-progress')
  const REGISTERED = mine
    .filter(t => t.status !== 'in-progress' && t.status !== 'completed' && t.status !== 'cancelled')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
  const myRow = playing ? leaderboard(playing).find(r => r.entry.isMe) : undefined

  useEffect(() => {
    const id = setTimeout(() => setLoading(false), 900)
    return () => clearTimeout(id)
  }, [])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  if (loading) {
    return (
      <div className="h-full overflow-y-auto no-scrollbar px-5 pt-3 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full skeleton flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 skeleton rounded-full w-1/3" />
            <div className="h-5 skeleton rounded-full w-2/3" />
          </div>
        </div>
        <div className="h-28 skeleton rounded-[28px]" />
        <div className="h-4 skeleton rounded-full w-1/3" />
        <SkeletonCard />
      </div>
    )
  }

  const days = REGISTERED ? daysUntil(REGISTERED.startDate) : 0

  return (
    <div className="h-full overflow-y-auto no-scrollbar smooth-scroll">
      <div className="px-5 pt-3 pb-8 space-y-7">

        {/* Greeting */}
        <div className="flex items-center gap-3">
          <Avatar initials={profile.avatarInitials} photo={profile.photoUrl} size="md" />
          <div className="min-w-0">
            <p className="text-[13px] text-gray-500 font-medium">{greeting} 👋</p>
            <h2 className="font-display font-extrabold text-ink text-[20px] leading-tight tracking-tight truncate">
              {profile.firstName} {profile.lastName}
            </h2>
          </div>
          <button
            onClick={() => showToast('Notifications coming soon', 'info')}
            aria-label="Notifications"
            className="ml-auto relative w-11 h-11 bg-white rounded-full shadow-card flex items-center justify-center active:scale-95 transition-all flex-shrink-0"
          >
            <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
              <path d="M9 2a5.5 5.5 0 00-5.5 5.5v2.25L2 12h14l-1.5-2.25V7.5A5.5 5.5 0 009 2z" stroke="#0c1a12" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M7 14.5a2 2 0 004 0" stroke="#0c1a12" strokeWidth="1.4"/>
            </svg>
            <span className="absolute top-2.5 right-3 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          </button>
        </div>

        {/* Stats card */}
        <div className="bg-ink rounded-[28px] p-5 shadow-float relative overflow-hidden">
          <div
            className="absolute inset-y-0 right-0 w-[70%] pointer-events-none"
            style={{ background: 'linear-gradient(90deg, rgba(200,236,90,0) 0%, rgba(200,236,90,0.14) 40%, rgba(200,236,90,0.30) 100%)' }}
          />
          <p className="relative text-white/55 text-[12px] font-semibold font-display">Handicap Index</p>
          <div className="relative flex items-end justify-between mt-1">
            <p className="font-display font-extrabold text-lime-400 text-[44px] leading-none tracking-tight">
              {handicapText(profile)}
            </p>
            <div className="flex gap-5 pb-1">
              <div className="text-right">
                <p className="font-display font-bold text-white text-[20px] leading-none">{profile.tournamentsPlayed}</p>
                <p className="text-white/55 text-[11px] mt-1">Played</p>
              </div>
              <div className="w-px bg-white/15" />
              <div className="text-right">
                <p className="font-display font-bold text-white text-[20px] leading-none">{headlineStat(profile).value}</p>
                <p className="text-white/55 text-[11px] mt-1">{headlineStat(profile).label}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Playing now — straight into scoring on tournament day */}
        {playing && (
          <div>
            <SectionHeader
              title="Playing now"
              action={{ label: 'Leaderboard', onClick: () => push('leaderboard', { id: playing.id }) }}
            />
            <div className="bg-ink rounded-[28px] p-5 shadow-float">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-lime-400 animate-pulse" />
                <p className="text-lime-400 text-[12px] font-bold font-display">Live · {playing.venue}</p>
              </div>
              <h3 className="font-display font-extrabold text-white text-[20px] leading-tight tracking-tight mt-1.5">{playing.name}</h3>
              <div className="flex gap-5 mt-4">
                {[
                  [myRow?.position || '–', 'Position'],
                  [myRow?.thru ? toPar(myRow.grossToPar) : '–', 'To par'],
                  [myRow ? (myRow.thru === myRow.holes ? 'F' : String(myRow.thru)) : '–', 'Thru'],
                ].map(([value, label]) => (
                  <div key={label}>
                    <p className="font-display font-bold text-white text-[20px] leading-none">{value}</p>
                    <p className="text-white/55 text-[11px] mt-1">{label}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => push('live-play', { id: playing.id })}
                className="mt-5 w-full h-12 rounded-full bg-lime-400 text-ink font-display font-bold text-[15px] active:scale-[0.98] transition-all"
              >
                {myRow && myRow.thru === myRow.holes ? 'View my card' : myRow?.thru ? `Continue · hole ${myRow.thru + 1}` : 'Start my round'}
              </button>
            </div>
          </div>
        )}

        {/* Your next tournament */}
        {REGISTERED && (
          <div>
            <SectionHeader
              title="Up next"
              action={{ label: 'View all', onClick: () => push('tournaments') }}
            />
            <button
              onClick={() => push('tournament-details', { id: REGISTERED.id })}
              className="relative block w-full h-60 rounded-[28px] overflow-hidden text-left shadow-card active:scale-[0.98] transition-all"
            >
              <img src={REGISTERED.imageUrl} alt={REGISTERED.name} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 scrim-bottom" />
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                <StatusBadge status="registered" />
                {days > 0 && <GlassChip>{days === 1 ? 'Tomorrow' : `In ${days} days`}</GlassChip>}
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-[12px] font-semibold font-display">
                    {REGISTERED.dateRange} · {REGISTERED.city}
                  </p>
                  <h3 className="font-display font-extrabold text-white text-[20px] leading-tight tracking-tight mt-1">
                    {REGISTERED.name}
                  </h3>
                </div>
                <div className="w-11 h-11 rounded-full bg-lime-400 flex items-center justify-center flex-shrink-0">
                  <IconArrowRight />
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Discover tournaments */}
        <div>
          <SectionHeader
            title="Open for registration"
            action={{ label: 'See all', onClick: () => push('tournaments') }}
          />
          <div className="space-y-3">
            {DISCOVER.map(t => (
              <TournamentCard
                key={t.id}
                tournament={t}
                onPress={() => push('tournament-details', { id: t.id })}
                compact
              />
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div>
          <SectionHeader title="Quick actions" />
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => push('tournaments')}
              className="bg-lime-400 rounded-3xl p-4 text-left active:scale-[0.98] transition-all"
            >
              <div className="w-10 h-10 bg-ink rounded-full flex items-center justify-center mb-6">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="8" cy="8" r="5.5" stroke="#c8ec5a" strokeWidth="1.6"/>
                  <path d="M12.5 12.5l3 3" stroke="#c8ec5a" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="font-display font-bold text-ink text-[15px] leading-tight tracking-tight">Browse tournaments</p>
              <p className="text-[12px] text-pine-800/70 mt-0.5">Find & register</p>
            </button>
            <button
              onClick={() => push('profile')}
              className="bg-white shadow-card rounded-3xl p-4 text-left active:scale-[0.98] transition-all"
            >
              <div className="w-10 h-10 bg-canvas rounded-full flex items-center justify-center mb-6">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="6" r="3.5" stroke="#0c1a12" strokeWidth="1.5"/>
                  <path d="M3 16c0-3.314 2.686-5.5 6-5.5s6 2.186 6 5.5" stroke="#0c1a12" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="font-display font-bold text-ink text-[15px] leading-tight tracking-tight">My profile</p>
              <p className="text-[12px] text-gray-500 mt-0.5">Handicap & details</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
