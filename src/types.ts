export type ScreenName =
  | 'signin'
  | 'home'
  | 'tournaments'
  | 'tournament-details'
  | 'course-details'
  | 'leaderboard'
  | 'live-play'
  | 'profile'
  | 'edit-profile'
  | 'play'
  /* Marshal, official and organiser tabs */
  | 'pace'
  | 'issues'
  | 'cards'
  | 'tee-sheet'
  | 'today'
  | 'staff-profile'
  | 'web-only'

export interface NavEntry {
  screen: ScreenName
  params?: Record<string, string>
  direction?: 'push' | 'pop'
}

export interface ToastData {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export interface DialogData {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel?: () => void
}

export type TournamentStatus =
  /** Organisers' unpublished set-up (web console only; never shown to golfers) */
  | 'draft'
  | 'published'
  | 'registration-open'
  | 'registration-closed'
  | 'upcoming'
  | 'in-progress'
  | 'completed'
  | 'cancelled'

export type RegistrationStatus = 'open' | 'closed' | 'coming-soon' | 'registered'

export type TournamentFormat = 'Stroke Play' | 'Stableford' | 'Four-Ball' | 'Scramble'

export interface Tournament {
  id: string
  name: string
  dateRange: string
  startDate: string
  endDate?: string
  time: string
  venue: string
  location: string
  city: string
  country: string
  status: TournamentStatus
  format: TournamentFormat
  category: string
  description: string
  courseId: string
  registrationStatus: RegistrationStatus
  players: number
  maxPlayers: number
  entryFee: string
  prize: string
  imageUrl: string

  /* ── Full tournament set-up (optional so older saved data still loads) ── */
  rounds?: TournamentRound[]
  scoring?: ScoringRules
  eligibility?: Eligibility
  divisions?: Division[]
  registration?: RegistrationWindow
  fees?: TournamentFees
  prizes?: Prize[]
  teeSheet?: TeeSheetSettings
  officials?: Official[]
  contactEmail?: string
  contactPhone?: string
  localRules?: string
  /** Final results are visible to golfers */
  resultsPublished?: boolean
  /** Organisation that runs it (matches the web prototype's organisations) */
  organizerId?: string
  /** Target round time and how far behind a group can fall before it's flagged */
  pace?: { targetMinutes: number; flagMinutes: number }
}

export interface TournamentRound {
  number: number
  date: string
  /** Which holes the round is played over */
  holes: 'all' | 'front' | 'back'
}

export type ScoringBasis = 'gross' | 'net' | 'gross-and-net'
export type TieBreak = 'countback' | 'playoff' | 'shared'

export interface ScoringRules {
  basis: ScoringBasis
  /** Handicap allowance applied to course handicap, e.g. 95 */
  allowancePct: number
  /** Highest handicap index accepted for net scoring */
  maxHandicap: number
  tieBreak: TieBreak
  /** Cut after this round (0 = no cut) */
  cutAfterRound: number
  /** Number of players (and ties) who make the cut */
  cutSize: number
}

export interface Eligibility {
  minHandicap?: number
  maxHandicap?: number
  minAge?: number
  maxAge?: number
  gender: 'open' | 'men' | 'women'
  membersOnly: boolean
  officialHandicapRequired: boolean
}

export interface Division {
  id: string
  name: string
  minHandicap: number
  maxHandicap: number
  /** Tee set (Course.teeSets[].id) this division plays from */
  teeSetId: string
}

export interface RegistrationWindow {
  /** ISO date-times (local) */
  opensAt: string
  closesAt: string
  waitlist: boolean
  withdrawBy: string
  refundPolicy: string
}

export interface TournamentFees {
  currency: string
  /** Standard entry */
  amount: number
  memberAmount?: number
  earlyBirdAmount?: number
  earlyBirdUntil?: string
  perTeam: boolean
  includes: string[]
}

export interface Prize {
  id: string
  label: string
  /** Division id, or empty for overall */
  divisionId?: string
  value: string
}

export interface TeeSheetSettings {
  startType: 'tee-times' | 'shotgun'
  /** "HH:MM" 24h */
  firstTeeTime: string
  intervalMinutes: number
  groupSize: 2 | 3 | 4
  /** Tee times off the 1st only, or the 1st and 10th */
  startingTees: 'first' | 'first-and-tenth'
}

export interface Official {
  name: string
  role: string
  phone: string
  /** Marshals and officials with an email get a login for this tournament only (see ops.ts) */
  email?: string
  /** When the organiser sent the login invitation */
  invitedAt?: string
}


export interface HoleData {
  hole: number
  par: number
  yards: number
  handicap: number
  /** Women's par / stroke index when they differ from the men's */
  parWomen?: number
  handicapWomen?: number
  name?: string
  notes?: string
  map?: HoleMap
  /** The course's own picture of the hole (from its website or scorecard); the drawn layout is used without it */
  imageUrl?: string
}

/**
 * Hole geometry in yards on a local grid: the tee sits at (0, 0) and +y points down the hole.
 * The real backend stores latitude/longitude per point; the prototype uses yards so it can
 * draw holes without map tiles. Distances are straight-line yards.
 */
export interface Point { x: number; y: number }

export interface HoleHazard {
  id: string
  type: 'bunker' | 'water' | 'trees'
  at: Point
  /** Radius in yards */
  size: number
}

export interface HoleMap {
  tee: Point
  /** Centre line from tee to green (dogleg points in between) */
  path: Point[]
  greenFront: Point
  greenCentre: Point
  greenBack: Point
  hazards: HoleHazard[]
}

export interface TeeSet {
  id: string
  name: string
  /** Tee marker colour (data, shown as a swatch) */
  color: string
  menRating?: number
  menSlope?: number
  womenRating?: number
  womenSlope?: number
  /** Yards per hole from these tees, in hole order */
  yards: number[]
}

export type CourseStatus = 'open' | 'closed' | 'maintenance'

export interface Course {
  id: string
  name: string
  imageUrl: string
  location: string
  address: string
  city: string
  region: string
  country: string
  description: string
  holes: number
  par: number
  yardage: number
  rating: number
  slope: number
  established: string
  designer: string
  tournamentId?: string
  holeData: HoleData[]
  /** The club's own scorecard as an image */
  scorecardImageUrl?: string
  /** Where the hole pictures come from, e.g. "Augusta Pines Golf Club scorecard" */
  holeImageSource?: string

