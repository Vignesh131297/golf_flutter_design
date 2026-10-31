import type { SharedNavProps } from '../types'
import { IconPin } from '../components'
import { MOCK_PROFILE, MOCK_TOURNAMENTS } from '../data'
import { hasShownInterest, showInterest, useOpsVersion } from '../ops'
import { myEntry } from '../live'

/**
 * Other tournaments we run (client, 21 Oct call): we promote our own events, never the course's other
 * events. "I'm interested" sends the signed-in golfer's name and contact details to that organiser.
 */
export default function MoreTournaments({ excludeId, excludeCourseId, push, showToast }: Pick<SharedNavProps, 'push' | 'showToast'> & {
  excludeId?: string
  excludeCourseId?: string
}) {
  useOpsVersion()
  const me = { name: `${MOCK_PROFILE.firstName} ${MOCK_PROFILE.lastName}`, email: MOCK_PROFILE.email, phone: MOCK_PROFILE.phone }
  const others = MOCK_TOURNAMENTS
    .filter(t => t.status !== 'draft' && t.status !== 'completed' && t.status !== 'cancelled')
    .filter(t => t.id !== excludeId && t.courseId !== excludeCourseId)
    // Not the ones they've already entered
    .filter(t => myEntry(t.id)?.status !== 'registered')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 3)
  if (!others.length) return null

  return (
    <div>
      <h2 className="font-display font-bold text-ink text-[17px] tracking-tight">More tournaments on our platform</h2>
      <p className="text-[12px] text-gray-500 mt-0.5 mb-3">Tap “I’m interested” and the organiser will get in touch.</p>
      <div className="space-y-2.5">
        {others.map(t => {
          const sent = hasShownInterest(t.id, me.email)
          return (
            <div key={t.id} className="bg-white rounded-3xl shadow-card p-2.5 flex items-center gap-3">
              <button onClick={() => push('tournament-details', { id: t.id })} className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-canvas" aria-label={`Open ${t.name}`}>
                <img src={t.imageUrl} alt="" className="w-full h-full object-cover" />
              </button>
              <button onClick={() => push('tournament-details', { id: t.id })} className="flex-1 min-w-0 text-left">
                <span className="block text-[11px] font-semibold font-display text-pine-500">{t.dateRange}</span>
                <span className="block font-display font-bold text-ink text-[14px] leading-snug line-clamp-2">{t.name}</span>
                <span className="flex items-center gap-1 text-[11px] text-gray-500 truncate"><IconPin />{t.city}</span>
              </button>
              <button
                disabled={sent}
                onClick={() => { showInterest(t.id, me); showToast('Sent — the organiser will contact you') }}
                className={`h-9 px-3 rounded-full text-[11px] font-bold font-display flex-shrink-0 ${sent ? 'bg-pine-50 text-pine-700' : 'bg-ink text-white active:scale-[0.97]'}`}>
                {sent ? 'Sent ✓' : 'I’m interested'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
