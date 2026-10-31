import { useState, type FormEvent } from 'react'
import { Button, Input, PasswordInput, PhoneInput, RoundButton, IconBack } from '../components'
import { isBlockedPassword, nameError, phoneError, EMAIL_RE } from '../account-rules'
import { accountExists } from '../ops'

export interface AccountBasics {
  fullName: string
  firstName?: string
  lastName?: string
  email: string
  phone: string
  password: string
  marketingOptIn?: boolean
}

interface SignUpProps {
  onBack: () => void
  onContinue: (basics: AccountBasics) => void
}

type Errors = Partial<Record<'firstName' | 'lastName' | 'email' | 'phone' | 'password' | 'confirm' | 'terms', string>>

function passwordStrength(pw: string) {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score // 0–4
}

const STRENGTH_LABEL = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_BAR   = ['bg-rose-400', 'bg-rose-400', 'bg-amber-400', 'bg-lime-500', 'bg-lime-500']

export default function SignUp({ onBack, onContinue }: SignUpProps) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [terms, setTerms]         = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [email, setEmail]       = useState('')
  const [phone, setPhone]       = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [errors, setErrors]     = useState<Errors>({})
  const [loading, setLoading]   = useState(false)

  function validate(): Errors {
    const e: Errors = {}
    const fe = nameError(firstName, 'first'); if (fe) e.firstName = fe
    const le = nameError(lastName, 'last'); if (le) e.lastName = le
    if (!email.trim()) e.email = 'Email is required'
    else if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email address'
    else if (accountExists(email)) e.email = 'An account with this email already exists. Sign in instead.'
    const pe = phoneError(phone); if (pe) e.phone = pe
    if (password.length < 8) e.password = 'Use at least 8 characters'
    else if (isBlockedPassword(password)) e.password = 'This password is too common — choose another'
    if (!terms) e.terms = 'Please agree to the Terms of Service and Privacy Policy'
    if (!confirm) e.confirm = 'Please confirm your password'
    else if (confirm !== password) e.confirm = "Passwords don't match"
    return e
  }

  function clear(field: keyof Errors) {
    if (errors[field]) setErrors(x => ({ ...x, [field]: undefined }))
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) return

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onContinue({
        fullName: `${firstName.trim()} ${lastName.trim()}`, firstName: firstName.trim(), lastName: lastName.trim(),
        email: email.trim(), phone: phone.trim(), password, marketingOptIn: marketing,
      })
    }, 1200)
  }

  const strength = passwordStrength(password)

  return (
    <div className="h-full overflow-y-auto no-scrollbar bg-canvas flex flex-col">
      {/* Hero card */}
      <div className="flex-shrink-0 px-4 pt-2">
        <div className="relative bg-ink rounded-[32px] px-6 pt-5 pb-7 overflow-hidden">
          <div
            className="absolute -right-16 -top-20 w-64 h-64 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(200,236,90,0.30) 0%, rgba(200,236,90,0) 70%)' }}
          />
          <div className="relative">
            <RoundButton onClick={onBack} tone="glass" label="Back to sign in"><IconBack /></RoundButton>
          </div>
          <h1 className="relative font-display font-extrabold text-white text-[30px] leading-[1.05] tracking-tight mt-6">
            Join the<br />
            <span className="text-lime-400">clubhouse.</span>
          </h1>
          <p className="relative text-white/55 text-sm mt-3 font-medium">
            Create your account to enter tournaments
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pt-7 pb-6">
        <div className="mb-6">
          <h2 className="font-display font-extrabold text-ink text-[24px] tracking-tight">Create account</h2>
          <p className="text-gray-500 text-sm mt-1">Step 1 of 3 · Your login details</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <Input label="First name" placeholder="Alexander" value={firstName} autoComplete="given-name" onCanvas
              onChange={e => { setFirstName(e.target.value); clear('firstName') }} error={errors.firstName} />
            <Input label="Last name" placeholder="Hartwell" value={lastName} autoComplete="family-name" onCanvas
              onChange={e => { setLastName(e.target.value); clear('lastName') }} error={errors.lastName} />
          </div>
          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => { setEmail(e.target.value); clear('email') }}
            error={errors.email}
            autoComplete="email"
            inputMode="email"
            onCanvas
          />
          <PhoneInput
            label="Mobile phone"
            value={phone}
            onChange={v => { setPhone(v); clear('phone') }}
            error={errors.phone}
            autoComplete="tel"
            onCanvas
          />

          <div className="flex flex-col gap-2">
            <PasswordInput
              label="Password"
              placeholder="At least 8 characters"
              value={password}
              onChange={e => { setPassword(e.target.value); clear('password') }}
              error={errors.password}
              autoComplete="new-password"
              onCanvas
            />
            {password && !errors.password && (
              <div className="flex items-center gap-3">
                <div className="flex-1 flex gap-1">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className={`h-1.5 flex-1 rounded-full ${i < strength ? STRENGTH_BAR[strength] : 'bg-black/[0.08]'}`} />
                  ))}
                </div>
                <span className="text-[11px] font-semibold text-gray-500 w-16 text-right">{STRENGTH_LABEL[strength]}</span>
              </div>
            )}
          </div>

          <PasswordInput
            label="Confirm password"
            placeholder="Re-enter your password"
            value={confirm}
            onChange={e => { setConfirm(e.target.value); clear('confirm') }}
            error={errors.confirm}
            autoComplete="new-password"
            onCanvas
          />

          <label className={`flex items-start gap-3 rounded-2xl px-4 py-3 ${errors.terms ? 'bg-rose-50 ring-1 ring-rose-200' : 'bg-white shadow-card'}`}>
            <input type="checkbox" checked={terms} onChange={e => { setTerms(e.target.checked); clear('terms') }} className="mt-0.5 w-5 h-5 accent-[#0c1a12]" />
            <span className="text-[13px] text-gray-600 leading-relaxed">
              I agree to the <span className="font-semibold text-ink">Terms of Service</span> and <span className="font-semibold text-ink">Privacy Policy</span>
              {errors.terms && <span className="block text-rose-600 text-[12px] font-semibold mt-0.5" role="alert">{errors.terms}</span>}
            </span>
          </label>
          <label className="flex items-start gap-3 rounded-2xl px-4 py-3 bg-white shadow-card">
            <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} className="mt-0.5 w-5 h-5 accent-[#0c1a12]" />
            <span className="text-[13px] text-gray-600 leading-relaxed">
              Send me news about tournaments and offers
              <span className="block text-[11px] text-gray-400">Optional · unsubscribe any time</span>
            </span>
          </label>

          <Button type="submit" fullWidth size="lg" loading={loading} className="mt-2">
            {loading ? 'Creating account…' : 'Continue'}
          </Button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{' '}
          <button
            type="button"
            onClick={onBack}
            className="text-ink font-semibold font-display underline underline-offset-4 decoration-lime-500 decoration-2 active:opacity-60"
          >
            Sign in
          </button>
        </p>
      </div>

    </div>
  )
}
