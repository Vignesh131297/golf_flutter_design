import { useState, useCallback, useEffect } from 'react'
import type { ScreenName, NavEntry, ToastData, DialogData, NewAccount } from './types'
import { IconHome, IconTournament, IconProfile, IconSpinner } from './components'
import SignIn from './screens/SignIn'
import SignUp, { type AccountBasics } from './screens/SignUp'
import ProfileSetup from './screens/ProfileSetup'
import VerifyEmail from './screens/VerifyEmail'
import { MOCK_PROFILE, applyNewAccount } from './data'
import { resolveAccount, organiserTournament, type Account } from './accounts'
import { assignmentsFor, type Actor } from './ops'
import {
  CardsScreen, IssuesScreen, MeScreen, PaceScreen, PlayScreen, TeeSheetScreen, TodayScreen, WebOnlyScreen, type RoleContext,
} from './screens/Roles'
import Home from './screens/Home'
import TournamentList from './screens/TournamentList'
import TournamentDetails from './screens/TournamentDetails'
import CourseDetails from './screens/CourseDetails'
import Leaderboard from './screens/Leaderboard'
import LivePlay from './screens/LivePlay'
import Profile from './screens/Profile'
import EditProfile from './screens/EditProfile'

/* ───────────────── Status Bar ───────────────── */

function StatusBar() {
  const [time, setTime] = useState(() => {
    const now = new Date()
    return now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  })

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }))
    }, 10_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center justify-between px-6 pt-12 pb-1.5 flex-shrink-0">
      <span className="text-pine-900 text-[15px] font-bold font-display tracking-tight">{time}</span>
      <div className="flex items-center gap-1.5">
        {/* Signal bars */}
        <svg width="18" height="12" viewBox="0 0 18 12" fill="none">
          <rect x="0" y="7" width="3" height="5" rx="0.6" fill="#1a3a2a"/>
          <rect x="5" y="4.5" width="3" height="7.5" rx="0.6" fill="#1a3a2a"/>
          <rect x="10" y="2" width="3" height="10" rx="0.6" fill="#1a3a2a"/>
          <rect x="15" y="0" width="3" height="12" rx="0.6" fill="#1a3a2a"/>
        </svg>
        {/* WiFi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path d="M8 9a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" fill="#1a3a2a"/>
          <path d="M4.5 6.5C5.65 5.4 6.75 5 8 5s2.35.4 3.5 1.5l1-1C11.1 4.1 9.6 3.5 8 3.5S4.9 4.1 3.5 5.5l1 1z" fill="#1a3a2a"/>
          <path d="M2 3.5C3.6 1.9 5.7 1 8 1s4.4.9 6 2.5l1-1C13 .9 10.6 0 8 0S3 .9 1 2.5l1 1z" fill="#1a3a2a" opacity="0.4"/>
        </svg>
        {/* Battery */}
        <div className="flex items-center">
          <div className="w-[25px] h-[12px] border-[1.3px] border-pine-800 rounded-[2.5px] relative p-[1.5px]">
            <div className="h-full bg-pine-800 rounded-[1px]" style={{ width: '72%' }}/>
          </div>
          <div className="w-[2px] h-[5px] bg-pine-800 rounded-r-sm ml-[1.5px] opacity-60"/>
        </div>
      </div>
    </div>
  )
}

/* ───────────────── Dynamic Island ───────────────── */

function DynamicIsland() {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50">
      <div className="w-[120px] h-[34px] bg-black rounded-full" />
    </div>
  )
}

/* ───────────────── Bottom Navigation ───────────────── */

type NavIcon = (p: { active?: boolean }) => React.ReactNode

const NavSvg = ({ children }: { children: React.ReactNode }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)
const IconPlay: NavIcon = () => <NavSvg><path d="M6 21V3M6 4h11l-2.5 4L17 12H6" /><ellipse cx="11" cy="20" rx="6" ry="1.5" /></NavSvg>
const IconPace: NavIcon = () => <NavSvg><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2M9.5 2.5h5" /></NavSvg>
const IconIssues: NavIcon = () => <NavSvg><path d="M12 3l9.5 17h-19L12 3z" /><path d="M12 10v4M12 17v.5" /></NavSvg>
const IconCards: NavIcon = () => <NavSvg><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M3.5 9h17M9 9v11M14.5 9v11" /></NavSvg>
const IconSheet: NavIcon = () => <NavSvg><path d="M7 3.5h10M5 7.5h14M5 7.5v13h14v-13M9 12h6M9 16h4" /></NavSvg>
const IconToday: NavIcon = () => <NavSvg><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4M8 14h3" /></NavSvg>

