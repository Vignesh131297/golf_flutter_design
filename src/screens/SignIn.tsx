import { useState, type FormEvent } from 'react'
import type { ToastData } from '../types'
import { Button, Input, IconEye, fieldClass } from '../components'

interface SignInProps {
  /** false = known account, wrong password */
  onSignIn: (email: string, password: string) => boolean
  onSignUp: () => void
  showToast: (message: string, type?: ToastData['type']) => void
}

type SignInState = 'idle' | 'loading' | 'error' | 'server-error'

/** Prototype only: one tap fills a demo login for each role */
const DEMO_ROLES = [
  { role: 'Golfer', email: 'alex.hartwell@golfclub.com', password: 'golfer' },
  { role: 'Organiser', email: 'dana@augustapines.com', password: 'augusta' },
  { role: 'Marshal', email: 'marshal@gmail.com', password: 'marshal' },
  { role: 'Official', email: 'official@gmail.com', password: 'official' },
  { role: 'Admin', email: 'admin@gmail.com', password: 'admin' },
]

export default function SignIn({ onSignIn, onSignUp, showToast }: SignInProps) {
  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [emailError, setEmailError] = useState('')
  const [pwError, setPwError]       = useState('')
  const [state, setState]           = useState<SignInState>('idle')

  function validateEmail(v: string) {
    if (!v) return 'Email is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address'
    return ''
  }

  function validatePw(v: string) {
    if (!v) return 'Password is required'
    if (v.length < 4) return 'Password must be at least 4 characters'
    return ''
  }

  function handleEmailBlur() {
    setEmailError(validateEmail(email))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const ev = validateEmail(email)
    const pv = validatePw(password)
    setEmailError(ev)
    setPwError(pv)
    if (ev || pv) return

    setState('loading')

    // Simulate API call — "serverdown" triggers server error demo
    setTimeout(() => {
      if (password === 'serverdown') {
        setState('server-error')
        return
      }
      if (password === 'wrongpass') {
        setState('error')
        return
      }
      // One sign-in for every role: the account decides which tabs open
      if (!onSignIn(email, password)) return setState('error')
      setState('idle')
    }, 1600)
  }

  const serverError = state === 'server-error'
  const credError   = state === 'error'

  return (
    <div className="h-full overflow-y-auto no-scrollbar bg-canvas flex flex-col">
      {/* Hero card */}
      <div className="flex-shrink-0 px-4 pt-2">
        <div className="relative bg-ink rounded-[32px] px-6 pt-10 pb-7 overflow-hidden">
          <div
            className="absolute -right-16 -top-20 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(200,236,90,0.30) 0%, rgba(200,236,90,0) 70%)' }}
          />
          <h1 className="relative font-display font-extrabold text-white text-[32px] leading-[1.05] tracking-tight">
            Play the<br />
            <span className="text-lime-400">tournaments</span><br />
            you love.
          </h1>
          <p className="relative text-white/55 text-sm mt-3 font-medium">
            Golf Tournament Platform
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pt-7 pb-6">
        <div className="mb-6">
          <h2 className="font-display font-extrabold text-ink text-[24px] tracking-tight">Welcome back</h2>
          <p className="text-gray-500 text-sm mt-1">Sign in to your account to continue</p>
        </div>

        {/* Server error banner */}
        {serverError && (
          <div className="mb-5 flex items-start gap-3 bg-rose-50 rounded-2xl px-4 py-3.5 fade-in">
            <svg width="18" height="18" viewBox="0 0 18 18" className="flex-shrink-0 mt-0.5" fill="none">
              <circle cx="9" cy="9" r="8" stroke="#dc2626" strokeWidth="1.3" fill="#fef2f2"/>
              <path d="M9 5.5v4M9 11v1" stroke="#dc2626" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700 font-display">Server error</p>
              <p className="text-xs text-red-500 mt-0.5">Unable to connect. Please try again shortly.</p>
            </div>
          </div>
        )}

        {/* Invalid credentials banner */}
        {credError && (
          <div className="mb-5 flex items-start gap-3 bg-rose-50 rounded-2xl px-4 py-3.5 fade-in">
            <svg width="18" height="18" viewBox="0 0 18 18" className="flex-shrink-0 mt-0.5" fill="none">
              <circle cx="9" cy="9" r="8" stroke="#dc2626" strokeWidth="1.3" fill="#fef2f2"/>
              <path d="M6 6l6 6M12 6l-6 6" stroke="#dc2626" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700 font-display">Invalid credentials</p>
              <p className="text-xs text-red-500 mt-0.5">The email or password you entered is incorrect.</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Input
            label="Email address"
            type="email"
            placeholder="alex@golfclub.com"
            value={email}
            onChange={e => { setEmail(e.target.value); if (emailError) setEmailError('') }}
            onBlur={handleEmailBlur}
            error={emailError}
            autoComplete="email"
            inputMode="email"
            onCanvas
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-gray-600 font-display">Password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={e => { setPassword(e.target.value); if (pwError) setPwError('') }}
                onBlur={() => setPwError(validatePw(password))}
                autoComplete="current-password"
                className={`${fieldClass(!!pwError, true)} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1 active:opacity-60 transition-opacity"
                tabIndex={-1}
              >
                <IconEye show={showPw} />
              </button>
            </div>
            {pwError && (
              <p className="flex items-center gap-1.5 text-xs text-red-500 font-medium">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <circle cx="6" cy="6" r="5.5" fill="#dc2626" fillOpacity="0.15"/>
                  <path d="M6 4v2.5M6 8v.5" stroke="#dc2626" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                {pwError}
              </p>
            )}
          </div>

          {/* Forgot password */}
          <div className="flex justify-end -mt-1">
            <button
              type="button"
              onClick={() => showToast('Password reset email sent', 'info')}
              className="text-ink text-[13px] font-semibold font-display underline underline-offset-4 decoration-lime-500 decoration-2 active:opacity-60 transition-opacity"
            >
              Forgot password?
            </button>
          </div>

          <Button
            type="submit"
            fullWidth
            size="lg"
            loading={state === 'loading'}
            className="mt-2"
          >
            {state === 'loading' ? 'Signing in…' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-5 rounded-2xl bg-white shadow-card px-4 py-3">
          <p className="text-[11px] font-bold font-display text-gray-500">Try a role (demo)</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {DEMO_ROLES.map(r => (
              <button key={r.role} type="button" onClick={() => { setEmail(r.email); setPassword(r.password); setEmailError(''); setPwError('') }}
                className={`h-8 px-3 rounded-full text-[12px] font-bold font-display ${email === r.email ? 'bg-ink text-white' : 'bg-canvas text-ink'}`}>
                {r.role}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={onSignUp}
            className="text-ink font-semibold font-display underline underline-offset-4 decoration-lime-500 decoration-2 active:opacity-60"
          >
            Sign up
          </button>
        </p>
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 pt-2 flex-shrink-0">
        <p className="text-center text-[10px] leading-relaxed text-gray-400">
          By signing in, you agree to our<br />
          <span className="text-ink font-semibold">Terms of Service</span>
          {' '}and{' '}
          <span className="text-ink font-semibold">Privacy Policy</span>
        </p>
      </div>
    </div>
  )
}
