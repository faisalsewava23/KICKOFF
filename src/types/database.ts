// Database types for the KickOff schema (supabase/migrations/20260715090000_initial_schema.sql).
// Written to match the output shape of `supabase gen types typescript` — once
// the Supabase CLI is linked, regenerate with:
//   pnpm dlx supabase gen types typescript --project-id xbhloferhxjtengncbmp --schema public > src/types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      bookings: {
        Row: {
          created_at: string;
          game_id: string;
          id: string;
          payment_generation: number;
          reminder_sent_at: string | null;
          status: string;
          stripe_payment_intent: string | null;
          user_id: string;
          waitlist_position: number | null;
          wallet_applied_pence: number;
        };
        Insert: {
          created_at?: string;
          game_id: string;
          id?: string;
          payment_generation?: number;
          reminder_sent_at?: string | null;
          status?: string;
          stripe_payment_intent?: string | null;
          user_id: string;
          waitlist_position?: number | null;
          wallet_applied_pence?: number;
        };
        Update: {
          created_at?: string;
          game_id?: string;
          id?: string;
          payment_generation?: number;
          reminder_sent_at?: string | null;
          status?: string;
          stripe_payment_intent?: string | null;
          user_id?: string;
          waitlist_position?: number | null;
          wallet_applied_pence?: number;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      games: {
        Row: {
          created_at: string;
          description: string | null;
          duration_mins: number;
          format: string;
          id: string;
          kickoff_at: string;
          max_players: number;
          organiser_id: string;
          price_pence: number;
          status: string;
          venue_id: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          duration_mins?: number;
          format: string;
          id?: string;
          kickoff_at: string;
          max_players: number;
          organiser_id: string;
          price_pence: number;
          status?: string;
          venue_id: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          duration_mins?: number;
          format?: string;
          id?: string;
          kickoff_at?: string;
          max_players?: number;
          organiser_id?: string;
          price_pence?: number;
          status?: string;
          venue_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "games_organiser_id_fkey";
            columns: ["organiser_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "games_venue_id_fkey";
            columns: ["venue_id"];
            isOneToOne: false;
            referencedRelation: "venues";
            referencedColumns: ["id"];
          },
        ];
      };
      organiser_payouts: {
        Row: {
          amount_pence: number;
          booking_id: string | null;
          created_at: string;
          game_id: string;
          id: string;
          organiser_id: string;
          paid_at: string | null;
          payout_key: string | null;
          status: string;
          stripe_transfer_id: string | null;
        };
        Insert: {
          amount_pence: number;
          booking_id?: string | null;
          created_at?: string;
          game_id: string;
          id?: string;
          organiser_id: string;
          paid_at?: string | null;
          payout_key?: string | null;
          status?: string;
          stripe_transfer_id?: string | null;
        };
        Update: {
          amount_pence?: number;
          booking_id?: string | null;
          created_at?: string;
          game_id?: string;
          id?: string;
          organiser_id?: string;
          paid_at?: string | null;
          payout_key?: string | null;
          status?: string;
          stripe_transfer_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organiser_payouts_booking_id_fkey";
            columns: ["booking_id"];
            isOneToOne: false;
            referencedRelation: "bookings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organiser_payouts_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organiser_payouts_organiser_id_fkey";
            columns: ["organiser_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string;
          id: string;
          is_organiser: boolean;
          name: string | null;
          phone: string | null;
          stripe_connect_id: string | null;
          stripe_customer_id: string | null;
          wallet_balance_pence: number;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email: string;
          id: string;
          is_organiser?: boolean;
          name?: string | null;
          phone?: string | null;
          stripe_connect_id?: string | null;
          stripe_customer_id?: string | null;
          wallet_balance_pence?: number;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          is_organiser?: boolean;
          name?: string | null;
          phone?: string | null;
          stripe_connect_id?: string | null;
          stripe_customer_id?: string | null;
          wallet_balance_pence?: number;
        };
        Relationships: [];
      };
      wallet_holds: {
        Row: {
          amount_pence: number;
          checkout_session_id: string | null;
          created_at: string;
          game_id: string;
          id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          amount_pence: number;
          checkout_session_id?: string | null;
          created_at?: string;
          game_id: string;
          id?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          amount_pence?: number;
          checkout_session_id?: string | null;
          created_at?: string;
          game_id?: string;
          id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallet_holds_game_id_fkey";
            columns: ["game_id"];
            isOneToOne: false;
            referencedRelation: "games";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wallet_holds_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      venues: {
        Row: {
          address: string;
          created_at: string;
          id: string;
          lat: number | null;
          lng: number | null;
          name: string;
          notes: string | null;
          postcode: string | null;
        };
        Insert: {
          address: string;
          created_at?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          name: string;
          notes?: string | null;
          postcode?: string | null;
        };
        Update: {
          address?: string;
          created_at?: string;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          name?: string;
          notes?: string | null;
          postcode?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      book_with_wallet: {
        Args: { p_game_id: string; p_user_id: string; p_amount: number };
        Returns: {
          booking_id: string;
          status: string;
          waitlist_position: number | null;
        }[];
      };
      hold_wallet_for_checkout: {
        Args: { p_user_id: string; p_game_id: string; p_amount: number };
        Returns: string;
      };
      release_wallet_hold: {
        Args: { p_hold_id: string };
        Returns: boolean;
      };
      consume_wallet_hold: {
        Args: { p_hold_id: string };
        Returns: number | null;
      };
      claim_next_waitlist_promotion: {
        Args: { p_game_id: string };
        Returns: {
          booking_id: string;
          user_id: string;
          stripe_payment_intent: string | null;
          claimed_position: number | null;
          wallet_applied_pence: number;
          resumed: boolean;
        }[];
      };
      resolve_waitlist_booking: {
        Args: {
          p_booking_id: string;
          p_outcome: string;
          p_new_payment_intent?: string | null;
        };
        Returns: boolean;
      };
      cancel_game_with_refunds: {
        Args: { p_game_id: string };
        Returns: {
          refunded_players: number;
          released_waitlist: number;
        }[];
      };
      game_booking_counts: {
        Args: { game_ids: string[] };
        Returns: {
          game_id: string;
          confirmed_count: number;
          waitlist_count: number;
        }[];
      };
      game_roster: {
        Args: { p_game_id: string };
        Returns: {
          role: string;
          display_name: string;
          avatar_url: string | null;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  TableName extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]),
> = (DefaultSchema["Tables"] &
  DefaultSchema["Views"])[TableName] extends {
  Row: infer R;
}
  ? R
  : never;

export type TablesInsert<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName] extends { Insert: infer I } ? I : never;

export type TablesUpdate<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName] extends { Update: infer U } ? U : never;
