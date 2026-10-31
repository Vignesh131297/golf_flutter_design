import { handicapText, headlineStat, gloveText } from '../account-rules'
import { useState, useEffect } from 'react'
import type { SharedNavProps } from '../types'
import {
  Avatar, SkeletonRow, ErrorState,
  IconEdit, IconSignOut, IconChevronRight, VerifiedTick,
} from '../components'
import { MOCK_PROFILE } from '../data'
import { golferDuties, golferOrganiserRole } from '../accounts'
import { HandicapCheck, IdentityUpload, idStatus } from '../verification'
import { activeCoupons } from '../rewards'
import { CouponCard } from '../payments'
import { STAFF_ROLE_LABEL } from '../ops'

interface ProfileProps extends SharedNavProps {
  onSignOut: () => void
  /** Opens a tournament where this golfer is also a marshal or official */
  onSwitchRole?: (tournamentId: string) => void
  /** Opens the organiser view for a golfer who also runs tournaments */
  onSwitchToOrganiser?: () => void
}

type LoadState = 'loading' | 'loaded' | 'error'

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-3.5 gap-4">
      <span className="text-[14px] text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-[14px] font-semibold text-ink text-right truncate">{value}</span>
    </div>
  )
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div>
      {title && <p className="text-[13px] font-bold text-gray-500 font-display px-1 mb-2">{title}</p>}
      <div className="bg-white rounded-3xl shadow-card overflow-hidden">{children}</div>
    </div>
  )
}

function ActionRow({ icon, label, sublabel, onClick, variant = 'default' }: {
  icon: React.ReactNode
  label: string
  sublabel?: string
  onClick: () => void
  variant?: 'default' | 'danger'
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3.5 px-4 py-3.5 transition-colors ${
        variant === 'danger' ? 'active:bg-rose-50' : 'active:bg-canvas'
      }`}
    >
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
        variant === 'danger' ? 'bg-rose-50' : 'bg-canvas'
      }`}>
        {icon}
      </div>
      <div className="flex-1 text-left">
        <p className={`text-[15px] font-semibold font-display tracking-tight ${
          variant === 'danger' ? 'text-rose-600' : 'text-ink'
        }`}>{label}</p>
        {sublabel && <p className="text-xs text-gray-400 mt-0.5">{sublabel}</p>}
      </div>
      <IconChevronRight />
    </button>
  )
}

