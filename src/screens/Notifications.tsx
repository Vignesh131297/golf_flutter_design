import { useEffect, useState } from 'react'
import type { SharedNavProps } from '../types'
import { Button, TopAppBar } from '../components'
import { MOCK_TOURNAMENTS, getTournament } from '../data'
import { myEntry, groupOf, useLiveVersion } from '../live'
import { currentRound, suspendPlay, resumePlay } from '../ops'
import { formatClock } from '../golf'
import {
  MY_ACCOUNT, NOTIFY_LABEL, announcementById, canReadAnnouncement, devicesFor, landingFor, markShown, notifyTeeTimeChange, payloadOf, pushPermission, recentForMe,
  rotateToken, sendAnnouncement, setPushPermission, unseenForMe, useNotifyVersion, type Landing, type NotifyEvent,
} from '../notify'

/*
 * Sprint 4 · PN1–PN3 on the phone:
 *  - ask for notification permission at a useful moment (not on first launch), app keeps working if refused
 *  - register this phone's token to the signed-in account; remove it on sign-out
 *  - show an alert once (foreground banner), and on tap re-check access before opening anything
 *  - safe "no longer available" screen when the alert's target moved, was cancelled or isn't yours
 * The phone can't receive the web prototype's alerts (separate apps in the browser), so Notification settings has
 * a "Send me a test alert" panel that fires the same events the organiser console does.
 */

/* ───────── Permission ───────── */

