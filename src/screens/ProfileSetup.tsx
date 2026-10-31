import { useState, type ReactNode } from 'react'
import { IdentityUpload, settledId, type IdCheck } from '../verification'
import type { NewAccount } from '../types'
import { Button, Input, SelectField, ChoiceChips, PhoneInput, RoundButton, IconBack, fieldClass } from '../components'
import type { AccountBasics } from './SignUp'
import { MOCK_COURSES } from '../data'
import {
  COUNTRIES, GENDERS, ISSUING_BODIES, RELATIONSHIPS, CONTACT_METHODS, DIETARY, TEE_OPTIONS, JUNIOR_UNDER,
  SHIRT_SIZES, GLOVE_SIZES, GLOVE_HANDS,
  emptyGolferDraft, validateGolferStep, needsRatingsChoice, toggleDietary, toNewAccount, ageOn,
  type GolferDraft, type GolferStep, type Errors,
} from '../account-rules'

/*
 * Golfer sign-up step 3: about you → your game → preferences (Docs/REGISTER GOLFER.txt).
 * Same fields and rules as the web profile setup (shared in account-rules.ts).
 */

interface ProfileSetupProps {
  basics: AccountBasics
  emailVerified: boolean
  onBack: () => void
  onComplete: (account: NewAccount) => void
}

const STEPS: { key: GolferStep; title: string; subtitle: string }[] = [
  { key: 'about', title: 'About you', subtitle: 'Personal details and who to contact in an emergency' },
  { key: 'game', title: 'Your game', subtitle: 'Handicap and where you usually play' },
  { key: 'prefs', title: 'Preferences', subtitle: 'How organisers contact you, your player pack and catering' },
]

function FormCard({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-3xl shadow-card overflow-hidden">
      <div className="px-4 pt-4">
        <p className="text-[16px] text-ink font-bold font-display tracking-tight">{title}</p>
        {hint && <p className="text-[12px] text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <div className="px-4 pt-3 pb-4 space-y-4">{children}</div>
    </div>
  )
}

function Pick<T extends string>({ value, onChange, options, error }: { value: T | ''; onChange: (v: T) => void; options: { value: T; title: string; body: string }[]; error?: string }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-2.5" role="radiogroup">
        {options.map(o => {
          const on = value === o.value
          return (
            <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
              className={`text-left rounded-2xl p-4 transition-all active:scale-[0.98] ${on ? 'bg-ink text-white' : `bg-canvas text-ink ${error ? 'ring-1 ring-red-300' : ''}`}`}>
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-[15px] tracking-tight">{o.title}</span>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center ${on ? 'bg-lime-400' : 'border-2 border-black/15'}`}>{on && <span className="w-2 h-2 rounded-full bg-ink" />}</span>
              </div>
              <p className={`text-[12px] mt-1.5 leading-snug ${on ? 'text-white/60' : 'text-gray-500'}`}>{o.body}</p>
            </button>
          )
        })}
      </div>
      {error && <p className="text-xs text-red-500 font-medium mt-1.5">{error}</p>}
    </div>
  )
}

