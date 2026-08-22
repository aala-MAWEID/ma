/**
 * Salon Zaytouna, Casablanca. Three staff, six services, real opening hours,
 * a standing lunch break, and a handful of bookings including one pending
 * request so the owner dashboard has something to approve on first load.
 */

import type {
  Booking,
  ClosedDate,
  Customer,
  Service,
  Staff,
  StaffService,
  Tenant,
  TenantSettings,
  TimeOff,
  WorkingHour,
} from '@/types/domain'
import { DEFAULT_SETTINGS } from '@/config/constants'
import { addDaysToKey, dayKeyToUtc, dayKeyOf, addMinutes } from '@/lib/time'

const TZ = 'Africa/Casablanca'
export const TENANT_ID = 't-zaytouna'

export const tenant: Tenant = {
  id: TENANT_ID,
  slug: 'zaytouna',
  name: 'صالون الزيتونة',
  nameFr: 'Salon Zaytouna',
  tagline: 'حلاقة وعناية · الدار البيضاء',
  taglineFr: 'Coiffure & soins · Casablanca',
  timeZone: TZ,
  currency: 'MAD',
  phone: '+212522334455',
  whatsapp: '212612806932',
  email: 'contact@zaytouna.ma',
  address: 'شارع محمد الخامس 123',
  addressLine: 'شارع محمد الخامس 123',
  city: 'الدار البيضاء',
  lat: 33.5731,
  lng: -7.5898,
  brandColor: '#0E7C86',
  defaultLocale: 'ar',
  locales: ['ar', 'fr'],
  isPublished: true,
}

export const settings: TenantSettings = {
  ...DEFAULT_SETTINGS,
  autoConfirm: false,
  maxAdvanceDays: 45,
  minNoticeMin: 120,
}

export const staff: Staff[] = [
  { id: 'st-amine',  tenantId: TENANT_ID, displayName: 'أمين',   title: 'حلاق أول',    titleFr: 'Coiffeur senior', color: '#0E7C86', isActive: true, sortOrder: 1 },
  { id: 'st-yasmin', tenantId: TENANT_ID, displayName: 'ياسمين', title: 'خبيرة صباغة', titleFr: 'Coloriste',       color: '#B2543A', isActive: true, sortOrder: 2 },
  { id: 'st-karim',  tenantId: TENANT_ID, displayName: 'كريم',   title: 'حلاق',        titleFr: 'Coiffeur',        color: '#4A6741', isActive: true, sortOrder: 3 },
]

const svc = (
  id: string,
  name: string,
  nameFr: string,
  category: string,
  durationMin: number,
  bufferAfterMin: number,
  priceCentimes: number,
  requiresApproval: boolean,
  color: string,
  sortOrder: number,
): Service => ({
  id,
  tenantId: TENANT_ID,
  name,
  nameFr,
  category,
  durationMin,
  bufferBeforeMin: 0,
  bufferAfterMin,
  priceCentimes,
  priceFrom: false,
  requiresApproval,
  color,
  isActive: true,
  sortOrder,
})

export const services: Service[] = [
  svc('sv-cut',   'حلاقة رجالية', 'Coupe homme',     'حلاقة', 30,  5,  5000, true,  '#0E7C86', 1),
  svc('sv-beard', 'لحية وتشذيب',  'Barbe',           'حلاقة', 20,  5,  3000, false, '#4A6741', 2),
  svc('sv-color', 'صباغة',        'Coloration',      'عناية', 90, 15, 25000, true,  '#B2543A', 3),
  svc('sv-kids',  'حلاقة أطفال',  'Coupe enfant',    'حلاقة', 20,  5,  3500, false, '#A8802A', 4),
  svc('sv-full',  'باقة كاملة',    'Forfait complet', 'باقات', 75, 15, 12000, true,  '#1F5E6B', 5),
  svc('sv-wash',  'غسيل وتصفيف',  'Shampoing',       'عناية', 25,  5,  4000, false, '#6E7A82', 6),
]

export const staffServices: StaffService[] = [
  { staffId: 'st-amine',  serviceId: 'sv-cut' },
  { staffId: 'st-amine',  serviceId: 'sv-beard' },
  { staffId: 'st-amine',  serviceId: 'sv-full' },
  { staffId: 'st-amine',  serviceId: 'sv-kids' },
  { staffId: 'st-karim',  serviceId: 'sv-cut' },
  { staffId: 'st-karim',  serviceId: 'sv-beard' },
  { staffId: 'st-karim',  serviceId: 'sv-kids' },
  { staffId: 'st-karim',  serviceId: 'sv-wash' },
  { staffId: 'st-yasmin', serviceId: 'sv-color' },
  { staffId: 'st-yasmin', serviceId: 'sv-wash' },
  // Yasmin is faster at a plain cut — 25 minutes, not 30.
  { staffId: 'st-yasmin', serviceId: 'sv-cut', durationOverrideMin: 25 },
]