export default function Profile({ push, showToast, onSignOut, onSwitchRole, onSwitchToOrganiser }: ProfileProps) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [, refresh] = useState(0)
  const profile = MOCK_PROFILE
  const organiser = golferOrganiserRole()

  useEffect(() => {
    const id = setTimeout(() => setLoadState('loaded'), 900)
    return () => clearTimeout(id)
  }, [])

  if (loadState === 'loading') {
    return (
      <div className="h-full overflow-y-auto no-scrollbar bg-canvas px-5 pt-3 space-y-4">
        <div className="h-64 skeleton rounded-[32px]" />
        <div className="bg-white rounded-3xl p-4">
          {[1,2,3,4].map(i => <SkeletonRow key={i} />)}
        </div>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <ErrorState
        title="Failed to load profile"
        message="We couldn't retrieve your profile. Please try again."
        onRetry={() => {
          setLoadState('loading')
          setTimeout(() => setLoadState('loaded'), 1000)
        }}
      />
    )
  }

  const fullName = `${profile.firstName} ${profile.lastName}`
  const formattedDob = new Date(profile.dob).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
  const memberYears = new Date().getFullYear() - parseInt(profile.memberSince.split(' ')[1])

  return (
    <div className="h-full overflow-y-auto no-scrollbar smooth-scroll bg-canvas">
      <div className="px-5 pt-3 pb-8 space-y-6">

        {/* Profile header card */}
        <div className="bg-ink rounded-[32px] p-5 shadow-float relative overflow-hidden">
          <div
            className="absolute -left-12 -top-16 w-52 h-52 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(200,236,90,0.22) 0%, rgba(200,236,90,0) 70%)' }}
          />

          <div className="relative flex items-start justify-between">
            <Avatar initials={profile.avatarInitials} photo={profile.photoUrl} size="lg" ring />
            <button
              onClick={() => push('edit-profile')}
              className="flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-white/10 border border-white/15 active:bg-white/20 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
                <path d="M12.5 2.5l3 3L5 16H2v-3L12.5 2.5z" stroke="#ffffff" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <span className="text-white text-[12px] font-semibold font-display">Edit</span>
            </button>
          </div>

          <h1 className="relative font-display font-extrabold text-white text-[24px] tracking-tight mt-4 flex items-center gap-2">{fullName}{idStatus(profile.idCheck) === 'verified' && <VerifiedTick kind="id" size={20} />}</h1>
          <p className="relative text-white/55 text-sm">
            {memberYears > 0 ? `Member for ${memberYears} year${memberYears > 1 ? 's' : ''}` : 'New member'}
            {profile.city ? ` · ${profile.city}` : profile.homeClub ? ` · ${profile.homeClub}` : ''}
          </p>

          {/* Stats */}
          <div className="relative grid grid-cols-3 gap-2 mt-5">
            <div className="bg-lime-400 rounded-2xl p-3">
              <p className="font-display font-extrabold text-ink text-[20px] leading-none tracking-tight">{handicapText(profile)}</p>
              <p className="text-pine-800 text-[11px] font-semibold mt-1.5 flex items-center gap-1">Handicap{profile.handicapVerified && <VerifiedTick kind="handicap" size={12} />}</p>
            </div>
            <div className="bg-white/[0.08] rounded-2xl p-3">
              <p className="font-display font-extrabold text-white text-[20px] leading-none tracking-tight">{profile.tournamentsPlayed}</p>
              <p className="text-white/55 text-[11px] font-semibold mt-1.5">Played</p>
            </div>
            <div className="bg-white/[0.08] rounded-2xl p-3">
              <p className="font-display font-extrabold text-white text-[20px] leading-none tracking-tight">{headlineStat(profile).value}</p>
              <p className="text-white/55 text-[11px] font-semibold mt-1.5">{headlineStat(profile).label}</p>
            </div>
          </div>
        </div>

        {/* One account, several roles */}
        {((onSwitchRole && golferDuties().length > 0) || (onSwitchToOrganiser && organiser)) && (
          <Group title="Your other roles">
            {onSwitchToOrganiser && organiser && (
              <ActionRow icon={<span className="text-[16px]">⇄</span>} label={`Organiser · ${organiser.orgName}`}
                sublabel="Today’s field, cards and disputes" onClick={onSwitchToOrganiser} />
            )}
            {onSwitchRole && golferDuties().map(a => (
              <ActionRow key={a.tournament.id} icon={<span className="text-[16px]">⇄</span>}
                label={`${STAFF_ROLE_LABEL[a.role]} · ${a.tournament.name}`}
                sublabel={a.window === 'live' ? 'Live now — open the console' : `${a.tournament.dateRange} · tee sheet and contacts`}
                onClick={() => onSwitchRole(a.tournament.id)} />
            ))}
          </Group>
        )}

        <div>
          <h2 className="font-display font-bold text-ink text-[17px] tracking-tight mb-1">Verification</h2>
          <p className="text-[12px] text-gray-500 mb-3">Ticks show next to your name and handicap in every tournament.</p>
          <div className="space-y-3">
            <IdentityUpload card value={profile.idCheck} onChange={v => {
              profile.idCheck = v; refresh(n => n + 1)
              if (v?.status === 'checking') showToast('ID uploaded — checking it now', 'info')
              else if (v?.status === 'verified') showToast('ID verified — you now have the blue tick')
            }} />
            {profile.hasHandicap !== false && (
              <div className="rounded-2xl bg-white shadow-card p-4">
                <p className="font-display font-bold text-ink text-[15px] flex items-center gap-2"><VerifiedTick kind="handicap" size={18} /> Verify your handicap</p>
                <p className="text-[12px] text-gray-500 mt-0.5 mb-3">We confirm your index with {profile.handicapBody || 'Golf Canada'}.</p>
                <HandicapCheck profile={profile} onVerified={() => { profile.handicapVerified = true; refresh(n => n + 1); showToast(`Handicap verified with ${profile.handicapBody || 'Golf Canada'}`) }} />
              </div>
            )}
          </div>
        </div>

        {activeCoupons().length > 0 && (
          <div>
            <h2 className="font-display font-bold text-ink text-[17px] tracking-tight mb-1">Your rewards</h2>
            <p className="text-[12px] text-gray-500 mb-3">Every payment earns a discount at our golf shop.</p>
            <div className="space-y-3">{activeCoupons().map(c => <CouponCard key={c.code} coupon={c} />)}</div>
          </div>
        )}

        <Group title="Personal information">
          <div className="px-4 divide-y divide-black/[0.05]">
            <InfoItem label="Full name" value={fullName} />
            <InfoItem label="Email" value={profile.email} />
            <InfoItem label="Phone" value={profile.phone} />
            <InfoItem label="Date of birth" value={formattedDob} />
            <InfoItem label="Gender" value={profile.gender} />
            {(profile.street || profile.city || profile.postalCode) && <InfoItem label="Address" value={[profile.street, profile.city, profile.region, profile.postalCode].filter(Boolean).join(', ')} />}
            {profile.country && <InfoItem label="Country" value={profile.country} />}
            <InfoItem label="Email verified" value={profile.emailVerified === false ? 'Not yet' : 'Yes'} />
          </div>
        </Group>

        <Group title="Golfer information">
          <div className="px-4 divide-y divide-black/[0.05]">
            <InfoItem label="Handicap index" value={profile.hasHandicap === false ? 'Not yet' : `${handicapText(profile)} (WHS)`} />
            {profile.handicapBody && <InfoItem label="Issuing body" value={profile.handicapBody} />}
            {profile.handicapNumber && <InfoItem label="Member number" value={profile.handicapNumber} />}
            {profile.homeClub && <InfoItem label="Home club" value={profile.homeClub} />}
            {profile.preferredTee && <InfoItem label="Preferred tee" value={profile.preferredTee} />}
            <InfoItem label="Status" value={profile.membership} />
            <InfoItem label="Member since" value={profile.memberSince} />
            <InfoItem label="Tournaments played" value={profile.tournamentsPlayed.toString()} />
            <InfoItem label={headlineStat(profile).label} value={headlineStat(profile).value} />
          </div>
        </Group>

        <Group title="Event preferences">
          <div className="px-4 divide-y divide-black/[0.05]">
            <InfoItem label="Preferred contact" value={profile.preferredContact ?? 'Email'} />
            <InfoItem label="Dietary" value={[...profile.dietary, profile.dietaryNote].filter(Boolean).join(', ') || 'None'} />
            {profile.shirtSize && <InfoItem label="Shirt size" value={profile.shirtSize} />}
            {profile.gloveSize || profile.gloveHand ? <InfoItem label="Glove" value={gloveText(profile.gloveSize, profile.gloveHand)} /> : null}
          </div>
        </Group>

        <Group title="Emergency contact">
          <div className="px-4 divide-y divide-black/[0.05]">
            <InfoItem label="Name" value={profile.emergencyContactName} />
            <InfoItem label="Phone" value={profile.emergencyContactPhone} />
            {profile.emergencyContactRelationship && <InfoItem label="Relationship" value={profile.emergencyContactRelationship} />}
          </div>
        </Group>

        <Group>
          <div className="divide-y divide-black/[0.05]">
            <ActionRow
              icon={<IconEdit />}
              label="Edit profile"
              sublabel="Update your personal details"
              onClick={() => push('edit-profile')}
            />
            <ActionRow
              icon={
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="9" r="2.5" stroke="#1a3a2a" strokeWidth="1.4"/>
                  <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" stroke="#1a3a2a" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
              }
              label="Settings"
              sublabel="Notifications, privacy, security"
              onClick={() => showToast('Settings coming soon', 'info')}
            />
            <ActionRow
              icon={<IconSignOut />}
              label="Sign out"
              sublabel="Sign out of your account"
              onClick={onSignOut}
              variant="danger"
            />
          </div>
        </Group>

        <p className="text-center text-[11px] text-gray-400 font-display">GTP v1.0 · Sprint 1</p>
      </div>
    </div>
  )
}
