export interface User { id: number; username: string; display_name: string; avatar_color: string; bio?: string }
export interface CommunitySummary { id: number; slug: string; name: string; icon: string; color: string; category: string; role?: string; tier_id?: number | null }
export interface Community extends CommunitySummary { tagline: string; description: string; owner_id: number; is_public: number; platform_fee_bps: number; member_count: number; owner: User; from_price_cents?: number | null; challenge_count?: number; live?: LiveSummary | null }
export interface Tier { id: number; community_id: number; name: string; price_cents: number; interval: string; description: string; perks: string[]; position: number }
export interface LiveSummary { channelId: number; count: number; publishers: number; live: boolean; host: { id: number; display_name: string } | null; mode: 'room' | 'broadcast' }
export interface Channel { id: number; community_id: number; name: string; type: 'text' | 'live' | 'announcements' | 'checkins' | 'pod'; topic: string; tier_required_id: number | null; position: number; members: number[] | null; locked: boolean; lock_reason: string | null; unread: number; live: LiveSummary }
export interface Membership { id: number; community_id: number; user_id: number; role: 'owner' | 'admin' | 'member'; tier_id: number | null; status: string }
export interface CommunityPayload { community: Community; tiers: Tier[]; channels: Channel[]; membership: Membership | null; my_tier: Tier | null; pot_cents: number }
export interface Reaction { emoji: string; count: number; users: number[] }
export interface Message { id: number; channel_id: number; content: string; kind: 'text' | 'checkin' | 'system'; meta: Record<string, any>; created_at: number; edited_at: number | null; user: User | null; reactions: Reaction[] }
export interface Stats { streak: number; unit: 'day' | 'week'; total: number; rate: number; doneToday: boolean; thisWeekCount: number; expected: number; stake_cents?: number }
export interface Challenge { id: number; community_id: number; title: string; description: string; emoji: string; cadence: 'daily' | 'weekly'; target_per_week: number; starts_at: number; ends_at: number | null; stake_cents: number; proof_required: number; member_count?: number; joined?: boolean; checkins_today?: number; my_stats?: Stats | null }
export interface LeaderRow extends Stats { user: User & { joined_at: number; stake_cents: number } }
export interface Event { id: number; community_id: number; title: string; description: string; starts_at: number; ends_at: number | null; location: string; channel_id: number | null; host_name?: string; channel_name?: string; going?: number; my_rsvp?: string | null; community_slug?: string; community_name?: string }
