
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
            "capture_jobs": {
                  Row: {
                    "ai_output": Json | null,"contributor_link_id": string | null,"created_at": string,"created_by": string | null,"detected_language": string | null,"error": string | null,"family_id": string,"id": string,"person_id": string | null,"provider_meta": Json | null,"recipe_id": string | null,"source_type": Database["public"]['Enums']["source_type"],"status": Database["public"]['Enums']["capture_status"],"transcript": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_output"?: Json | null,"contributor_link_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"detected_language"?: string | null,"error"?: string | null,"family_id": string,"id"?: string,"person_id"?: string | null,"provider_meta"?: Json | null,"recipe_id"?: string | null,"source_type": Database["public"]['Enums']["source_type"],"status"?: Database["public"]['Enums']["capture_status"],"transcript"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "ai_output"?: Json | null,"contributor_link_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"detected_language"?: string | null,"error"?: string | null,"family_id"?: string,"id"?: string,"person_id"?: string | null,"provider_meta"?: Json | null,"recipe_id"?: string | null,"source_type"?: Database["public"]['Enums']["source_type"],"status"?: Database["public"]['Enums']["capture_status"],"transcript"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "capture_jobs_contributor_link_id_fkey"
      columns: ["contributor_link_id"]
isOneToOne: false
      referencedRelation: "contributor_links"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "capture_jobs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "capture_jobs_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "capture_jobs_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "capture_jobs_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"consents": {
                  Row: {
                    "contributor_link_id": string | null,"family_id": string,"given_at": string,"given_by_profile_id": string | null,"given_via": Database["public"]['Enums']["consent_via"],"id": string,"kind": Database["public"]['Enums']["consent_kind"],"person_id": string,"withdrawn_at": string | null,"wording_version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contributor_link_id"?: string | null,"family_id": string,"given_at"?: string,"given_by_profile_id"?: string | null,"given_via": Database["public"]['Enums']["consent_via"],"id"?: string,"kind": Database["public"]['Enums']["consent_kind"],"person_id": string,"withdrawn_at"?: string | null,"wording_version": string
                  }
                  Update: {
                    "contributor_link_id"?: string | null,"family_id"?: string,"given_at"?: string,"given_by_profile_id"?: string | null,"given_via"?: Database["public"]['Enums']["consent_via"],"id"?: string,"kind"?: Database["public"]['Enums']["consent_kind"],"person_id"?: string,"withdrawn_at"?: string | null,"wording_version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "consents_contributor_link_id_fkey"
      columns: ["contributor_link_id"]
isOneToOne: false
      referencedRelation: "contributor_links"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consents_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consents_given_by_profile_id_fkey"
      columns: ["given_by_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consents_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"contributor_links": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"family_id": string,"id": string,"max_uploads": number,"person_id": string,"revoked_at": string | null,"token_hash": string,"upload_count": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at": string,"family_id": string,"id"?: string,"max_uploads"?: number,"person_id": string,"revoked_at"?: string | null,"token_hash": string,"upload_count"?: number
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"family_id"?: string,"id"?: string,"max_uploads"?: number,"person_id"?: string,"revoked_at"?: string | null,"token_hash"?: string,"upload_count"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "contributor_links_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contributor_links_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contributor_links_person_id_fkey"
      columns: ["person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    }
                  ]
                },"families": {
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
                },"media": {
                  Row: {
                    "byte_size": number | null,"caption": string | null,"capture_job_id": string | null,"contributor_link_id": string | null,"created_at": string,"derived_from_media_id": string | null,"duration_ms": number | null,"family_id": string,"height": number | null,"id": string,"kind": Database["public"]['Enums']["media_kind"],"mime_type": string,"recipe_version_id": string | null,"removed_at": string | null,"removed_reason": string | null,"storage_bucket": string,"storage_path": string,"uploaded_by": string | null,"width": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "byte_size"?: number | null,"caption"?: string | null,"capture_job_id"?: string | null,"contributor_link_id"?: string | null,"created_at"?: string,"derived_from_media_id"?: string | null,"duration_ms"?: number | null,"family_id": string,"height"?: number | null,"id"?: string,"kind": Database["public"]['Enums']["media_kind"],"mime_type": string,"recipe_version_id"?: string | null,"removed_at"?: string | null,"removed_reason"?: string | null,"storage_bucket": string,"storage_path": string,"uploaded_by"?: string | null,"width"?: number | null
                  }
                  Update: {
                    "byte_size"?: number | null,"caption"?: string | null,"capture_job_id"?: string | null,"contributor_link_id"?: string | null,"created_at"?: string,"derived_from_media_id"?: string | null,"duration_ms"?: number | null,"family_id"?: string,"height"?: number | null,"id"?: string,"kind"?: Database["public"]['Enums']["media_kind"],"mime_type"?: string,"recipe_version_id"?: string | null,"removed_at"?: string | null,"removed_reason"?: string | null,"storage_bucket"?: string,"storage_path"?: string,"uploaded_by"?: string | null,"width"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_capture_job_id_fkey"
      columns: ["capture_job_id"]
isOneToOne: false
      referencedRelation: "capture_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_contributor_link_id_fkey"
      columns: ["contributor_link_id"]
isOneToOne: false
      referencedRelation: "contributor_links"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_derived_from_media_id_fkey"
      columns: ["derived_from_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_recipe_version_id_fkey"
      columns: ["recipe_version_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "media_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
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
                },"recipe_versions": {
                  Row: {
                    "author_person_id": string | null,"capture_job_id": string | null,"change_note": string | null,"confirmed_at": string | null,"created_at": string,"created_by": string | null,"family_id": string,"id": string,"ingredients": NonNullable<Json>,"kind": Database["public"]['Enums']["version_kind"],"language": string,"parent_version_id": string | null,"recipe_id": string,"servings": number | null,"source_type": Database["public"]['Enums']["source_type"],"status": Database["public"]['Enums']["version_status"],"steps": NonNullable<Json>,"story": string | null,"tips": NonNullable<Json>,"title": string,"uncertain_fields": NonNullable<Json>,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_person_id"?: string | null,"capture_job_id"?: string | null,"change_note"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"family_id": string,"id"?: string,"ingredients": NonNullable<Json>,"kind": Database["public"]['Enums']["version_kind"],"language": string,"parent_version_id"?: string | null,"recipe_id": string,"servings"?: number | null,"source_type": Database["public"]['Enums']["source_type"],"status"?: Database["public"]['Enums']["version_status"],"steps": NonNullable<Json>,"story"?: string | null,"tips"?: NonNullable<Json>,"title": string,"uncertain_fields"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Update: {
                    "author_person_id"?: string | null,"capture_job_id"?: string | null,"change_note"?: string | null,"confirmed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"family_id"?: string,"id"?: string,"ingredients"?: NonNullable<Json>,"kind"?: Database["public"]['Enums']["version_kind"],"language"?: string,"parent_version_id"?: string | null,"recipe_id"?: string,"servings"?: number | null,"source_type"?: Database["public"]['Enums']["source_type"],"status"?: Database["public"]['Enums']["version_status"],"steps"?: NonNullable<Json>,"story"?: string | null,"tips"?: NonNullable<Json>,"title"?: string,"uncertain_fields"?: NonNullable<Json>,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipe_versions_author_person_id_fkey"
      columns: ["author_person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_versions_capture_job_id_fkey"
      columns: ["capture_job_id"]
isOneToOne: false
      referencedRelation: "capture_jobs"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_versions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_versions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_versions_parent_version_id_fkey"
      columns: ["parent_version_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipe_versions_recipe_id_fkey"
      columns: ["recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    }
                  ]
                },"recipes": {
                  Row: {
                    "cover_media_id": string | null,"created_at": string,"created_by": string | null,"current_version_id": string | null,"deleted_at": string | null,"family_id": string,"id": string,"origin_person_id": string | null,"origin_recipe_id": string | null,"root_version_id": string | null,"title": string,"updated_at": string,"visibility": Database["public"]['Enums']["recipe_visibility"]
                  }
                  ComputedFields: never
                  Insert: {
                    "cover_media_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"current_version_id"?: string | null,"deleted_at"?: string | null,"family_id": string,"id"?: string,"origin_person_id"?: string | null,"origin_recipe_id"?: string | null,"root_version_id"?: string | null,"title": string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["recipe_visibility"]
                  }
                  Update: {
                    "cover_media_id"?: string | null,"created_at"?: string,"created_by"?: string | null,"current_version_id"?: string | null,"deleted_at"?: string | null,"family_id"?: string,"id"?: string,"origin_person_id"?: string | null,"origin_recipe_id"?: string | null,"root_version_id"?: string | null,"title"?: string,"updated_at"?: string,"visibility"?: Database["public"]['Enums']["recipe_visibility"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "recipes_cover_media_id_fkey"
      columns: ["cover_media_id"]
isOneToOne: false
      referencedRelation: "media"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_current_version_id_fkey"
      columns: ["current_version_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_origin_person_id_fkey"
      columns: ["origin_person_id"]
isOneToOne: false
      referencedRelation: "people"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_origin_recipe_id_fkey"
      columns: ["origin_recipe_id"]
isOneToOne: false
      referencedRelation: "recipes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recipes_root_version_id_fkey"
      columns: ["root_version_id"]
isOneToOne: false
      referencedRelation: "recipe_versions"
      referencedColumns: ["id"]
    }
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
"begin_capture":
{ Args: { "p_actor"?: string,"p_byte_size": number,"p_consent_wording_version": string,"p_contributor_token"?: string,"p_mime_type": string,"p_person_id"?: string,"p_source": Database["public"]['Enums']["source_type"] }; Returns: {
              "job_id": string,"media_id": string,"storage_bucket": string,"storage_path": string
            }[]
                           },
"confirm_capture":
{ Args: { "p_actor": string,"p_content": Json,"p_job_id": string }; Returns: string
                           },
"contributor_link_info":
{ Args: { "p_token": string }; Returns: {
              "family_id": string,"person_display_name": string,"photo_path": string,"relation_label": string,"uploads_left": number
            }[]
                           },
"create_contributor_link":
{ Args: { "p_actor": string,"p_expires_in"?: string,"p_max_uploads"?: number,"p_person_id": string,"p_token": string }; Returns: string
                           },
"create_family":
{ Args: { "p_name": string }; Returns: string
                           },
"create_invite":
{ Args: { "p_actor": string,"p_channel": Database["public"]['Enums']["invite_channel"],"p_email"?: string,"p_expires_in"?: string,"p_family_id": string,"p_person_id"?: string,"p_phone"?: string,"p_role": Database["public"]['Enums']["family_role"],"p_token": string }; Returns: string
                           },
"publish_correction":
{ Args: { "p_actor": string,"p_change_note": string,"p_content": Json,"p_recipe_id": string }; Returns: string
                           },
"remove_person":
{ Args: { "p_person_id": string }; Returns: undefined
                           },
"revoke_contributor_link":
{ Args: { "p_actor": string,"p_link_id": string }; Returns: undefined
                           },
"revoke_invite":
{ Args: { "p_actor": string,"p_invite_id": string }; Returns: undefined
                           }
          }
          Enums: {
            "capture_status": "awaiting_upload"|"uploaded"|"transcribing"|"structuring"|"ready_for_review"|"failed"|"confirmed","consent_kind": "voice_recording"|"third_party_processing","consent_via": "organiser"|"contributor_link","family_role": "owner"|"admin"|"member"|"viewer","invite_channel": "link"|"phone"|"email","media_kind": "original_audio"|"handwriting_scan"|"dish_photo"|"family_photo"|"derived_audio"|"derived_scan","recipe_visibility": "private"|"family"|"link"|"public","source_type": "voice"|"handwriting"|"typed"|"whatsapp","unit_system": "metric"|"us_customary"|"cups_spoons","version_kind": "original"|"correction"|"fork","version_status": "draft"|"confirmed"
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
            "capture_status": ["awaiting_upload", "uploaded", "transcribing", "structuring", "ready_for_review", "failed", "confirmed"],"consent_kind": ["voice_recording", "third_party_processing"],"consent_via": ["organiser", "contributor_link"],"family_role": ["owner", "admin", "member", "viewer"],"invite_channel": ["link", "phone", "email"],"media_kind": ["original_audio", "handwriting_scan", "dish_photo", "family_photo", "derived_audio", "derived_scan"],"recipe_visibility": ["private", "family", "link", "public"],"source_type": ["voice", "handwriting", "typed", "whatsapp"],"unit_system": ["metric", "us_customary", "cups_spoons"],"version_kind": ["original", "correction", "fork"],"version_status": ["draft", "confirmed"]
          }
        }
} as const
