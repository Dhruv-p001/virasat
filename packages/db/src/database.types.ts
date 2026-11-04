
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "families": {
                  Row: {
                    "cover_path": string | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "cover_path"?: string | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "families_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"family_members": {
                  Row: {
                    "family_id": string,"joined_at": string,"profile_id": string,"role": Database["public"]['Enums']["family_role"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "family_id": string,"joined_at"?: string,"profile_id": string,"role": Database["public"]['Enums']["family_role"],"updated_at"?: string
                  }
                  Update: {
                    "family_id"?: string,"joined_at"?: string,"profile_id"?: string,"role"?: Database["public"]['Enums']["family_role"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "family_members_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "family_members_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"channel": Database["public"]['Enums']["invite_channel"],"created_at": string,"email": string | null,"expires_at": string,"family_id": string,"id": string,"invited_by": string | null,"person_id": string | null,"phone": string | null,"revoked_at": string | null,"role": Database["public"]['Enums']["family_role"],"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"channel": Database["public"]['Enums']["invite_channel"],"created_at"?: string,"email"?: string | null,"expires_at": string,"family_id": string,"id"?: string,"invited_by"?: string | null,"person_id"?: string | null,"phone"?: string | null,"revoked_at"?: string | null,"role": Database["public"]['Enums']["family_role"],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"channel"?: Database["public"]['Enums']["invite_channel"],"created_at"?: string,"email"?: string | null,"expires_at"?: string,"family_id"?: string,"id"?: string,"invited_by"?: string | null,"person_id"?: string | null,"phone"?: string | null,"revoked_at"?: string | null,"role"?: Database["public"]['Enums']["family_role"],"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_invited_by_fkey"
      columns: ["invited_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"people": {
                  Row: {
                    "birth_year": number | null,"created_at": string,"created_by": string | null,"deleted_at": string | null,"display_name": string,"family_id": string,"id": string,"notes": string | null,"photo_path": string | null,"profile_id": string | null,"relation_label": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_year"?: number | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"display_name": string,"family_id": string,"id"?: string,"notes"?: string | null,"photo_path"?: string | null,"profile_id"?: string | null,"relation_label"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "birth_year"?: number | null,"created_at"?: string,"created_by"?: string | null,"deleted_at"?: string | null,"display_name"?: string,"family_id"?: string,"id"?: string,"notes"?: string | null,"photo_path"?: string | null,"profile_id"?: string | null,"relation_label"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "people_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "people_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "people_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_path": string | null,"country_code": string | null,"created_at": string,"display_name": string,"id": string,"preferred_language": string,"unit_system": Database["public"]['Enums']["unit_system"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_path"?: string | null,"country_code"?: string | null,"created_at"?: string,"display_name": string,"id": string,"preferred_language"?: string,"unit_system"?: Database["public"]['Enums']["unit_system"],"updated_at"?: string
                  }
                  Update: {
                    "avatar_path"?: string | null,"country_code"?: string | null,"created_at"?: string,"display_name"?: string,"id"?: string,"preferred_language"?: string,"unit_system"?: Database["public"]['Enums']["unit_system"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invite":
{ Args: { "p_profile_id": string,"p_token": string }; Returns: string
                           },
"create_family":
{ Args: { "p_name": string }; Returns: string
                           },
"create_invite":
{ Args: { "p_actor": string,"p_channel": Database["public"]['Enums']["invite_channel"],"p_email"?: string,"p_expires_in"?: string,"p_family_id": string,"p_person_id"?: string,"p_phone"?: string,"p_role": Database["public"]['Enums']["family_role"],"p_token": string }; Returns: string
                           },
"remove_person":
{ Args: { "p_person_id": string }; Returns: undefined
                           },
"revoke_invite":
{ Args: { "p_actor": string,"p_invite_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "family_role": "owner"|"admin"|"member"|"viewer","invite_channel": "link"|"phone"|"email","unit_system": "metric"|"us_customary"|"cups_spoons"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "family_role": ["owner", "admin", "member", "viewer"],"invite_channel": ["link", "phone", "email"],"unit_system": ["metric", "us_customary", "cups_spoons"]
          }
        }
} as const