export default function ProfileSetup({ basics, emailVerified, onBack, onComplete }: ProfileSetupProps) {
  const [step, setStep]     = useState(0)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [d, setD]           = useState<GolferDraft>(emptyGolferDraft)
  const [idCheck, setIdCheck] = useState<IdCheck | undefined>()

  const set = <K extends keyof GolferDraft>(k: K, v: GolferDraft[K]) => {
    setD(cur => ({ ...cur, [k]: v }))
    if (errors[k]) setErrors(x => ({ ...x, [k]: undefined }))
  }
  const key = STEPS[step].key
  const isLast = step === STEPS.length - 1
  const age = d.dob ? ageOn(d.dob) : undefined

  function next() {
    const errs = validateGolferStep(key, d)
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) return
    if (!isLast) { setStep(step + 1); return }
    setSaving(true)
    setTimeout(() => onComplete({ ...toNewAccount(basics, d, emailVerified), idCheck: settledId(idCheck) }), 1200)
  }

  function back() {
    setErrors({})
    if (step === 0) onBack()
    else setStep(step - 1)
  }

  const firstName = basics.firstName ?? basics.fullName.split(/\s+/)[0]

  return (
    <div className="h-full flex flex-col bg-canvas">
      <div className="flex-shrink-0 px-5 pt-2 pb-4">
        <div className="flex items-center justify-between">
          <RoundButton onClick={back} label="Back"><IconBack /></RoundButton>
          <span className="text-[12px] font-bold font-display text-gray-500">Step 3 of 3 · {step + 1}/{STEPS.length}</span>
        </div>
        <div className="flex gap-1.5 mt-4">
          {STEPS.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? 'bg-lime-500' : 'bg-black/[0.08]'}`} />)}
        </div>
        <p className="text-[13px] text-gray-500 font-medium mt-5">{step === 0 ? `Welcome, ${firstName} 👋` : 'Golfer profile'}</p>
        <h1 className="font-display font-extrabold text-ink text-[26px] leading-tight tracking-tight">{STEPS[step].title}</h1>
        <p className="text-sm text-gray-500 mt-1">{STEPS[step].subtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar smooth-scroll">
        <div key={step} className="px-5 pb-8 space-y-5 fade-in-up">
          {key === 'about' && (
            <>
              <FormCard title="Personal details">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="dob" className="text-[13px] font-semibold text-gray-600 font-display">Date of birth *</label>
                  <input id="dob" type="date" value={d.dob} onChange={e => set('dob', e.target.value)} max={new Date().toISOString().split('T')[0]}
                    className={`${fieldClass(!!errors.dob)} ${d.dob ? '' : 'text-gray-400'}`} />
                  {errors.dob ? <p className="text-xs text-red-500 font-medium">{errors.dob}</p>
                    : age !== undefined && age < JUNIOR_UNDER && age >= 13 && <p className="text-[12px] text-pine-600 font-semibold">You'll be registered as a Junior</p>}
                </div>
                <ChoiceChips label="Gender *" options={GENDERS} value={d.gender} onChange={v => { set('gender', v as string); if (!needsRatingsChoice(v as string)) set('ratingsGender', '') }} error={errors.gender} />
                {needsRatingsChoice(d.gender) && (
                  <ChoiceChips label="Handicap ratings to use *" options={[{ value: 'men', label: "Men's ratings" }, { value: 'women', label: "Women's ratings" }]}
                    value={d.ratingsGender} onChange={v => set('ratingsGender', v as 'men' | 'women')} error={errors.ratingsGender}
                    hint="Course handicaps use the men's or women's tee ratings" />
                )}
              </FormCard>
              <FormCard title="Address" hint="Postal code and country are required; the rest is optional">
                <Input label="Street address" placeholder="Optional" value={d.street} onChange={e => set('street', e.target.value)} autoComplete="street-address" />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="City" value={d.city} onChange={e => set('city', e.target.value)} autoComplete="address-level2" />
                  <Input label="Province / state" value={d.region} onChange={e => set('region', e.target.value)} autoComplete="address-level1" />
                </div>
                <Input label="Postal / ZIP code *" value={d.postalCode} onChange={e => set('postalCode', e.target.value.toUpperCase())} error={errors.postalCode} autoComplete="postal-code" />
                <SelectField label="Country *" value={d.country} onChange={v => { set('country', v); setErrors(x => ({ ...x, postalCode: undefined })) }} options={COUNTRIES} error={errors.country} />
              </FormCard>
              <FormCard title="Emergency contact">
                <Input label="Name *" placeholder="Full name" value={d.ecName} onChange={e => set('ecName', e.target.value)} error={errors.ecName} autoComplete="off" />
                <PhoneInput label="Phone *" value={d.ecPhone} onChange={v => set('ecPhone', v)} error={errors.ecPhone} preferCountry={d.country} autoComplete="off" />
                <SelectField label="Relationship" placeholder="Optional" value={d.ecRelationship} onChange={v => set('ecRelationship', v)} options={RELATIONSHIPS} />
              </FormCard>
            </>
          )}

          {key === 'game' && (
            <>
              <FormCard title="Handicap">
                <p className="text-[13px] font-semibold text-gray-600 font-display -mb-2">Do you have a Handicap Index? *</p>
                <Pick value={d.hasHandicap} onChange={v => set('hasHandicap', v)} error={errors.hasHandicap} options={[
                  { value: 'yes', title: 'Yes', body: 'Golf Canada, USGA or another body' },
                  { value: 'not-yet', title: 'Not yet', body: 'Add it later' },
                ]} />
                {d.hasHandicap === 'yes' && (
                  <>
                    <Input label="Handicap Index *" placeholder="e.g. 12.4 or +2.0" inputMode="decimal" value={d.handicap} onChange={e => set('handicap', e.target.value)} error={errors.handicap} hint="Plus handicaps start with +" />
                    <SelectField label="Issuing body *" placeholder="Select" value={d.body} onChange={v => set('body', v)} options={ISSUING_BODIES} error={errors.body} />
                    <Input label="Member / handicap number" placeholder="Optional" value={d.memberNo} onChange={e => set('memberNo', e.target.value)} />
                    <p className="text-[12px] text-gray-500">Update it before each tournament. It's locked a week before the start, and the organiser can adjust it.</p>
                  </>
                )}
                {d.hasHandicap === 'not-yet' && (
                  <p className="text-sm text-gray-500 bg-canvas rounded-2xl px-4 py-3 leading-relaxed">Tournaments that need an official handicap will tell you before you register.</p>
                )}
              </FormCard>
              <FormCard title="Where you play">
                <Input label="Home club / home course" placeholder="Optional — start typing" value={d.homeClub} onChange={e => set('homeClub', e.target.value)} list="home-courses" />
                <datalist id="home-courses">{MOCK_COURSES.map(c => <option key={c.id} value={c.name} />)}</datalist>
                <div>
                  <p className="text-[13px] font-semibold text-gray-600 font-display mb-1.5">Club membership</p>
                  <Pick value={d.membership} onChange={v => set('membership', v)} options={[
                    { value: 'Member', title: 'Member', body: 'I belong to a participating club' },
                    { value: 'Guest', title: 'Guest', body: 'Playing as a visitor' },
                  ]} />
                </div>
                <ChoiceChips label="Preferred tee" options={TEE_OPTIONS} value={d.tee} onChange={v => set('tee', v as string)} hint="Optional — each tournament sets the tees" />
              </FormCard>
            </>
          )}

          {key === 'prefs' && (
            <>
              <FormCard title="Contact">
                <ChoiceChips label="Preferred contact method *" options={[...CONTACT_METHODS]} value={d.contact}
                  onChange={v => set('contact', v as GolferDraft['contact'])} error={errors.contact} hint="How organisers reach you about your tournaments" />
              </FormCard>
              <FormCard title="Player pack" hint="Optional · sizes for the tournament shirt and glove">
                <ChoiceChips label="Shirt / apparel size" options={SHIRT_SIZES} value={d.shirt} onChange={v => set('shirt', d.shirt === v ? '' : v as string)} />
                <ChoiceChips label="Glove size" options={GLOVE_SIZES} value={d.glove} onChange={v => set('glove', d.glove === v ? '' : v as string)} />
                <ChoiceChips label="Glove hand" options={GLOVE_HANDS} value={d.gloveHand} onChange={v => set('gloveHand', d.gloveHand === v ? '' : v as GolferDraft['gloveHand'])}
                  hint="Right-handed golfers usually wear a left-hand glove" />
              </FormCard>
              <FormCard title="Identity" hint="Optional · get the verified tick">
                <IdentityUpload value={idCheck} onChange={setIdCheck} />
              </FormCard>
              <FormCard title="Catering" hint="Optional">
                <ChoiceChips label="Dietary requirements" options={DIETARY} value={d.dietary}
                  onChange={v => set('dietary', toggleDietary(d.dietary, v as string[]))} error={errors.dietary} hint="Select all that apply" />
                <Input label="Anything else?" placeholder="Allergies or other requirements" value={d.dietaryNote} onChange={e => set('dietaryNote', e.target.value)} />
              </FormCard>
              {!emailVerified && (
                <p className="text-[12px] text-amber-800 bg-amber-50 rounded-2xl px-4 py-3">Your email isn't verified yet. You can finish now, but you'll need to verify before registering for a tournament.</p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 bg-white px-5 pt-3 pb-4 border-t border-black/[0.05]">
        <div className="flex gap-2.5">
          {step > 0 && <Button variant="secondary" onClick={back} className="flex-shrink-0">Back</Button>}
          <Button fullWidth onClick={next} loading={saving}>{saving ? 'Setting up your profile…' : isLast ? 'Finish setup' : 'Continue'}</Button>
        </div>
      </div>
    </div>
  )
}
