import { MOCK_PROFILE, MOCK_TOURNAMENTS } from './data'
import { assignmentsFor, authenticateAccount, authenticateStaff, registerAccounts, type StaffRole } from './ops'
import { becomeGolfer, golferPassword, setGolferPassword } from './golfers'
import type { Tournament } from './types'

/*
 * One sign-in for every role (same rule as the web prototype): the account decides which tabs the app
 * shows. Console accounts mirror the web demo logins; marshal and official logins come from ops.ts.
 */

export type Account =
  | { kind: 'golfer' }
  | { kind: 'staff'; email: string; name: string }
  | { kind: 'organiser'; email: string; name: string; orgName: string; organizerId: string }
  | { kind: 'admin'; email: string; name: string }

const admin = (email: string, name: string): Account => ({ kind: 'admin', email, name })
const organiser = (email: string, name: string, orgName: string, organizerId: string): Account => ({ kind: 'organiser', email, name, orgName, organizerId })

const CONSOLE_ACCOUNTS: { email: string; password: string; account: Account; inactive?: boolean }[] = [
  { email: 'admin@gmail.com', password: 'admin', account: admin('admin@gmail.com', 'Administrator') },
  { email: 'director@gmail.com', password: 'director', account: admin('director@gmail.com', 'Priya Raman') },
  { email: 'courses@gmail.com', password: 'courses', account: admin('courses@gmail.com', 'Marcus Lee') },
  { email: 'desk@gmail.com', password: 'desk', account: admin('desk@gmail.com', 'Hannah Cole') },
  { email: 'tom@gmail.com', password: 'tom', account: admin('tom@gmail.com', 'Tom Baker'), inactive: true },
  { email: 'dana@augustapines.com', password: 'augusta', account: organiser('dana@augustapines.com', 'Dana Whitfield', 'Augusta Pines Golf Club', 'o-augusta') },
  { email: 'owner@savannahgolf.com', password: 'savannah', account: organiser('owner@savannahgolf.com', 'Grace Whitfield', 'Savannah Golf Club', 'o-savannah') },
  { email: 'leo@savannahgolf.com', password: 'leo', account: organiser('leo@savannahgolf.com', 'Leo Park', 'Savannah Golf Club', 'o-savannah') },
  { email: 'hello@coastalcharity.org', password: 'coastal', account: organiser('hello@coastalcharity.org', 'Nadia Brooks', 'Coastal Charity Golf', 'o-coastal') },
]

/** Passwords changed with forgot password (the web prototype keeps these on the account itself) */
const PASSWORDS_KEY = 'gtp-console-passwords-v1'

function changedPasswords(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(PASSWORDS_KEY) ?? '{}') } catch { return {} }
}

const consolePassword = (email: string) => {
  const account = CONSOLE_ACCOUNTS.find(a => a.email === email)
  return account ? changedPasswords()[email] ?? account.password : undefined
}

// Forgot password and the lock-out in ops.ts cover these accounts and golfers as well as marshals and officials
registerAccounts({
  password: email => consolePassword(email) ?? golferPassword(email),
  setPassword: (email, password) => {
    if (consolePassword(email) !== undefined) {
      try { localStorage.setItem(PASSWORDS_KEY, JSON.stringify({ ...changedPasswords(), [email]: password })) } catch { /* private mode: session only */ }
    } else setGolferPassword(email, password)
  },
})

/**
 * 'invalid' = wrong password or no such account. { message } = can't get in, and is told why (invite not finished,
 * locked, deactivated, off every tournament).
 */
export function resolveAccount(email: string, password: string): Account | 'invalid' | { message: string } {
  const key = email.trim().toLowerCase()
  const known = authenticateAccount(key, password)
  if (known.ok) {
    const consoleAccount = CONSOLE_ACCOUNTS.find(a => a.email === key)
    if (consoleAccount?.inactive) return { message: 'This admin account has been deactivated. Contact your administrator.' }
    if (consoleAccount) return consoleAccount.account
    becomeGolfer(key)
    return { kind: 'golfer' }
  }
  if (known.reason !== 'unknown') return known.message ? { message: known.message } : 'invalid'
  const staff = authenticateStaff(key, password)
  if (staff.ok) return { kind: 'staff', email: staff.email, name: staff.name }
  return staff.message ? { message: staff.message } : 'invalid'
}

/** The demo golfer also sits on the Augusta Pines committee: organisers often play in their own events (client, 21 Oct) */
export const golferOrganiserRole = () =>
  MOCK_PROFILE.email.trim().toLowerCase() === 'alex.hartwell@golfclub.com'
    ? { orgName: 'Augusta Pines Golf Club', organizerId: 'o-augusta' } : undefined

/** The golfer's own marshal / official duties (one account, several roles) */
export const golferDuties = () => assignmentsFor(MOCK_PROFILE.email).filter(a => a.window !== 'ended')

/** The organiser's tournament for the phone: the one that's live, else the next one */
export function organiserTournament(organizerId: string): Tournament | undefined {
  const mine = MOCK_TOURNAMENTS.filter(t => t.organizerId === organizerId && t.status !== 'draft')
  return mine.find(t => t.status === 'in-progress') ?? mine.filter(t => t.status !== 'completed' && t.status !== 'cancelled').sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
}

export type RoleKind = StaffRole | 'organiser'