export interface TabDef { label: string; screen: ScreenName; Icon: NavIcon; match: ScreenName[] }

const GOLFER_TABS: TabDef[] = [
  { label: 'Home', screen: 'home', Icon: IconHome, match: ['home'] },
  { label: 'Events', screen: 'tournaments', Icon: IconTournament, match: ['tournaments', 'tournament-details', 'course-details'] },
  { label: 'Play', screen: 'play', Icon: IconPlay, match: ['play', 'leaderboard', 'live-play'] },
  { label: 'Profile', screen: 'profile', Icon: IconProfile, match: ['profile', 'edit-profile'] },
]
const ME_TAB: TabDef = { label: 'Me', screen: 'staff-profile', Icon: IconProfile, match: ['staff-profile'] }
const MARSHAL_TABS: TabDef[] = [
  { label: 'Pace', screen: 'pace', Icon: IconPace, match: ['pace'] },
  { label: 'Incidents', screen: 'issues', Icon: IconIssues, match: ['issues'] },
  { label: 'Tee sheet', screen: 'tee-sheet', Icon: IconSheet, match: ['tee-sheet'] },
  ME_TAB,
]
const OFFICIAL_TABS: TabDef[] = [
  { label: 'Cards', screen: 'cards', Icon: IconCards, match: ['cards'] },
  { label: 'Disputes', screen: 'issues', Icon: IconIssues, match: ['issues'] },
  { label: 'Pace', screen: 'pace', Icon: IconPace, match: ['pace'] },
  ME_TAB,
]
const ORGANISER_TABS: TabDef[] = [
  { label: 'Today', screen: 'today', Icon: IconToday, match: ['today', 'pace'] },
  { label: 'Cards', screen: 'cards', Icon: IconCards, match: ['cards'] },
  { label: 'Disputes', screen: 'issues', Icon: IconIssues, match: ['issues'] },
  ME_TAB,
]

interface BottomNavProps {
  tabs: TabDef[]
  activeTab: number
  onTabChange: (tab: number) => void
}

function BottomNav({ tabs, activeTab, onTabChange }: BottomNavProps) {
  return (
    <div className="flex-shrink-0 bg-canvas px-5 pt-2">
      {/* Floating pill */}
      <div className="flex items-center gap-1 bg-ink rounded-full p-1.5 shadow-float">
        {tabs.map(({ label, Icon }, i) => {
          const isActive = activeTab === i
          return (
            <button
              key={label}
              onClick={() => onTabChange(i)}
              aria-label={label}
              className={`h-12 flex items-center justify-center gap-2 rounded-full transition-all duration-200 active:scale-95 ${
                isActive ? 'flex-[1.7] bg-lime-400 text-ink' : 'flex-1 text-white/55'
              }`}
            >
              <Icon active={isActive} />
              {isActive && (
                <span className="text-[13px] font-bold font-display tracking-tight">{label}</span>
              )}
            </button>
          )
        })}
      </div>
      {/* Home indicator */}
      <div className="flex justify-center pt-2.5 pb-2">
        <div className="w-32 h-1 bg-ink/25 rounded-full" />
      </div>
    </div>
  )
}

/* ───────────────── Toast ───────────────── */

