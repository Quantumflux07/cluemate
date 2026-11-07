export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RoomStatus = 'active' | 'ended';
export type MemberRole = 'operator' | 'participant';
export type ResponseType = 'allocation' | 'dont_know';

export interface ProfileRow {
  id: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface RoomRow {
  id: string;
  room_code: string;
  operator_id: string;
  status: RoomStatus;
  current_poll_version: number;
  current_question_number: number;
  timer_started_at: string;
  created_at: string;
  updated_at: string;
}

export interface RoomMemberRow {
  id: string;
  room_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
}

export interface PollResponseRow {
  id: string;
  room_id: string;
  poll_version: number;
  user_id: string;
  response_type: ResponseType;
  allocation_a: number;
  allocation_b: number;
  allocation_c: number;
  allocation_d: number;
  committed_at: string;
  updated_at: string;
}

export interface RoomAggregateResult {
  room_id: string;
  poll_version: number;
  total_members: number;
  total_votes: number;
  dont_know_count: number;
  allocation_count: number;
  mean_a: number;
  mean_b: number;
  mean_c: number;
  mean_d: number;
}