/** Our explanation first, then the operating system's own question */
export function PermissionPrompt({ onDone }: { onDone: (granted: boolean) => void }) {
  const [os, setOs] = useState(false)
  return (
    <div className="absolute inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 fade-in" role="dialog" aria-modal="true">
      {!os ? (
        <div className="w-full bg-white rounded-t-[32px] p-6 fade-in-up">
          <div className="w-12 h-12 rounded-2xl bg-lime-400 flex items-center justify-center text-[24px] mb-3">🔔</div>
          <h2 className="font-display font-extrabold text-ink text-[20px]">Get tournament alerts</h2>
          <p className="text-[14px] text-gray-600 mt-1 leading-relaxed">We’ll tell you when your tee time changes, when play is stopped or restarted, and when the organiser sends an announcement. Nothing else.</p>
          <div className="flex gap-2 mt-5">
            <Button variant="secondary" fullWidth onClick={() => onDone(false)}>Not now</Button>
            <Button fullWidth onClick={() => setOs(true)}>Continue</Button>
          </div>
        </div>
      ) : (
        <div className="mx-8 mb-[40%] w-[270px] rounded-[14px] bg-[#f2f2f2]/95 backdrop-blur text-center overflow-hidden fade-in">
          <div className="px-4 pt-4 pb-3">
            <p className="text-[15px] font-semibold text-black">“Golf” Would Like to Send You Notifications</p>
            <p className="text-[12px] text-black/70 mt-1">Notifications may include alerts, sounds and icon badges. These can be configured in Settings.</p>
          </div>
          <div className="grid grid-cols-2 border-t border-black/15 text-[16px]">
            <button className="h-11 text-[#007aff] border-r border-black/15" onClick={() => onDone(false)}>Don’t Allow</button>
            <button className="h-11 text-[#007aff] font-semibold" onClick={() => onDone(true)}>Allow</button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Card on Home: shown until the golfer decides; a quiet reminder if they said no */
export function AlertsCard({ onAsk, onSettings }: { onAsk: () => void; onSettings: () => void }) {
  useNotifyVersion()
  const p = pushPermission()
  if (p === 'granted') return null
  if (p === 'denied') return (
    <button onClick={onSettings} className="w-full mb-4 rounded-2xl bg-white shadow-card px-4 py-3 text-left flex items-center gap-3">
      <span className="text-[18px]">🔕</span>
      <span className="flex-1 text-[12px] text-gray-600"><span className="font-bold text-ink block text-[13px]">Tournament alerts are off</span>You’ll still get emails. Turn alerts on in Settings.</span>
      <span className="text-[12px] font-bold text-pine-600">Settings ›</span>
    </button>
  )
  return (
    <div className="mb-4 rounded-3xl bg-ink text-white p-4 flex items-center gap-3">
      <span className="text-[22px]">🔔</span>
      <span className="flex-1 text-[12px] text-white/75"><span className="block font-display font-bold text-[14px] text-white">Tee time changed? Play stopped?</span>Get an alert on this phone.</span>
      <button onClick={onAsk} className="h-9 px-4 rounded-full bg-lime-400 text-ink text-[12px] font-bold font-display">Turn on</button>
    </div>
  )
}

/* ───────── Foreground banner ───────── */

/** One banner per new alert. Shown once (also after reconnecting), then tap opens it. */
export function PushBanner({ enabled, onOpen }: { enabled: boolean; onOpen: (e: NotifyEvent) => void }) {
  useNotifyVersion()
  const next = enabled ? unseenForMe()[0] : undefined
  const [shown, setShown] = useState<NotifyEvent | null>(null)
  useEffect(() => {
    if (!next || shown) return
    markShown(next.id)
    setShown(next)
  }, [next, shown])
  useEffect(() => {
    if (!shown) return
    const id = setTimeout(() => setShown(null), 7000)
    return () => clearTimeout(id)
  }, [shown])
  if (!shown) return null
  return (
    <button onClick={() => { setShown(null); onOpen(shown) }} aria-label={`Alert: ${shown.title}. Tap to open`}
      className="absolute left-3 right-3 top-[52px] z-[60] rounded-[22px] bg-white/95 backdrop-blur shadow-float px-4 py-3 text-left flex gap-3 fade-in-down">
      <span className="w-9 h-9 rounded-xl bg-ink text-lime-400 flex items-center justify-center font-display font-extrabold text-[13px] flex-shrink-0">G</span>
      <span className="flex-1 min-w-0">
        <span className="flex justify-between text-[11px] text-gray-400 font-semibold"><span>GOLF · {NOTIFY_LABEL[shown.kind].toUpperCase()}</span><span>now</span></span>
        <span className="block text-[14px] font-bold text-ink leading-snug">{shown.title}</span>
        <span className="block text-[13px] text-gray-600 leading-snug line-clamp-2">{shown.body}</span>
      </span>
    </button>
  )
}

/** Where a tap lands: re-checks access against the current state (PN3) */
export function openAlert(e: NotifyEvent, push: SharedNavProps['push']) {
  const l: Landing = landingFor(payloadOf(e), MY_ACCOUNT())
  if (!l.ok) return push('alert-unavailable', { title: l.title, message: l.message, tournamentId: e.tournamentId })
  if (l.screen === 'announcement') return push('announcement', { id: l.announcementId })
  if (l.screen === 'live-play') return push('live-play', { id: l.tournamentId })
  return push('tournament-details', { id: l.tournamentId, ...(l.screen === 'tournament' && l.focus ? { focus: l.focus } : {}) })
}

/* ───────── Screens ───────── */

export function AnnouncementScreen({ id, pop, push }: SharedNavProps & { id: string }) {
  useNotifyVersion()
  const a = announcementById(id)
  const t = a ? getTournament(a.tournamentId) : undefined
  if (!a || !t || !canReadAnnouncement(a, MY_ACCOUNT())) {
    return <AlertUnavailable pop={pop} push={push} title="Announcement not available" message="It may have been for another account, or the tournament was removed." />
  }
  return (
    <div className="h-full flex flex-col bg-canvas">
      <TopAppBar title="Announcement" onBack={pop} />
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        <p className="text-[12px] font-semibold text-pine-600 font-display">{t.name}</p>
        <h1 className="font-display font-extrabold text-ink text-[24px] leading-tight tracking-tight mt-1">{a.title}</h1>
        <p className="text-[12px] text-gray-500 mt-1">From {a.sentBy.name} · {new Date(a.sentAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</p>
        <div className="mt-4 bg-white rounded-3xl shadow-card p-5 text-[15px] text-ink leading-relaxed whitespace-pre-line">{a.body}</div>
        <Button fullWidth variant="secondary" className="mt-4" onClick={() => push('tournament-details', { id: t.id })}>Open {t.name}</Button>
      </div>
    </div>
  )
}

export function AlertUnavailable({ pop, push, title, message, tournamentId }: Pick<SharedNavProps, 'pop' | 'push'> & { title: string; message: string; tournamentId?: string }) {
  const t = tournamentId ? getTournament(tournamentId) : undefined
  const open = t && t.status !== 'cancelled'
  return (
    <div className="h-full flex flex-col bg-canvas">
      <TopAppBar title="Alert" onBack={pop} />
      <div className="flex-1 flex flex-col items-center justify-center text-center px-8 pb-16">
        <span className="w-16 h-16 rounded-full bg-white shadow-card flex items-center justify-center text-[28px]">🔔</span>
        <h1 className="font-display font-extrabold text-ink text-[20px] mt-4">{title}</h1>
        <p className="text-[14px] text-gray-600 mt-1 leading-relaxed">{message}</p>
        <div className="w-full mt-6 space-y-2">
          {open && <Button fullWidth onClick={() => push('tournament-details', { id: t.id })}>See {t.name} now</Button>}
          <Button fullWidth variant="secondary" onClick={pop}>Back</Button>
        </div>
      </div>
    </div>
  )
}

export function NotificationSettings({ pop, push, showToast }: SharedNavProps) {
  useNotifyVersion()
  useLiveVersion()
  const [asking, setAsking] = useState(false)
  const p = pushPermission()
  const mine = devicesFor(MY_ACCOUNT())
  const recent = recentForMe(8)
  const live = MOCK_TOURNAMENTS.find(t => t.status === 'in-progress' && myEntry(t.id))
  const me = live ? myEntry(live.id) : undefined
  const demo = { name: 'Dana Whitfield', role: 'organiser' as const }

  function testTeeTime() {
    if (!live || !me) return showToast('You’re not in a live tournament', 'error')
    const round = currentRound(live)
    const g = groupOf(live.id, round, me.id)
    const time = g ? formatClock(g.time) : 'later'
    notifyTeeTimeChange(live, round, [me.id], demo, `Your round ${round} tee time moved to ${time} (was 10 minutes earlier).`)
  }
  function testAnnouncement() {
    if (!live) return
    const r = sendAnnouncement(live, { title: 'Shotgun restart at 1:15', body: 'Lunch is in the clubhouse until 12:45. Carts leave the bag drop at 1:00 — go to the hole you finished on.', audience: 'both' }, demo, `demo-${Date.now()}`)
    if (!r.ok) showToast(r.error, 'error')
  }
  function testSuspend() {
    if (!live) return
    suspendPlay(live, currentRound(live), 'Lightning in the area', 'Head for the nearest shelter.', demo)
  }

  return (
    <div className="h-full flex flex-col bg-canvas">
      <TopAppBar title="Notifications" onBack={pop} />
      <div className="flex-1 overflow-y-auto px-5 pb-10 space-y-4">
        <section className="bg-white rounded-3xl shadow-card p-5">
          <p className="text-[12px] font-semibold text-gray-500">Tournament alerts on this phone</p>
          <p className="font-display font-extrabold text-ink text-[20px]">{p === 'granted' ? 'On' : p === 'denied' ? 'Off — blocked in Settings' : 'Not set up'}</p>
          <p className="text-[13px] text-gray-600 mt-1">Tee-time changes, play suspended / resumed, organiser announcements and staff assignments. Emails come either way.</p>
          {p === 'not-asked' && <Button fullWidth className="mt-3" onClick={() => setAsking(true)}>Turn on alerts</Button>}
          {p === 'denied' && (
            <Button fullWidth variant="secondary" className="mt-3" onClick={() => { setPushPermission('granted'); showToast('Allowed in Settings — alerts are on') }}>Open Settings › Notifications</Button>
          )}
          {p === 'granted' && <button className="mt-3 text-[12px] font-semibold text-gray-500 underline underline-offset-4" onClick={() => { setPushPermission('denied'); showToast('Turned off in Settings', 'info') }}>Simulate: turn off in phone Settings</button>}
        </section>

        <section className="bg-white rounded-3xl shadow-card p-5">
          <p className="font-display font-bold text-ink text-[15px]">Your devices</p>
          <p className="text-[12px] text-gray-500">Alerts go to every phone signed in to {MY_ACCOUNT()}. Signing out removes that phone.</p>
          {mine.length === 0 ? <p className="text-[13px] text-gray-500 mt-3">No phones with alerts on.</p> : (
            <ul className="mt-3 divide-y divide-black/[0.05]">
              {mine.map(d => (
                <li key={d.id} className="py-2.5 flex items-center gap-3">
                  <span className="text-[18px]">{d.platform === 'ios' ? '📱' : '🤖'}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[14px] font-semibold text-ink">{d.label} · {d.platform === 'ios' ? 'iOS (APNs)' : 'Android (FCM)'}</span>
                    <span className="block text-[11px] text-gray-400 truncate">{d.environment} · token {d.token}</span>
                  </span>
                  <button className="text-[11px] font-bold text-pine-600" onClick={() => { rotateToken(d.id); showToast('Token refreshed — same device, no duplicate', 'info') }}>Rotate</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-white rounded-3xl shadow-card p-5">
          <p className="font-display font-bold text-ink text-[15px]">Recent alerts</p>
          {recent.length === 0 ? <p className="text-[13px] text-gray-500 mt-2">None yet.</p> : (
            <ul className="mt-2 divide-y divide-black/[0.05]">
              {recent.map(e => (
                <li key={e.id}>
                  <button onClick={() => openAlert(e, push)} className="w-full py-2.5 text-left">
                    <span className="block text-[11px] font-bold text-gray-400">{NOTIFY_LABEL[e.kind]} · {new Date(e.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
                    <span className="block text-[14px] font-semibold text-ink">{e.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-3xl ring-1 ring-dashed ring-black/15 p-5">
          <p className="font-display font-bold text-ink text-[15px]">Send me a test alert (prototype)</p>
          <p className="text-[12px] text-gray-500">Fires the same event the organiser console sends{live ? ` for ${live.name}` : ''}.</p>
          <div className="grid grid-cols-1 gap-2 mt-3">
            <Button size="sm" variant="secondary" onClick={testTeeTime} disabled={!live}>Tee time changed</Button>
            <Button size="sm" variant="secondary" onClick={testAnnouncement} disabled={!live}>Organiser announcement</Button>
            <Button size="sm" variant="secondary" onClick={testSuspend} disabled={!live}>Play suspended</Button>
            <Button size="sm" variant="ghost" onClick={() => live && resumePlay(live, currentRound(live), 'Lightning has passed. Restart at 1:15.', demo)} disabled={!live}>Play resumed</Button>
          </div>
          {p !== 'granted' && <p className="text-[12px] text-amber-700 mt-2">Alerts are off on this phone, so these arrive by email only.</p>}
        </section>
      </div>
      {asking && <PermissionPrompt onDone={g => { setAsking(false); setPushPermission(g ? 'granted' : 'denied'); showToast(g ? 'Alerts are on for this phone' : 'No alerts — you’ll still get emails', g ? 'success' : 'info') }} />}
    </div>
  )
}
