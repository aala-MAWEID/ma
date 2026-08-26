/**
 * RPC names and argument signatures used across the frontend.
 * Freezed to prevent regressions and keep alignment with Postgres definitions.
 */

export interface RpcSignature {
  name: string
  args: string[]
  isPublic?: boolean
}

export const RPC_DEFINITIONS: readonly RpcSignature[] = Object.freeze([
  // Public RPCs (15 exact)
  { name: 'get_tenant_bundle', args: ['p_slug'], isPublic: true },
  {
    name: 'get_availability',
    args: ['p_slug', 'p_service_id', 'p_staff_id', 'p_from_day', 'p_days'],
    isPublic: true,
  },
  { name: 'get_open_days', args: ['p_slug', 'p_from_day', 'p_days'], isPublic: true },
  {
    name: 'hold_slot',
    args: ['p_slug', 'p_service_id', 'p_staff_id', 'p_starts_at'],
    isPublic: true,
  },
  {
    name: 'confirm_hold',
    args: [
      'p_booking_id',
      'p_code',
      'p_full_name',
      'p_phone',
      'p_email',
      'p_locale',
      'p_notes',
    ],
    isPublic: true,
  },
  { name: 'release_hold', args: ['p_booking_id', 'p_code'], isPublic: true },
  { name: 'get_booking_by_code', args: ['p_code'], isPublic: true },
  { name: 'cancel_by_code', args: ['p_code', 'p_reason'], isPublic: true },
  {
    name: 'reschedule_by_code',
    args: ['p_code', 'p_new_starts_at', 'p_new_staff_id'],
    isPublic: true,
  },
  {
    name: 'list_bookings_by_phone',
    args: ['p_slug', 'p_phone'],
    isPublic: true,
  },
  {
    name: 'queue_join',
    args: ['p_slug', 'p_service_id', 'p_staff_id', 'p_full_name', 'p_phone', 'p_notes'],
    isPublic: true,
  },
  { name: 'queue_public', args: ['p_slug', 'p_day'], isPublic: true },
  { name: 'turn_status', args: ['p_code'], isPublic: true },
  { name: 'auth_status', args: ['p_slug'], isPublic: true },
  { name: 'health_check', args: ['p_slug'], isPublic: true },

  // Authenticated / Admin RPCs
  { name: 'whoami', args: [] },
  { name: 'claim_shop', args: ['p_slug'] },
  {
    name: 'get_agenda',
    args: ['p_tenant_id', 'p_day', 'p_staff_id', 'p_status'],
  },
  { name: 'list_requests', args: ['p_tenant_id'] },
  {
    name: 'admin_decide',
    args: ['p_tenant_id', 'p_booking_id', 'p_decision', 'p_reason'],
  },
  {
    name: 'admin_move_booking',
    args: ['p_tenant_id', 'p_booking_id', 'p_new_starts_at', 'p_new_staff_id'],
  },
  {
    name: 'admin_create_booking',
    args: [
      'p_tenant_id',
      'p_service_id',
      'p_staff_id',
      'p_starts_at',
      'p_full_name',
      'p_phone',
      'p_email',
      'p_notes',
      'p_source',
    ],
  },
  {
    name: 'update_booking_status',
    args: ['p_tenant_id', 'p_booking_id', 'p_status', 'p_reason'],
  },
  {
    name: 'admin_cancel_booking',
    args: ['p_tenant_id', 'p_booking_id', 'p_reason'],
  },
  {
    name: 'admin_delete_booking',
    args: ['p_tenant_id', 'p_booking_id', 'p_reason'],
  },
  { name: 'list_customers', args: ['p_tenant_id'] },
  { name: 'get_stats', args: ['p_tenant_id'] },
  { name: 'update_settings', args: ['p_tenant_id', 'p_patch'] },
  { name: 'get_queue', args: ['p_tenant_id', 'p_day'] },
  {
    name: 'queue_next',
    args: ['p_tenant_id', 'p_staff_id', 'p_close_as'],
  },
  { name: 'queue_advance', args: ['p_tenant_id', 'p_booking_id'] },
  { name: 'queue_skip', args: ['p_tenant_id', 'p_booking_id'] },
  { name: 'queue_reorder', args: ['p_tenant_id', 'p_booking_ids'] },
  { name: 'queue_call', args: ['p_booking_id'] },
  {
    name: 'update_tenant_identity',
    args: [
      'p_tenant_id',
      'p_name',
      'p_name_fr',
      'p_tagline',
      'p_tagline_fr',
      'p_address',
      'p_city',
      'p_phone',
      'p_whatsapp',
      'p_brand_color',
    ],
  },
  {
    name: 'upsert_staff',
    args: [
      'p_tenant_id',
      'p_id',
      'p_display_name',
      'p_title',
      'p_color',
      'p_is_active',
      'p_sort_order',
    ],
  },
  {
    name: 'set_staff_avatar',
    args: ['p_tenant_id', 'p_staff_id', 'p_url'],
  },
  {
    name: 'upsert_service',
    args: [
      'p_tenant_id',
      'p_id',
      'p_name',
      'p_name_fr',
      'p_description',
      'p_category',
      'p_duration_min',
      'p_buffer_before_min',
      'p_buffer_after_min',
      'p_price_centimes',
      'p_price_from',
      'p_requires_approval',
      'p_color',
      'p_is_active',
      'p_sort_order',
    ],
  },
  { name: 'update_my_profile', args: ['p_display_name'] },
  { name: 'list_all_staff', args: ['p_tenant_id'] },
  { name: 'list_all_services', args: ['p_tenant_id'] },
  { name: 'delete_staff', args: ['p_tenant_id', 'p_staff_id'] },
  { name: 'delete_service', args: ['p_tenant_id', 'p_service_id'] },
  { name: 'reorder_staff', args: ['p_tenant_id', 'p_ids'] },
  { name: 'reorder_services', args: ['p_tenant_id', 'p_ids'] },
  {
    name: 'set_staff_services',
    args: ['p_tenant_id', 'p_staff_id', 'p_service_ids'],
  },
  { name: 'get_day_schedule', args: ['p_tenant_id', 'p_day'] },
  { name: 'my_bookings', args: ['p_slug'] },
  { name: 'cancel_my_booking', args: ['p_code', 'p_reason'] },
  { name: 'set_week_hours', args: ['p_tenant_id', 'p_staff_id', 'p_week'] },
  { name: 'set_hours_mode', args: ['p_tenant_id', 'p_mode', 'p_show_hours'] },
  { name: 'list_closed_dates', args: ['p_tenant_id'] },
  {
    name: 'upsert_closed_date',
    args: ['p_tenant_id', 'p_day', 'p_reason'],
  },
  { name: 'delete_closed_date', args: ['p_tenant_id', 'p_day'] },
  { name: 'list_time_off', args: ['p_tenant_id'] },
  {
    name: 'upsert_time_off',
    args: [
      'p_tenant_id',
      'p_id',
      'p_staff_id',
      'p_starts_at',
      'p_ends_at',
      'p_reason',
    ],
  },
  { name: 'delete_time_off', args: ['p_tenant_id', 'p_id'] },
  {
    name: 'set_service_price_visibility',
    args: ['p_tenant_id', 'p_service_id', 'p_hidden'],
  },
  { name: 'guest_hello', args: ['p_slug', 'p_device_token', 'p_user_agent', 'p_platform', 'p_locale', 'p_time_zone'] },
  { name: 'guest_claim', args: ['p_slug', 'p_device_token', 'p_code'] },
  { name: 'guest_feed', args: ['p_slug', 'p_device_token', 'p_limit'] },
  { name: 'guest_mark_read', args: ['p_device_token', 'p_ids'] },
  { name: 'guest_set_prefs', args: ['p_slug', 'p_device_token', 'p_sound', 'p_push', 'p_label'] },
  { name: 'queue_counts', args: ['p_slug', 'p_device_token'] },
  { name: 'admin_customers', args: ['p_tenant_id', 'p_search', 'p_limit', 'p_offset'] },
  { name: 'admin_customer_detail', args: ['p_tenant_id', 'p_customer_id'] },
  { name: 'admin_customer_stats', args: ['p_tenant_id'] },
  { name: 'admin_block_customer', args: ['p_tenant_id', 'p_customer_id', 'p_blocked', 'p_reason'] },
  { name: 'admin_notify_customer', args: ['p_tenant_id', 'p_booking_id', 'p_title', 'p_body', 'p_urgent'] },
  { name: 'admin_devices', args: ['p_tenant_id', 'p_limit'] },
  { name: 'api_manifest', args: [] },
  { name: 'get_settings_schema', args: [] },
])
