import { useState, type FormEvent, type ReactNode } from 'react'
import type { SharedNavProps } from '../types'
import { Button, Input, SelectField, ChoiceChips, PhoneInput, ProfilePhotoPicker, TopAppBar, fieldClass } from '../components'
import { MOCK_PROFILE, MOCK_COURSES } from '../data'
import {
  COUNTRIES, GENDERS, ISSUING_BODIES, RELATIONSHIPS, CONTACT_METHODS, DIETARY, TEE_OPTIONS, JUNIOR_UNDER,
  SHIRT_SIZES, GLOVE_SIZES, GLOVE_HANDS,
  draftFromProfile, validateProfileEdit, profilePatch, needsRatingsChoice, toggleDietary, ageOn,
  type GolferDraft, type Identity, type Errors,
} from '../account-rules'

/*
 * Edit profile: the same fields and rules as golfer sign-up (Docs/REGISTER GOLFER.txt).
 * Rules are shared with the web prototype in account-rules.ts.
 */

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

export default function EditProfile({ pop, showToast }: SharedNavProps) {
  const p = MOCK_PROFILE
  const [who, setWho] = useState<Identity>({ firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone })
  const [d, setD] = useState<GolferDraft>(() => draftFromProfile(p))
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [photo, setPhoto] = useState(p.photoUrl)

  const setIdentity = (k: keyof Identity, v: string) => { setWho(x => ({ ...x, [k]: v })); if (errors[k]) setErrors(x => ({ ...x, [k]: undefined })) }
  const set = <K extends keyof GolferDraft>(k: K, v: GolferDraft[K]) => { setD(x => ({ ...x, [k]: v })); if (errors[k]) setErrors(x => ({ ...x, [k]: undefined })) }

  const errorCount = Object.values(errors).filter(Boolean).length
  const emailChanged = who.email.trim().toLowerCase() !== p.email.toLowerCase()
  const age = d.dob ? ageOn(d.dob) : undefined

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault()
    const errs = validateProfileEdit(who, d)
    setErrors(errs)
    if (Object.values(errs).some(Boolean)) return
    setSaving(true)
    setTimeout(() => {
      Object.assign(MOCK_PROFILE, profilePatch(who, d, p), { photoUrl: photo })
      setSaving(false)
      showToast(emailChanged ? `Saved — enter the code we sent to ${who.email.trim()} to verify it` : 'Profile updated successfully', 'success')
      pop()
    }, 1200)
  }

  return (
    <div className="h-full flex flex-col bg-canvas">
      <TopAppBar title="Edit profile" onBack={pop} />

      <div className="flex-1 overflow-y-auto no-scrollbar smooth-scroll">
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-5 pt-2 pb-8 space-y-5">
            <div className="flex flex-col items-center gap-2 py-2">
              <ProfilePhotoPicker initials={`${who.firstName[0] ?? ''}${who.lastName[0] ?? ''}`.toUpperCase() || p.avatarInitials} photo={photo} onChange={setPhoto} />
              <p className="text-[12px] text-gray-400 text-center px-6">Your email, phone, date of birth and address are never shown to other golfers.</p>
            </div>

            <FormCard title="Personal information">
              <div className="grid grid-cols-2 gap-3">
                <Input label="First name *" value={who.firstName} onChange={e => setIdentity('firstName', e.target.value)} error={errors.firstName} autoComplete="given-name" />
                <Input label="Last name *" value={who.lastName} onChange={e => setIdentity('lastName', e.target.value)} error={errors.lastName} autoComplete="family-name" />
              </div>
              <Input label="Email address *" type="email" inputMode="email" value={who.email} onChange={e => setIdentity('email', e.target.value)} error={errors.email} autoComplete="email"
                hint={emailChanged ? "You'll need to verify the new address before registering for tournaments" : undefined} />
              <PhoneInput label="Mobile phone *" value={who.phone} onChange={v => setIdentity('phone', v)} error={errors.phone} preferCountry={d.country} autoComplete="tel" />
              <div className="flex flex-col gap-1.5">
                <label htmlFor="dob" className="text-[13px] font-semibold text-gray-600 font-display">Date of birth *</label>
                <input id="dob" type="date" value={d.dob} onChange={e => set('dob', e.target.value)} max={new Date().toISOString().split('T')[0]} className={fieldClass(!!errors.dob)} />
                {errors.dob ? <p className="text-xs text-red-500 font-medium">{errors.dob}</p>
                  : age !== undefined && age < JUNIOR_UNDER && <p className="text-[12px] text-pine-600 font-semibold">Junior</p>}
              </div>
              <ChoiceChips label="Gender *" options={GENDERS} value={d.gender} onChange={v => { set('gender', v as string); if (!needsRatingsChoice(v as string)) set('ratingsGender', '') }} error={errors.gender} />
              {needsRatingsChoice(d.gender) && (
                <ChoiceChips label="Handicap ratings to use *" options={[{ value: 'men', label: "Men's ratings" }, { value: 'women', label: "Women's ratings" }]}
                  value={d.ratingsGender} onChange={v => set('ratingsGender', v as 'men' | 'women')} error={errors.ratingsGender} />
              )}
            </FormCard>

            <FormCard title="Address" hint="Postal code and country are required; the rest is optional">
              <Input label="Street address" value={d.street} onChange={e => set('street', e.target.value)} autoComplete="street-address" />
              <div className="grid grid-cols-2 gap-3">
                <Input label="City" value={d.city} onChange={e => set('city', e.target.value)} autoComplete="address-level2" />
                <Input label="Province / state" value={d.region} onChange={e => set('region', e.target.value)} autoComplete="address-level1" />
              </div>
              <Input label="Postal / ZIP code *" value={d.postalCode} onChange={e => set('postalCode', e.target.value.toUpperCase())} error={errors.postalCode} autoComplete="postal-code" />
              <SelectField label="Country *" value={d.country} onChange={v => { set('country', v); setErrors(x => ({ ...x, postalCode: undefined })) }} options={COUNTRIES} error={errors.country} />
            </FormCard>

            <FormCard title="Golfer information">
              <ChoiceChips label="Do you have a Handicap Index? *" options={[{ value: 'yes', label: 'Yes' }, { value: 'not-yet', label: 'Not yet' }]}
                value={d.hasHandicap} onChange={v => set('hasHandicap', v as GolferDraft['hasHandicap'])} error={errors.hasHandicap} />
              {d.hasHandicap === 'yes' && (
                <>
                  <Input label="Handicap Index *" placeholder="e.g. 12.4 or +2.0" inputMode="decimal" value={d.handicap} onChange={e => set('handicap', e.target.value)} error={errors.handicap} hint="Plus handicaps start with +" />
                  <SelectField label="Issuing body *" placeholder="Select" value={d.body} onChange={v => set('body', v)} options={ISSUING_BODIES} error={errors.body} />
                  <Input label="Member / handicap number" value={d.memberNo} onChange={e => set('memberNo', e.target.value)} placeholder="Optional" />
                </>
              )}
              <Input label="Home club / home course" value={d.homeClub} onChange={e => set('homeClub', e.target.value)} placeholder="Optional — start typing" list="home-courses" />
              <datalist id="home-courses">{MOCK_COURSES.map(c => <option key={c.id} value={c.name} />)}</datalist>
              <ChoiceChips label="Club membership" options={['Member', 'Guest']} value={d.membership} onChange={v => set('membership', v as 'Member' | 'Guest')} />
              <ChoiceChips label="Preferred tee" options={TEE_OPTIONS} value={d.tee} onChange={v => set('tee', v as string)} hint="Optional — each tournament sets the tees" />
            </FormCard>

            <FormCard title="Player pack" hint="Optional · sizes for the tournament shirt and glove">
                <ChoiceChips label="Shirt / apparel size" options={SHIRT_SIZES} value={d.shirt} onChange={v => set('shirt', d.shirt === v ? '' : v as string)} />
                <ChoiceChips label="Glove size" options={GLOVE_SIZES} value={d.glove} onChange={v => set('glove', d.glove === v ? '' : v as string)} />
                <ChoiceChips label="Glove hand" options={GLOVE_HANDS} value={d.gloveHand} onChange={v => set('gloveHand', d.gloveHand === v ? '' : v as GolferDraft['gloveHand'])}
                  hint="Right-handed golfers usually wear a left-hand glove" />
            </FormCard>

            <FormCard title="Preferences">
              <ChoiceChips label="Preferred contact method *" options={[...CONTACT_METHODS]} value={d.contact} onChange={v => set('contact', v as GolferDraft['contact'])} error={errors.contact} />
              <ChoiceChips label="Dietary requirements" options={DIETARY} value={d.dietary} onChange={v => set('dietary', toggleDietary(d.dietary, v as string[]))} error={errors.dietary} hint="Select all that apply" />
              <Input label="Anything else?" placeholder="Allergies or other requirements" value={d.dietaryNote} onChange={e => set('dietaryNote', e.target.value)} />
            </FormCard>

            <FormCard title="Emergency contact">
              <Input label="Name *" value={d.ecName} onChange={e => set('ecName', e.target.value)} error={errors.ecName} />
              <PhoneInput label="Phone *" value={d.ecPhone} onChange={v => set('ecPhone', v)} error={errors.ecPhone} preferCountry={d.country} />
              <SelectField label="Relationship" placeholder="Optional" value={d.ecRelationship} onChange={v => set('ecRelationship', v)} options={RELATIONSHIPS} />
            </FormCard>

            {errorCount > 0 && (
              <p className="text-sm text-rose-600 font-medium bg-rose-50 rounded-2xl px-4 py-3 fade-in" role="alert">Please fix {errorCount} error{errorCount > 1 ? 's' : ''} above</p>
            )}
          </div>
        </form>
      </div>

      <div className="flex-shrink-0 bg-white px-5 pt-3 pb-3 border-t border-black/[0.05]">
        <div className="flex gap-2.5">
          <Button variant="secondary" onClick={pop} className="flex-shrink-0">Cancel</Button>
          <Button variant="primary" fullWidth loading={saving} onClick={() => handleSubmit()}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </div>
    </div>
  )
}