  /* ── Full course details (optional so older saved data still loads) ── */
  geo?: { lat: number; lng: number }
  teeSets?: TeeSet[]
  phone?: string
  email?: string
  website?: string
  bookingUrl?: string
  facilities?: string[]
  dressCode?: string
  status?: CourseStatus
  statusNote?: string
}

export interface GolferProfile {
  firstName: string
  lastName: string
  email: string
  phone: string
  country: string
  city: string
  dob: string
  gender: string
  handicapIndex: number
  memberSince: string
  tournamentsPlayed: number
  wins: number
  avatarInitials: string
  emergencyContactName: string
  emergencyContactPhone: string
  handicapBody: string
  handicapNumber: string
  homeClub: string
  preferredTee: string
  dietary: string[]
  shirtSize: string
  gloveSize?: string
  /** Which hand the glove is for */
  gloveHand?: 'LH' | 'RH'
  /** Profile picture (a data URL in the prototype; an uploaded image URL in the real app) */
  photoUrl?: string
  membership: 'Member' | 'Guest'
  /* ── Registration (Docs/REGISTER GOLFER.txt) ── */
  /** Non-binary / prefer not to say: which tee ratings to use for course handicap */
  ratingsGender?: 'men' | 'women'
  street?: string
  region?: string
  postalCode?: string
  emergencyContactRelationship?: string
  /** false = "Not yet" (no Handicap Index) */
  hasHandicap?: boolean
  /** When the golfer last changed their Handicap Index */
  handicapUpdated?: string
  preferredContact?: string
  dietaryNote?: string
  marketingOptIn?: boolean
  /** Must be true before registering for tournaments */
  emailVerified?: boolean
}

/** What the sign-up + profile-setup flow collects before the account is created */
export interface NewAccount {
  fullName: string
  firstName?: string
  lastName?: string
  email: string
  phone: string
  dob: string
  gender: string
  ratingsGender?: 'men' | 'women'
  street?: string
  city?: string
  region?: string
  postalCode?: string
  country: string
  emergencyContactName: string
  emergencyContactPhone: string
  emergencyContactRelationship?: string
  hasHandicap: boolean
  /** Parsed Handicap Index as text ('' when "not yet"); plus handicaps are negative */
  handicapIndex: string
  handicapBody: string
  handicapNumber: string
  homeClub: string
  preferredTee: string
  membership: 'Member' | 'Guest'
  preferredContact: string
  dietary: string[]
  dietaryNote?: string
  shirtSize?: string
  gloveSize?: string
  gloveHand?: 'LH' | 'RH'
  marketingOptIn?: boolean
  emailVerified: boolean
}

export interface SharedNavProps {
  push: (screen: ScreenName, params?: Record<string, string>) => void
  pop: () => void
  showToast: (message: string, type?: ToastData['type']) => void
  showDialog: (dialog: DialogData) => void
  canGoBack: boolean
}