/** Tue–Sun 09:00–13:00 and 15:00–20:00. Closed Monday (weekday 1). */
const OPEN_DAYS = [0, 2, 3, 4, 5, 6] as const

export const workingHours: WorkingHour[] = [
  ...OPEN_DAYS.map((d) => ({
    id: `wh-am-${d}`, tenantId: TENANT_ID, staffId: null,
    weekday: d as WorkingHour['weekday'], opensMin: 540, closesMin: 780,
  })),
  ...OPEN_DAYS.map((d) => ({
    id: `wh-pm-${d}`, tenantId: TENANT_ID, staffId: null,
    weekday: d as WorkingHour['weekday'], opensMin: 900, closesMin: 1200,
  })),
  // Yasmin overrides Saturday: one long afternoon shift, no morning.
  { id: 'wh-yasmin-sat', tenantId: TENANT_ID, staffId: 'st-yasmin', weekday: 6 as WorkingHour['weekday'], opensMin: 720, closesMin: 1230 },
]

export function buildSeed(now: Date = new Date()) {
  const today = dayKeyOf(now, TZ)

  const closedDates: ClosedDate[] = [
    { tenantId: TENANT_ID, day: addDaysToKey(today, 21), label: 'عطلة سنوية' },
  ]

  // Amine takes 13:00–15:00 off every day this week.
  const timeOff: TimeOff[] = Array.from({ length: 8 }, (_, i) => {
    const day = addDaysToKey(today, i)
    return {
      id: `to-${i}`,
      tenantId: TENANT_ID,
      staffId: 'st-amine',
      startsAt: dayKeyToUtc(day, 780, TZ),
      endsAt: dayKeyToUtc(day, 900, TZ),
      reason: 'استراحة',
    }
  })

  const customers: Customer[] = [
    { id: 'c-1', tenantId: TENANT_ID, fullName: 'يوسف بنعلي', phone: '+212661112233', locale: 'ar', isBlocked: false, noShowCount: 0, totalBookings: 4, createdAt: now },
    { id: 'c-2', tenantId: TENANT_ID, fullName: 'سلمى الإدريسي', phone: '+212662223344', email: 'salma@example.ma', locale: 'ar', isBlocked: false, noShowCount: 0, totalBookings: 9, createdAt: now },
    { id: 'c-3', tenantId: TENANT_ID, fullName: 'Mehdi Alaoui', phone: '+212663334455', locale: 'fr', isBlocked: false, noShowCount: 1, totalBookings: 2, createdAt: now },
    { id: 'c-4', tenantId: TENANT_ID, fullName: 'أمينة الطاهري', phone: '+212664445566', locale: 'ar', isBlocked: false, noShowCount: 0, totalBookings: 1, createdAt: now },
  ]

  const mk = (
    id: string, customerId: string, staffId: string, serviceId: string,
    dayOffset: number, minutes: number, status: Booking['status'],
    source: Booking['source'] = 'web',
  ): Booking => {
    const service = services.find((s) => s.id === serviceId)!
    const startsAt = dayKeyToUtc(addDaysToKey(today, dayOffset), minutes, TZ)
    return {
      id, tenantId: TENANT_ID, customerId, staffId, serviceId,
      startsAt,
      endsAt: addMinutes(startsAt, service.durationMin),
      bufferBeforeMin: service.bufferBeforeMin,
      bufferAfterMin: service.bufferAfterMin,
      status, source,
      priceCentimes: service.priceCentimes,
      currency: 'MAD',
      code: id.toUpperCase().replace('B-', 'ZY'),
      createdAt: now, updatedAt: now,
    }
  }

  const bookings: Booking[] = [
    mk('b-1', 'c-1', 'st-amine',  'sv-cut',   0, 600,  'confirmed'),
    mk('b-2', 'c-2', 'st-yasmin', 'sv-color', 0, 630,  'confirmed'),
    mk('b-3', 'c-3', 'st-karim',  'sv-beard', 0, 960,  'confirmed'),
    mk('b-4', 'c-4', 'st-amine',  'sv-full',  1, 930,  'pending'),   // <- the queue
    mk('b-5', 'c-1', 'st-karim',  'sv-cut',   1, 1020, 'pending'),   // <- the queue
    mk('b-6', 'c-2', 'st-amine',  'sv-cut',   2, 570,  'confirmed'),
    mk('b-7', 'c-3', 'st-yasmin', 'sv-wash',  2, 1080, 'confirmed'),
    mk('b-8', 'c-4', 'st-karim',  'sv-kids',  3, 600,  'confirmed'),
    mk('b-9', 'c-1', 'st-amine',  'sv-beard', -1, 600, 'completed'),
    mk('b-10','c-3', 'st-karim',  'sv-cut',  -2, 960,  'no_show'),
  ]

  return { closedDates, timeOff, customers, bookings }
}

/** Demo owner login shown on the sign-in screen. */
export const DEMO_OWNER = {
  email: 'owner@zaytouna.ma',
  password: 'demo1234',
  displayName: 'مالك الصالون',
}
