import { useState, useEffect } from 'react'
import type { Course, SharedNavProps } from '../types'
import {
  Button, InfoRow, SkeletonRow, ErrorState, RoundButton,
  IconBack, IconPin, TournamentCard, SectionHeader,
} from '../components'
import { getCourse, getTournamentsByCourse } from '../data'
import { dist, generateHoleMap, teeSwatch, teeTotal } from '../golf'
import { HoleMapView } from '../hole-map'

function TeesList({ course }: { course: Course }) {
  const tees = course.teeSets ?? []
  if (!tees.length) return null
  const rating = (r?: number, s?: number) => (r !== undefined ? `${r.toFixed(1)} / ${s}` : '—')
  return (
    <div>
      <h2 className="font-display font-bold text-ink text-[17px] tracking-tight mb-3">Tees</h2>
      <div className="rounded-2xl bg-canvas p-1">
        <div className="grid grid-cols-[1fr_64px_72px_72px] gap-1 px-3 py-2 text-[10px] font-bold font-display text-gray-400">
          <span>Tees</span><span className="text-right">Yards</span><span className="text-right">Men</span><span className="text-right">Women</span>
        </div>
        <div className="bg-white rounded-xl divide-y divide-black/[0.04]">
          {tees.map(t => (
            <div key={t.id} className="grid grid-cols-[1fr_64px_72px_72px] gap-1 items-center px-3 py-2.5 text-[12px]">
              <span className="inline-flex items-center gap-2 font-semibold text-ink min-w-0">
                <span className="w-3 h-3 rounded-full ring-1 ring-black/15 flex-shrink-0" style={{ background: teeSwatch(t.color) }} />
                <span className="truncate">{t.name}</span>
              </span>
              <span className="text-right text-ink">{teeTotal(t).toLocaleString()}</span>
              <span className="text-right text-gray-500">{rating(t.menRating, t.menSlope)}</span>
              <span className="text-right text-gray-500">{rating(t.womenRating, t.womenSlope)}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="text-[11px] text-gray-400 mt-2 px-1">Rating / slope — used for your playing handicap.</p>
    </div>
  )
}

function HoleGuide({ course }: { course: Course }) {
  const [index, setIndex] = useState(0)
  const hole = course.holeData[index]
  if (!hole) return null
  const map = hole.map ?? generateHoleMap(hole)
  return (
    <div>
      <h2 className="font-display font-bold text-ink text-[17px] tracking-tight mb-3">Hole guide</h2>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-2 -mx-5 px-5">
        {course.holeData.map((h, i) => (
          <button key={h.hole} onClick={() => setIndex(i)} aria-pressed={i === index}
            className={`w-9 h-9 rounded-full text-[13px] font-bold font-display flex-shrink-0 ${i === index ? 'bg-ink text-white' : 'bg-canvas text-gray-600'}`}>{h.hole}</button>
        ))}
      </div>
      <div className="mt-2">
        {/* The course's own picture of the hole (from its website or scorecard); a sketch without one */}
        {hole.imageUrl ? (
          <a href={hole.imageUrl} target="_blank" rel="noreferrer" className="block rounded-3xl overflow-hidden bg-canvas">
            <img src={hole.imageUrl} alt={`Hole ${hole.hole} from ${course.name}`} className="w-full aspect-[4/5] object-cover" />
          </a>
        ) : (
          <HoleMapView map={map} size="sm" ariaLabel={`Hole ${hole.hole} layout`} />
        )}
        <p className="text-[11px] text-gray-400 mt-1.5">
          {hole.imageUrl
            ? `Image: ${course.holeImageSource ?? `${course.name} scorecard`}`
            : "Sketch. The course's own picture of this hole shows here once it's added."}
        </p>
      </div>
      <p className="font-display font-extrabold text-ink text-[19px] tracking-tight mt-3">Hole {hole.hole}{hole.name ? ` · ${hole.name}` : ''}</p>
      <p className="text-[13px] text-gray-500">Par {hole.par}{hole.parWomen && hole.parWomen !== hole.par ? ` (women ${hole.parWomen})` : ''} · Stroke index {hole.handicap}</p>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {(course.teeSets ?? []).map(t => (
          <span key={t.id} className="h-8 px-3 rounded-full bg-canvas inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink">
            <span className="w-2.5 h-2.5 rounded-full ring-1 ring-black/15" style={{ background: teeSwatch(t.color) }} />{t.yards[index]} yds
          </span>
        ))}
      </div>
      <p className="text-[12px] text-gray-500 mt-3">Green depth {dist(map.greenFront, map.greenBack)} yds · {map.hazards.filter(h => h.type === 'bunker').length} bunkers{map.hazards.some(h => h.type === 'water') ? ' · water in play' : ''}</p>
      {hole.notes && <p className="text-[13px] text-gray-600 mt-2 leading-relaxed">{hole.notes}</p>}
    </div>
  )
}

interface CourseDetailsProps extends SharedNavProps {
  courseId: string
}

export default function CourseDetails({ courseId, push, pop, showToast }: CourseDetailsProps) {
  const [loading, setLoading]  = useState(true)
  const [nine, setNine]        = useState<'front' | 'back' | 'all'>('front')

  const course      = getCourse(courseId)
  const tournaments = getTournamentsByCourse(courseId)

  useEffect(() => {
    const id = setTimeout(() => setLoading(false), 750)
    return () => clearTimeout(id)
  }, [])

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-canvas relative">
        <div className="h-64 skeleton flex-shrink-0" />
        <div className="absolute top-3 left-4 z-10">
          <RoundButton onClick={pop} tone="glass" label="Back"><IconBack /></RoundButton>
        </div>
        <div className="flex-1 -mt-8 bg-white rounded-t-[32px] px-5 pt-6 space-y-4 relative">
          {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
        </div>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="h-full flex flex-col bg-canvas">
        <div className="px-5 pt-3">
          <RoundButton onClick={pop} label="Back"><IconBack /></RoundButton>
        </div>
        <ErrorState title="Course not found" message="This course could not be loaded." onRetry={pop} />
      </div>
    )
  }

  const frontNine = course.holeData.slice(0, 9)
  const backNine  = course.holeData.slice(9, 18)
  const canSplit = course.holes === 18 && backNine.length > 0
  const shown = canSplit ? nine : 'front'
  const displayHoles = shown === 'all' ? course.holeData : shown === 'back' ? backNine : frontNine
  const totals = (label: string, holes: typeof frontNine) =>
    ({ label, par: holes.reduce((s, h) => s + h.par, 0), yds: holes.reduce((s, h) => s + h.yards, 0) })
  const totalRows = [
    ...(shown !== 'back' ? [totals('OUT', frontNine)] : []),
    ...(shown !== 'front' && backNine.length ? [totals('IN', backNine)] : []),
    ...(shown === 'all' ? [totals('TOT', course.holeData)] : []),
  ]

  const stats: [string | number, string][] = [
    [course.holes, 'Holes'],
    [course.par, 'Par'],
    [course.yardage.toLocaleString(), 'Yards'],
    [course.rating.toFixed(1), 'Rating'],
    [course.slope, 'Slope'],
    [course.established, 'Est.'],
  ]

  const cols = { gridTemplateColumns: '44px 1fr 1fr 1fr' }

  return (
    <div className="h-full flex flex-col bg-canvas relative">
      <div className="absolute top-3 left-4 z-10">
        <RoundButton onClick={pop} tone="glass" label="Back"><IconBack /></RoundButton>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar smooth-scroll">
        {/* Hero */}
        <div className="relative h-64 bg-pine-100">
          <img src={course.imageUrl} alt={course.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 scrim-top" />
          <div className="absolute inset-0 scrim-bottom" />
          <div className="absolute bottom-12 left-5 right-5">
            <div className="flex items-center gap-1.5 mb-1">
              <svg width="13" height="13" viewBox="0 0 15 15" fill="none">
                <path d="M7.5 1.5a4 4 0 014 4c0 2.8-4 8.5-4 8.5S3.5 8.3 3.5 5.5a4 4 0 014-4z" stroke="#c8ec5a" strokeWidth="1.3"/>
                <circle cx="7.5" cy="5.5" r="1.5" stroke="#c8ec5a" strokeWidth="1.3"/>
              </svg>
              <span className="text-[12px] text-white/80 font-semibold font-display">{course.city}, {course.region}</span>
            </div>
            <h1 className="font-display font-extrabold text-white text-[24px] leading-tight tracking-tight">{course.name}</h1>
          </div>
        </div>

        {/* Content sheet */}
        <div className="relative -mt-8 bg-white rounded-t-[32px] px-5 pt-6 pb-8 space-y-7">

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {stats.map(([value, label], i) => (
              <div key={label} className={`rounded-2xl p-3 ${i === 0 ? 'bg-lime-400' : 'bg-canvas'}`}>
                <p className="font-display font-extrabold text-[19px] tracking-tight text-ink leading-none">{value}</p>
                <p className={`text-[11px] font-semibold mt-1.5 ${i === 0 ? 'text-pine-800' : 'text-gray-500'}`}>{label}</p>
              </div>
            ))}
          </div>

          {course.status && course.status !== 'open' && (
            <div className={`rounded-2xl px-4 py-3 ${course.status === 'closed' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>
              <p className="text-[13px] font-bold font-display">{course.status === 'closed' ? 'Course closed' : 'Partly open / maintenance'}</p>
              {course.statusNote && <p className="text-[12px] opacity-80 mt-0.5">{course.statusNote}</p>}
            </div>
          )}

          {/* Info */}
          <div className="space-y-4">
            <InfoRow
              icon={<IconPin />}
              label="Address"
              value={`${course.address}, ${course.city}, ${course.region}`}
            />
            <InfoRow
              icon={
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M2 7.5l4 4 7-7" stroke="#4a9264" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              }
              label="Designer"
              value={course.designer}
            />
            {course.dressCode && <InfoRow icon={<span className="text-[13px]">👕</span>} label="Dress code" value={course.dressCode} />}
          </div>

          {/* Get in touch / get there */}
          {(course.geo || course.phone || course.website) && (
            <div className="grid grid-cols-3 gap-2">
              {course.geo && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${course.geo.lat},${course.geo.lng}`} target="_blank" rel="noreferrer"
                  className="h-12 rounded-2xl bg-ink text-white text-[13px] font-bold font-display flex items-center justify-center active:scale-[0.97]">Directions</a>
              )}
              {course.phone && (
                <a href={`tel:${course.phone.replace(/[^+\d]/g, '')}`}
                  className="h-12 rounded-2xl bg-canvas text-ink text-[13px] font-bold font-display flex items-center justify-center active:scale-[0.97]">Call</a>
              )}
              {course.website && (
                <a href={course.website.startsWith('http') ? course.website : `https://${course.website}`} target="_blank" rel="noreferrer"
                  className="h-12 rounded-2xl bg-canvas text-ink text-[13px] font-bold font-display flex items-center justify-center active:scale-[0.97]">Website</a>
              )}
            </div>
          )}

          {/* Description */}
          <div>
            <h2 className="font-display font-bold text-ink text-[17px] tracking-tight mb-2">About the course</h2>
            <p className="text-[14px] text-gray-500 leading-relaxed">{course.description}</p>
          </div>

          {/* Scorecard */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-bold text-ink text-[17px] tracking-tight">Scorecard</h2>
              {canSplit && (
                <div className="flex bg-canvas rounded-full p-1">
                  {([['front', 'Front 9'], ['back', 'Back 9'], ['all', `All ${course.holes}`]] as const).map(([value, label]) => {
                    const active = shown === value
                    return (
                      <button
                        key={value}
                        aria-pressed={active}
                        onClick={() => setNine(value)}
                        className={`h-7 px-3 rounded-full text-[12px] font-bold font-display transition-all ${
                          active ? 'bg-ink text-white' : 'text-gray-500'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl overflow-hidden bg-canvas p-1">
              <div className="grid text-center" style={cols}>
                {['Hole', 'Par', 'Yds', 'Hcp'].map(h => (
                  <div key={h} className="py-2 text-[11px] font-bold font-display text-gray-400">{h}</div>
                ))}
              </div>

              <div className="bg-white rounded-xl overflow-hidden">
                {displayHoles.map(h => (
                  <div key={h.hole} className="grid text-center border-b border-black/[0.04] last:border-b-0" style={cols}>
                    <div className="py-2.5 flex items-center justify-center">
                      <span className="w-6 h-6 rounded-full bg-canvas text-[11px] font-bold font-display text-ink flex items-center justify-center">
                        {h.hole}
                      </span>
                    </div>
                    <div className="py-2.5 text-[13px] font-semibold text-ink">{h.par}</div>
                    <div className="py-2.5 text-[13px] text-gray-600">{h.yards}</div>
                    <div className="py-2.5 text-[13px] text-gray-400">{h.handicap}</div>
                  </div>
                ))}
              </div>

              {totalRows.map(t => (
                <div key={t.label} className="grid text-center" style={cols}>
                  <div className="py-2.5 text-[11px] font-bold font-display text-ink">{t.label}</div>
                  <div className="py-2.5 text-[13px] font-bold text-ink">{t.par}</div>
                  <div className="py-2.5 text-[13px] font-bold text-ink">{t.yds}</div>
                  <div className="py-2.5 text-[13px] text-gray-400">—</div>
                </div>
              ))}
            </div>
            {course.scorecardImageUrl && (
              <a href={course.scorecardImageUrl} target="_blank" rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold font-display text-ink">View the club's scorecard ›</a>
            )}
          </div>

          <TeesList course={course} />

          <HoleGuide course={course} />

          {!!course.facilities?.length && (
            <div>
              <h2 className="font-display font-bold text-ink text-[17px] tracking-tight mb-3">Facilities</h2>
              <div className="flex flex-wrap gap-1.5">
                {course.facilities.map(f => (
                  <span key={f} className="h-8 px-3 rounded-full bg-canvas text-[12px] font-semibold text-gray-600 inline-flex items-center">{f}</span>
                ))}
              </div>
            </div>
          )}

          {/* Related tournaments */}
          {tournaments.length > 0 && (
            <div>
              <SectionHeader title="Tournaments here" />
              <div className="space-y-3">
                {tournaments.slice(0, 2).map(t => (
                  <TournamentCard
                    key={t.id}
                    tournament={t}
                    onPress={() => push('tournament-details', { id: t.id })}
                    compact
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer action — in normal flow */}
      <div className="flex-shrink-0 bg-white px-5 pt-3 pb-3 border-t border-black/[0.05]">
        <Button
          variant="primary"
          fullWidth
          onClick={() => {
            if (tournaments.length > 0) {
              push('tournament-details', { id: tournaments[0].id })
            } else {
              showToast('No active tournaments at this course', 'info')
            }
          }}
        >
          {tournaments.some(t => t.registrationStatus === 'open')
            ? 'View open tournament'
            : 'View tournaments'}
        </Button>
      </div>
    </div>
  )
}