function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDismiss, 3200)
    return () => clearTimeout(id)
  }, [onDismiss])

  const dot: Record<ToastData['type'], string> = {
    success: 'bg-lime-400 text-ink',
    error:   'bg-rose-500 text-white',
    info:    'bg-white/20 text-white',
  }

  const icons: Record<ToastData['type'], string> = {
    success: '✓',
    error:   '✕',
    info:    'i',
  }

  return (
    <div
      className="absolute bottom-28 left-5 right-5 z-50 flex items-center gap-3 pl-2 pr-4 py-2 rounded-full shadow-float toast-in bg-ink text-white"
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${dot[toast.type]}`}>
        {icons[toast.type]}
      </div>
      <p className="text-sm font-medium flex-1 leading-snug">{toast.message}</p>
      <button onClick={onDismiss} className="opacity-60 text-lg leading-none active:opacity-100">×</button>
    </div>
  )
}

/* ───────────────── Confirmation Dialog ───────────────── */

function Dialog({ dialog, onClose }: { dialog: DialogData; onClose: () => void }) {
  return (
    <>
      <div
        className="absolute inset-0 bg-black/40 z-40 fade-in"
        onClick={onClose}
      />
      <div className="absolute inset-0 z-50 flex items-center justify-center px-8">
        <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-[310px] overflow-hidden fade-in-up p-6">
          <h3 className="font-display font-bold text-ink text-[19px] tracking-tight">{dialog.title}</h3>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">{dialog.message}</p>
          <div className="flex flex-col gap-2 mt-6">
            <button
              onClick={() => { dialog.onConfirm(); onClose() }}
              className={`h-12 rounded-full text-sm font-bold font-display transition-colors ${
                dialog.destructive ? 'bg-rose-600 text-white active:bg-rose-700' : 'bg-ink text-white active:bg-pine-900'
              }`}
            >
              {dialog.confirmLabel ?? 'Confirm'}
            </button>
            <button
              onClick={onClose}
              className="h-12 rounded-full text-sm font-semibold font-display text-gray-600 bg-canvas active:bg-gray-200 transition-colors"
            >
              {dialog.cancelLabel ?? 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ───────────────── Phone Frame (desktop wrapper) ───────────────── */

const PHONE_MAX_WIDTH = 500

/** True on phone-sized viewports, where the app fills the screen instead of drawing a device frame */
function useIsPhoneViewport() {
  const check = () => window.innerWidth <= PHONE_MAX_WIDTH
  const [isPhone, setIsPhone] = useState(check)
  useEffect(() => {
    // Device emulators can fire `resize` before layout settles, so re-check on the next frame too
    const onResize = () => {
      setIsPhone(check())
      requestAnimationFrame(() => setIsPhone(check()))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return isPhone
}

function PhoneFrame({ children, bare }: { children: React.ReactNode; bare: boolean }) {
  if (bare) {
    return (
      <div className="relative w-full h-[100dvh] overflow-hidden bg-canvas">
        {children}
      </div>
    )
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(160deg, #061410 0%, #0f2318 35%, #1a3a2a 70%, #0a1c12 100%)',
      }}
    >
      {/* Ambient orbs */}
      <div
        className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(74,146,100,0.12) 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-1/4 right-1/3 w-64 h-64 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(201,162,39,0.08) 0%, transparent 70%)' }}
      />

      {/* Wordmark */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2">
        <p className="text-white/20 text-[11px] font-display font-semibold tracking-[0.2em] uppercase">
          Golf Tournament Platform
        </p>
      </div>

      {/* Device frame */}
      <div
        className="relative"
        style={{
          width: '390px',
          transform: 'scale(min(1, min(calc((100vh - 60px) / 860px), calc((100vw - 40px) / 400px))))',
          transformOrigin: 'center center',
        }}
      >
        {/* Outer bezel */}
        <div
          className="relative rounded-[52px] overflow-hidden"
          style={{
            background: 'linear-gradient(160deg, #1c2620 0%, #0d1710 100%)',
            padding: '2px',
            boxShadow:
              '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.08)',
          }}
        >
          {/* Screen */}
          <div
            className="rounded-[50px] overflow-hidden bg-canvas relative"
            style={{ height: '844px' }}
          >
            {children}
          </div>
        </div>

        {/* Physical buttons */}
        <div className="absolute left-[-3px] top-[120px] w-[3px] h-[34px] bg-[#1c2620] rounded-l-sm" />
        <div className="absolute left-[-3px] top-[165px] w-[3px] h-[60px] bg-[#1c2620] rounded-l-sm" />
        <div className="absolute left-[-3px] top-[238px] w-[3px] h-[60px] bg-[#1c2620] rounded-l-sm" />
        <div className="absolute right-[-3px] top-[160px] w-[3px] h-[80px] bg-[#1c2620] rounded-r-sm" />
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <p className="text-white/15 text-[10px] font-display tracking-widest uppercase">Sprint 2 · Role-based UI</p>
      </div>
    </div>
  )
}

/* ───────────────── Loading Screen ───────────────── */

function LoadingScreen() {
  return (
    <div className="h-full flex flex-col items-center justify-center bg-pine-800">
      <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-4">
        <IconSpinner />
      </div>
      <p className="text-pine-200 text-sm font-display font-medium">Loading…</p>
    </div>
  )
}

/* ───────────────── Session Expired Dialog ───────────────── */

function SessionExpiredModal({ onDismiss }: { onDismiss: () => void }) {
  return (
    <>
      <div className="absolute inset-0 bg-black/50 z-40 fade-in" />
      <div className="absolute inset-0 z-50 flex items-center justify-center px-8">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[300px] overflow-hidden fade-in-up">
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#d97706" strokeWidth="1.6"/>
                <path d="M12 7v5l3 2" stroke="#d97706" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 className="font-display font-bold text-pine-900 text-[17px]">Session Expired</h3>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">
              Your session has expired for security. Please sign in again to continue.
            </p>
          </div>
          <div className="border-t border-gray-100">
            <button
              onClick={onDismiss}
              className="w-full py-4 text-sm font-semibold text-pine-700 active:bg-pine-50 transition-colors font-display"
            >
              Sign In Again
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/* ───────────────── App Root ───────────────── */

export default function App() {
  // One sign-in for every role: the account decides the tabs (golfer, marshal, official, organiser; admins use the web)
  const [account, setAccount]                 = useState<Account | null>(null)
  const [staffTid, setStaffTid]               = useState<string | null>(null)
  const [activeTab, setActiveTab]             = useState(0)
  const [navStack, setNavStack]               = useState<NavEntry[]>([{ screen: 'home', direction: 'push' }])
  const [toast, setToast]                     = useState<ToastData | null>(null)
  const [dialog, setDialog]                   = useState<DialogData | null>(null)
  const [sessionExpired, setSessionExpired]   = useState(false)
  const [isLoading]                           = useState(false)
  const isAuthenticated = account !== null

  const currentRoute = navStack[navStack.length - 1]
  const canGoBack    = navStack.length > 1

  /* ── Role context: which tournament this session works on, and as whom ── */
  const golferName = `${MOCK_PROFILE.firstName} ${MOCK_PROFILE.lastName}`
  const assignments = account?.kind === 'staff' ? assignmentsFor(account.email).filter(a => a.window !== 'ended') : []
  const assignment = assignments.find(a => a.tournament.id === staffTid) ?? assignments.find(a => a.window === 'live') ?? assignments[0]
  const roleTournament = account?.kind === 'organiser' ? organiserTournament(account.organizerId) : assignment?.tournament
  const actor: Actor =
    account?.kind === 'staff' ? { name: account.name, role: assignment?.role ?? 'marshal' }
    : account?.kind === 'organiser' ? { name: account.name, role: 'organiser' }
    : { name: golferName, role: 'golfer' }

  const tabs: TabDef[] =
    !account || account.kind === 'golfer' ? GOLFER_TABS
    : account.kind === 'organiser' ? ORGANISER_TABS
    : account.kind === 'admin' ? []
    : !assignment ? [ME_TAB]
    : assignment.window === 'upcoming' ? [MARSHAL_TABS[2], ME_TAB]
    : assignment.role === 'official' ? OFFICIAL_TABS : MARSHAL_TABS

  const push = useCallback((screen: ScreenName, params?: Record<string, string>) => {
    setNavStack(prev => [...prev, { screen, params, direction: 'push' }])
  }, [])

  const pop = useCallback(() => {
    setNavStack(prev => {
      if (prev.length <= 1) return prev
      const next = prev.slice(0, -1)
      return [...next.slice(0, -1), { ...next[next.length - 1], direction: 'pop' }]
    })
  }, [])

  const switchTab = useCallback((tab: number) => {
    setActiveTab(tab)
    setNavStack([{ screen: tabs[tab]?.screen ?? 'home', direction: 'push' }])
  }, [tabs])

  const showToast = useCallback((message: string, type: ToastData['type'] = 'success') => {
    const id = Date.now().toString()
    setToast({ id, message, type })
  }, [])

  const showDialog = useCallback((d: DialogData) => setDialog(d), [])

  /** Lands each role on its first tab */
  const enter = useCallback((acc: Account, tid: string | null = null) => {
    setAccount(acc)
    setStaffTid(tid)
    setActiveTab(0)
    let first: ScreenName = 'home'
    if (acc.kind === 'admin') first = 'web-only'
    else if (acc.kind === 'organiser') first = 'today'
    else if (acc.kind === 'staff') {
      const list = assignmentsFor(acc.email).filter(a => a.window !== 'ended')
      const a = list.find(x => x.tournament.id === tid) ?? list.find(x => x.window === 'live') ?? list[0]
      first = !a ? 'staff-profile' : a.window === 'upcoming' ? 'tee-sheet' : a.role === 'official' ? 'cards' : 'pace'
    }
    setNavStack([{ screen: first, direction: 'push' }])
  }, [])

  const handleSignIn = useCallback((email: string, password: string) => {
    const acc = resolveAccount(email, password)
    if (acc === 'invalid') return false
    enter(acc)
    showToast(`Welcome back, ${acc.kind === 'golfer' ? MOCK_PROFILE.firstName : acc.name.split(' ')[0]}`, 'success')
    return true
  }, [enter, showToast])

  /* Sign-up flow: sign in → sign up → verify email → golfer profile setup → home */
  const [authScreen, setAuthScreen]       = useState<'signin' | 'signup' | 'verify' | 'setup'>('signin')
  const [emailVerified, setEmailVerified] = useState(false)
  const [authDirection, setAuthDirection] = useState<'push' | 'pop'>('push')
  const [basics, setBasics]               = useState<AccountBasics | null>(null)

  const goAuth = useCallback((screen: 'signin' | 'signup' | 'verify' | 'setup', direction: 'push' | 'pop') => {
    setAuthDirection(direction)
    setAuthScreen(screen)
  }, [])

  const handleAccountCreated = useCallback((created: NewAccount) => {
    applyNewAccount(created)
    setBasics(null)
    setAuthScreen('signin')
    enter({ kind: 'golfer' })
    showToast(`Welcome, ${MOCK_PROFILE.firstName}! We've emailed a confirmation to ${MOCK_PROFILE.email}`, 'success')
  }, [showToast, enter])

  const handleSignOut = useCallback(() => {
    showDialog({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out of your Golf Tournament Platform account?',
      confirmLabel: 'Sign Out',
      cancelLabel: 'Stay',
      destructive: true,
      onConfirm: () => {
        setAccount(null)
        setNavStack([{ screen: 'home', direction: 'push' }])
        setActiveTab(0)
        showToast('Signed out successfully', 'info')
      },
    })
  }, [showDialog, showToast])

  const handleSessionExpired = useCallback(() => {
    setSessionExpired(false)
    setAccount(null)
    setNavStack([{ screen: 'home', direction: 'push' }])
  }, [])

  /** The golfer who is also a marshal / official opens that duty, and back */
  const switchToStaff = useCallback((tid: string) => {
    enter({ kind: 'staff', email: MOCK_PROFILE.email, name: golferName }, tid)
    showToast('Switched to your tournament duty', 'info')
  }, [enter, showToast, golferName])

  const roleCtx: RoleContext = {
    account: account ?? { kind: 'golfer' },
    t: roleTournament,
    assignment,
    actor,
    selectTournament: tid => { if (account?.kind === 'staff') enter(account, tid) },
    onSignOut: handleSignOut,
    switchToGolf: account?.kind === 'staff' && account.email === MOCK_PROFILE.email.toLowerCase()
      ? () => { enter({ kind: 'golfer' }); showToast('Back to your golf', 'info') } : undefined,
  }

  const sharedProps = { push, pop, showToast, showDialog, canGoBack }
  const roleProps = { ...sharedProps, ctx: roleCtx }

  /* Derive the active tab from the current screen */
  useEffect(() => {
    const i = tabs.findIndex(t => t.match.includes(currentRoute.screen))
    if (i >= 0) setActiveTab(i)
  }, [currentRoute.screen, tabs])

  function renderScreen() {
    if (!isAuthenticated) {
      const authContent =
        authScreen === 'signup' ? (
          <SignUp
            onBack={() => goAuth('signin', 'pop')}
            onContinue={b => { setBasics(b); setEmailVerified(false); goAuth('verify', 'push') }}
          />
        ) : authScreen === 'verify' && basics ? (
          <VerifyEmail email={basics.email} onBack={() => goAuth('signup', 'pop')} showToast={showToast}
            onDone={v => { setEmailVerified(v); goAuth('setup', 'push') }} />
        ) : authScreen === 'setup' && basics ? (
          <ProfileSetup basics={basics} emailVerified={emailVerified} onBack={() => goAuth('verify', 'pop')} onComplete={handleAccountCreated} />
        ) : (
          <SignIn onSignIn={handleSignIn} onSignUp={() => goAuth('signup', 'push')} showToast={showToast} />
        )
      return (
        <div key={authScreen} className={`h-full ${authDirection === 'pop' ? 'screen-pop' : 'screen-push'}`}>
          {authContent}
        </div>
      )
    }

    if (isLoading) return <LoadingScreen />

    const animClass = currentRoute.direction === 'pop' ? 'screen-pop' : 'screen-push'

    const screenContent = (() => {
      switch (currentRoute.screen) {
        case 'home':
          return <Home {...sharedProps} />
        case 'tournaments':
          return <TournamentList {...sharedProps} />
        case 'tournament-details':
          return <TournamentDetails {...sharedProps} tournamentId={currentRoute.params?.id ?? 't1'} />
        case 'course-details':
          return <CourseDetails {...sharedProps} courseId={currentRoute.params?.id ?? 'c1'} />
        case 'leaderboard':
          return <Leaderboard {...sharedProps} tournamentId={currentRoute.params?.id ?? 't8'} />
        case 'live-play':
          return <LivePlay {...sharedProps} tournamentId={currentRoute.params?.id ?? 't8'} />
        case 'play':
          return <PlayScreen {...roleProps} />
        case 'profile':
          return <Profile {...sharedProps} onSignOut={handleSignOut} onSwitchRole={switchToStaff} />
        case 'edit-profile':
          return <EditProfile {...sharedProps} />
        case 'pace':
          return <PaceScreen {...roleProps} />
        case 'issues':
          return <IssuesScreen {...roleProps} />
        case 'cards':
          return <CardsScreen {...roleProps} />
        case 'tee-sheet':
          return <TeeSheetScreen {...roleProps} />
        case 'today':
          return <TodayScreen {...roleProps} />
        case 'staff-profile':
          return <MeScreen {...roleProps} />
        case 'web-only':
          return <WebOnlyScreen {...roleProps} />
        default:
          return account?.kind === 'golfer' ? <Home {...sharedProps} /> : null
      }
    })()

    return (
      <div key={currentRoute.screen + JSON.stringify(currentRoute.params) + (roleTournament?.id ?? '')} className={`h-full ${animClass}`}>
        {screenContent}
      </div>
    )
  }

  // Live scoring is a focused, full-screen mode on the course
  const showBottomNav = isAuthenticated && !isLoading && currentRoute.screen !== 'live-play' && tabs.length > 0
  const isPhone       = useIsPhoneViewport()

  return (
    <PhoneFrame bare={isPhone}>
      {!isPhone && <DynamicIsland />}
      <div className="flex flex-col h-full bg-canvas">
        {/* On a real phone the device draws its own status bar, so only keep the fake one in the desktop mockup */}
        {isPhone
          ? <div className="flex-shrink-0" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }} />
          : <StatusBar />}

        {/* Screen content */}
        {/* Bottom sheets portal into this element so they cover the screen whatever scrolls inside it */}
        <div id="screen-root" className="flex-1 overflow-hidden relative">
          {renderScreen()}
        </div>

        {/* Bottom nav */}
        {showBottomNav && (
          <BottomNav tabs={tabs} activeTab={activeTab} onTabChange={switchTab} />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <Toast key={toast.id} toast={toast} onDismiss={() => setToast(null)} />
      )}

      {/* Dialog */}
      {dialog && (
        <Dialog dialog={dialog} onClose={() => setDialog(null)} />
      )}

      {/* Session expired */}
      {sessionExpired && (
        <SessionExpiredModal onDismiss={handleSessionExpired} />
      )}
    </PhoneFrame>
  )
}
