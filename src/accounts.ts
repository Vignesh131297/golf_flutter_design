import { MOCK_PROFILE, MOCK_TOURNAMENTS } from './data'
import { assignmentsFor, authenticateStaff, type StaffRole } from './ops'
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

const CONSOLE_ACCOUNTS: { email: string; password: string; account: Account }[] = [
  { email: 'admin@gmail.com', password: 'admin', account: { kind: 'admin', email: 'admin@gmail.com', name: 'Administrator' } },
  { email: 'dana@augustapines.com', password: 'augusta', account: { kind: 'organiser', email: 'dana@augustapines.com', name: 'Dana Whitfield', orgName: 'Augusta Pines Golf Club', organizerId: 'o-augusta' } },
  { email: 'owner@savannahgolf.com', password: 'savannah', account: { kind: 'organiser', email: 'owner@savannahgolf.com', name: 'Grace Whitfield', orgName: 'Savannah Golf Club', organizerId: 'o-savannah' } },
]

/** 'invalid' = known account, wrong password. Anyone else signs in as the demo golfer. */
export function resolveAccount(email: string, password: string): Account | 'invalid' {
  const key = email.trim().toLowerCase()
  const consoleAccount = CONSOLE_ACCOUNTS.find(a => a.email === key)
  if (consoleAccount) return consoleAccount.password === password ? consoleAccount.account : 'invalid'
  const staff = authenticateStaff(key, password)
  if (staff.ok) return { kind: 'staff', email: staff.email, name: staff.name }
  if (staff.reason === 'invalid') return 'invalid'
  return { kind: 'golfer' }
}

/** The golfer's own marshal / official duties (one account, several roles) */
export const golferDuties = () => assignmentsFor(MOCK_PROFILE.email).filter(a => a.window !== 'ended')

/** The organiser's tournament for the phone: the one that's live, else the next one */
export function organiserTournament(organizerId: string): Tournament | undefined {
  const mine = MOCK_TOURNAMENTS.filter(t => t.organizerId === organizerId && t.status !== 'draft')
  return mine.find(t => t.status === 'in-progress') ?? mine.filter(t => t.status !== 'completed' && t.status !== 'cancelled').sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
}

export type RoleKind = StaffRole | 'organiser'
