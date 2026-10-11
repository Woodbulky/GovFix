
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ai_suggestions": {
                  Row: {
                    "confidence": number | null,"created_at": string,"decided_at": string | null,"decided_by": string | null,"id": string,"model": string | null,"payload": NonNullable<Json>,"provider": string,"request_id": string,"status": string,"type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "confidence"?: number | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"model"?: string | null,"payload": NonNullable<Json>,"provider": string,"request_id": string,"status"?: string,"type": string
                  }
                  Update: {
                    "confidence"?: number | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"id"?: string,"model"?: string | null,"payload"?: NonNullable<Json>,"provider"?: string,"request_id"?: string,"status"?: string,"type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ai_suggestions_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ai_suggestions_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["id"]
    }
                  ]
                },"app_settings": {
                  Row: {
                    "ai_offline": boolean,"auto_close_hours": number,"demo_mode": boolean,"id": number,"reopen_window_hours": number,"sim_offset_seconds": number,"triage_hours": number,"warn_at": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_offline"?: boolean,"auto_close_hours"?: number,"demo_mode"?: boolean,"id"?: number,"reopen_window_hours"?: number,"sim_offset_seconds"?: number,"triage_hours"?: number,"warn_at"?: number
                  }
                  Update: {
                    "ai_offline"?: boolean,"auto_close_hours"?: number,"demo_mode"?: boolean,"id"?: number,"reopen_window_hours"?: number,"sim_offset_seconds"?: number,"triage_hours"?: number,"warn_at"?: number
                  }
                  Relationships: [
                    
                  ]
                },"audit_events": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_role": string,"channel": Database["public"]['Enums']["channel"],"code": string | null,"from_state": Database["public"]['Enums']["request_state"] | null,"hash": string,"id": number,"outcome": Database["public"]['Enums']["audit_outcome"],"payload": NonNullable<Json>,"prev_hash": string,"reason": string | null,"request_id": string | null,"sim_ts": string,"to_state": Database["public"]['Enums']["request_state"] | null,"ts": string,"audit_hash": string | null
                  }
                  ComputedFields: "audit_hash"
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_role": string,"channel": Database["public"]['Enums']["channel"],"code"?: string | null,"from_state"?: Database["public"]['Enums']["request_state"] | null,"hash": string,"id"?: number,"outcome": Database["public"]['Enums']["audit_outcome"],"payload"?: NonNullable<Json>,"prev_hash": string,"reason"?: string | null,"request_id"?: string | null,"sim_ts": string,"to_state"?: Database["public"]['Enums']["request_state"] | null,"ts"?: string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_role"?: string,"channel"?: Database["public"]['Enums']["channel"],"code"?: string | null,"from_state"?: Database["public"]['Enums']["request_state"] | null,"hash"?: string,"id"?: number,"outcome"?: Database["public"]['Enums']["audit_outcome"],"payload"?: NonNullable<Json>,"prev_hash"?: string,"reason"?: string | null,"request_id"?: string | null,"sim_ts"?: string,"to_state"?: Database["public"]['Enums']["request_state"] | null,"ts"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "audit_events_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["id"]
    }
                  ]
                },"categories": {
                  Row: {
                    "code": string,"department_code": string | null,"icon": string,"keywords": (string)[],"name_en": string,"name_hi": string,"name_mr": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"department_code"?: string | null,"icon": string,"keywords"?: (string)[],"name_en": string,"name_hi": string,"name_mr": string
                  }
                  Update: {
                    "code"?: string,"department_code"?: string | null,"icon"?: string,"keywords"?: (string)[],"name_en"?: string,"name_hi"?: string,"name_mr"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_department_code_fkey"
      columns: ["department_code"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["code"]
    }
                  ]
                },"city_water": {
                  Row: {
                    "decks": NonNullable<Json>,"id": number,"river": NonNullable<Json>,"river_width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "decks"?: NonNullable<Json>,"id"?: number,"river": NonNullable<Json>,"river_width": number
                  }
                  Update: {
                    "decks"?: NonNullable<Json>,"id"?: number,"river"?: NonNullable<Json>,"river_width"?: number
                  }
                  Relationships: [
                    
                  ]
                },"departments": {
                  Row: {
                    "code": string,"head_id": string | null,"name_en": string,"name_hi": string,"name_mr": string
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"head_id"?: string | null,"name_en": string,"name_hi": string,"name_mr": string
                  }
                  Update: {
                    "code"?: string,"head_id"?: string | null,"name_en"?: string,"name_hi"?: string,"name_mr"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "departments_head_fk"
      columns: ["head_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"landmarks": {
                  Row: {
                    "aliases": (string)[],"id": number,"name_en": string,"name_hi": string,"name_mr": string,"ward_id": number,"x": number,"z": number
                  }
                  ComputedFields: never
                  Insert: {
                    "aliases"?: (string)[],"id"?: number,"name_en": string,"name_hi": string,"name_mr": string,"ward_id": number,"x": number,"z": number
                  }
                  Update: {
                    "aliases"?: (string)[],"id"?: number,"name_en"?: string,"name_hi"?: string,"name_mr"?: string,"ward_id"?: number,"x"?: number,"z"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "landmarks_ward_id_fkey"
      columns: ["ward_id"]
isOneToOne: false
      referencedRelation: "wards"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "audio_path": string | null,"body": string,"created_at": string,"id": string,"kind": string,"language": string,"read_at": string | null,"request_id": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "audio_path"?: string | null,"body": string,"created_at": string,"id"?: string,"kind": string,"language": string,"read_at"?: string | null,"request_id"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "audio_path"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"language"?: string,"read_at"?: string | null,"request_id"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"officer_wards": {
                  Row: {
                    "officer_id": string,"ward_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "officer_id": string,"ward_id": number
                  }
                  Update: {
                    "officer_id"?: string,"ward_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "officer_wards_officer_id_fkey"
      columns: ["officer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "officer_wards_ward_id_fkey"
      columns: ["ward_id"]
isOneToOne: false
      referencedRelation: "wards"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"department_code": string | null,"full_name": string,"id": string,"large_text": boolean,"phone": string | null,"preferred_language": string,"role": Database["public"]['Enums']["app_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"department_code"?: string | null,"full_name": string,"id": string,"large_text"?: boolean,"phone"?: string | null,"preferred_language"?: string,"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Update: {
                    "created_at"?: string,"department_code"?: string | null,"full_name"?: string,"id"?: string,"large_text"?: boolean,"phone"?: string | null,"preferred_language"?: string,"role"?: Database["public"]['Enums']["app_role"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_department_code_fkey"
      columns: ["department_code"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["code"]
    }
                  ]
                },"request_messages": {
                  Row: {
                    "ai_suggestion_id": string | null,"author_id": string | null,"body": string,"created_at": string,"id": string,"kind": string,"language": string | null,"request_id": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ai_suggestion_id"?: string | null,"author_id"?: string | null,"body": string,"created_at": string,"id"?: string,"kind": string,"language"?: string | null,"request_id": string,"visibility": string
                  }
                  Update: {
                    "ai_suggestion_id"?: string | null,"author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"kind"?: string,"language"?: string | null,"request_id"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_messages_ai_fk"
      columns: ["ai_suggestion_id"]
isOneToOne: false
      referencedRelation: "ai_suggestions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_messages_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_messages_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["id"]
    }
                  ]
                },"request_photos": {
                  Row: {
                    "created_at": string,"id": string,"kind": string,"request_id": string,"storage_path": string,"uploaded_by": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at": string,"id"?: string,"kind": string,"request_id": string,"storage_path": string,"uploaded_by": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: string,"request_id"?: string,"storage_path"?: string,"uploaded_by"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_photos_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_photos_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"requests": {
                  Row: {
                    "assigned_officer_id": string | null,"category_code": string | null,"category_hint": string | null,"channel": Database["public"]['Enums']["channel"],"citizen_id": string,"closed_at": string | null,"department_code": string | null,"description": string,"duplicate_of": string | null,"escalation_level": number,"id": string,"landmark_id": number | null,"language": string,"loc_x": number | null,"loc_z": number | null,"paused_seconds": number,"paused_since": string | null,"reopen_count": number,"resolution_due_at": string | null,"resolved_at": string | null,"sla_clock_start": string | null,"sla_policy_id": number | null,"state": Database["public"]['Enums']["request_state"],"submitted_at": string,"ticket_no": string,"transcript": string | null,"triage_due_at": string,"triage_escalated_at": string | null,"updated_at": string,"ward_id": number,"_can_see": boolean | null,"sla_ratio": number | null,"sla_status_of": string | null
                  }
                  ComputedFields: "_can_see" | "sla_ratio" | "sla_status_of"
                  Insert: {
                    "assigned_officer_id"?: string | null,"category_code"?: string | null,"category_hint"?: string | null,"channel": Database["public"]['Enums']["channel"],"citizen_id": string,"closed_at"?: string | null,"department_code"?: string | null,"description": string,"duplicate_of"?: string | null,"escalation_level"?: number,"id"?: string,"landmark_id"?: number | null,"language": string,"loc_x"?: number | null,"loc_z"?: number | null,"paused_seconds"?: number,"paused_since"?: string | null,"reopen_count"?: number,"resolution_due_at"?: string | null,"resolved_at"?: string | null,"sla_clock_start"?: string | null,"sla_policy_id"?: number | null,"state"?: Database["public"]['Enums']["request_state"],"submitted_at": string,"ticket_no": string,"transcript"?: string | null,"triage_due_at": string,"triage_escalated_at"?: string | null,"updated_at": string,"ward_id": number
                  }
                  Update: {
                    "assigned_officer_id"?: string | null,"category_code"?: string | null,"category_hint"?: string | null,"channel"?: Database["public"]['Enums']["channel"],"citizen_id"?: string,"closed_at"?: string | null,"department_code"?: string | null,"description"?: string,"duplicate_of"?: string | null,"escalation_level"?: number,"id"?: string,"landmark_id"?: number | null,"language"?: string,"loc_x"?: number | null,"loc_z"?: number | null,"paused_seconds"?: number,"paused_since"?: string | null,"reopen_count"?: number,"resolution_due_at"?: string | null,"resolved_at"?: string | null,"sla_clock_start"?: string | null,"sla_policy_id"?: number | null,"state"?: Database["public"]['Enums']["request_state"],"submitted_at"?: string,"ticket_no"?: string,"transcript"?: string | null,"triage_due_at"?: string,"triage_escalated_at"?: string | null,"updated_at"?: string,"ward_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "requests_assigned_officer_id_fkey"
      columns: ["assigned_officer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requests_category_code_fkey"
      columns: ["category_code"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "requests_citizen_id_fkey"
      columns: ["citizen_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requests_department_code_fkey"
      columns: ["department_code"]
isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "requests_duplicate_of_fkey"
      columns: ["duplicate_of"]
isOneToOne: false
      referencedRelation: "requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requests_landmark_id_fkey"
      columns: ["landmark_id"]
isOneToOne: false
      referencedRelation: "landmarks"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requests_sla_policy_id_fkey"
      columns: ["sla_policy_id"]
isOneToOne: false
      referencedRelation: "sla_policies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "requests_ward_id_fkey"
      columns: ["ward_id"]
isOneToOne: false
      referencedRelation: "wards"
      referencedColumns: ["id"]
    }
                  ]
                },"sla_policies": {
                  Row: {
                    "category_code": string,"created_by": string | null,"effective_from": string,"id": number,"note": string | null,"resolution_hours": number
                  }
                  ComputedFields: never
                  Insert: {
                    "category_code": string,"created_by"?: string | null,"effective_from": string,"id"?: number,"note"?: string | null,"resolution_hours": number
                  }
                  Update: {
                    "category_code"?: string,"created_by"?: string | null,"effective_from"?: string,"id"?: number,"note"?: string | null,"resolution_hours"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "sla_policies_category_code_fkey"
      columns: ["category_code"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "sla_policies_created_by_fk"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"wards": {
                  Row: {
                    "center_x": number,"center_z": number,"id": number,"name_en": string,"name_hi": string,"name_mr": string,"polygon": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "center_x": number,"center_z": number,"id": number,"name_en": string,"name_hi": string,"name_mr": string,"polygon": NonNullable<Json>
                  }
                  Update: {
                    "center_x"?: number,"center_z"?: number,"id"?: number,"name_en"?: string,"name_hi"?: string,"name_mr"?: string,"polygon"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"workflow_transitions": {
                  Row: {
                    "action": string,"allowed_roles": (string)[],"effects": (string)[],"from_state": Database["public"]['Enums']["request_state"],"guards": (string)[],"requires": (string)[],"to_state": Database["public"]['Enums']["request_state"]
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"allowed_roles": (string)[],"effects"?: (string)[],"from_state": Database["public"]['Enums']["request_state"],"guards"?: (string)[],"requires"?: (string)[],"to_state": Database["public"]['Enums']["request_state"]
                  }
                  Update: {
                    "action"?: string,"allowed_roles"?: (string)[],"effects"?: (string)[],"from_state"?: Database["public"]['Enums']["request_state"],"guards"?: (string)[],"requires"?: (string)[],"to_state"?: Database["public"]['Enums']["request_state"]
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "_action_label":
{ Args: { "a": string }; Returns: string
                           },
"_actor_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_can_see":
{ Args: { "r": Omit<Database["public"]['Tables']["requests"]['Row'], Database["public"]['Tables']["requests"]['ComputedFields']> }; Returns: boolean
                           },
"_channel":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["channel"]
                           },
"_demo_uid":
{ Args: { "p_handle": string }; Returns: string
                           },
"_deny":
{ Args: { "p_action": string,"p_demo"?: boolean,"p_roles": (string)[] }; Returns: Json
                           },
"_guard":
{ Args: { "g": string,"p": Json,"p_actor": string,"r": Omit<Database["public"]['Tables']["requests"]['Row'], Database["public"]['Tables']["requests"]['ComputedFields']> }; Returns: boolean
                           },
"_guard_message":
{ Args: { "g": string,"p": Json,"r": Omit<Database["public"]['Tables']["requests"]['Row'], Database["public"]['Tables']["requests"]['ComputedFields']> }; Returns: string
                           },
"_in_river":
{ Args: { "p_x": number,"p_z": number }; Returns: boolean
                           },
"_load_scenario":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"_load_scenario_requests":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"_notification_templates":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"_point_in_polygon":
{ Args: { "poly": Json,"px": number,"pz": number }; Returns: boolean
                           },
"_polyline_dist":
{ Args: { "p_pts": Json,"p_x": number,"p_z": number }; Returns: number
                           },
"_refusal":
{ Args: { "p_action": string,"p_actor": string,"p_channel": Database["public"]['Enums']["channel"],"p_code": string,"p_message": string,"p_payload"?: Json,"p_request": string,"p_role": string,"p_state": Database["public"]['Enums']["request_state"] }; Returns: Json
                           },
"_role_label":
{ Args: { "r": string }; Returns: string
                           },
"_state_label":
{ Args: { "s": Database["public"]['Enums']["request_state"] }; Returns: string
                           },
"_sweep":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"_timeline":
{ Args: { "p_private": boolean,"r": Omit<Database["public"]['Tables']["requests"]['Row'], Database["public"]['Tables']["requests"]['ComputedFields']> }; Returns: Json
                           },
"_transition":
{ Args: { "p_action": string,"p_actor": string,"p_channel": Database["public"]['Enums']["channel"],"p_expected": Database["public"]['Enums']["request_state"],"p_payload": Json,"p_request_id": string,"p_role": string,"p_sugg": string }; Returns: Json
                           },
"add_staff_note":
{ Args: { "p_body": string,"p_request_id": string }; Returns: Json
                           },
"append_audit":
{ Args: { "p_action": string,"p_actor_id": string,"p_actor_role": string,"p_channel": Database["public"]['Enums']["channel"],"p_code"?: string,"p_from": Database["public"]['Enums']["request_state"],"p_outcome": Database["public"]['Enums']["audit_outcome"],"p_payload"?: Json,"p_reason"?: string,"p_request_id": string,"p_to": Database["public"]['Enums']["request_state"] }; Returns: number
                           },
"attach_photo":
{ Args: { "p_kind": string,"p_request_id": string,"p_storage_path": string }; Returns: Json
                           },
"audit_hash":
{ Args: { "e": Omit<Database["public"]['Tables']["audit_events"]['Row'], Database["public"]['Tables']["audit_events"]['ComputedFields']> }; Returns: string
                           },
"create_request":
{ Args: { "p": Json }; Returns: Json
                           },
"decide_suggestion":
{ Args: { "p_decision": string,"p_edited_payload"?: Json,"p_id": string }; Returns: Json
                           },
"locate_point":
{ Args: { "p_x": number,"p_z": number }; Returns: Json
                           },
"mark_read":
{ Args: { "p_notification_id"?: string }; Returns: number
                           },
"my_department":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_request_timeline":
{ Args: { "p_request_id": string }; Returns: Json
                           },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: Database["public"]['Enums']["app_role"]
                           },
"notify":
{ Args: { "p_extra"?: string,"p_kind": string,"p_request": string,"p_user": string }; Returns: undefined
                           },
"notify_role":
{ Args: { "p_extra"?: string,"p_kind": string,"p_request": string,"p_role": Database["public"]['Enums']["app_role"] }; Returns: undefined
                           },
"now_sim":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"preview_deadline":
{ Args: { "p_category_code": string,"p_request_id": string }; Returns: string
                           },
"public_markers":
{ Args: Record<PropertyKey, never>; Returns: {
              "age_hours": number,"category_code": string,"escalation_level": number,"sla_status": string,"state": Database["public"]['Enums']["request_state"],"ward_id": number,"x": number,"z": number
            }[]
                           },
"reset_demo":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"resolve_landmark":
{ Args: { "p_query": string,"p_ward_hint"?: number }; Returns: Json
                           },
"run_escalation_sweep":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"send_citizen_update":
{ Args: { "p_ai_suggestion_id"?: string,"p_body": string,"p_request_id": string }; Returns: Json
                           },
"set_ai_offline":
{ Args: { "p_offline": boolean }; Returns: Json
                           },
"set_ai_writer_password":
{ Args: { "p_password": string }; Returns: undefined
                           },
"sla_ratio":
{ Args: { "r": Omit<Database["public"]['Tables']["requests"]['Row'], Database["public"]['Tables']["requests"]['ComputedFields']> }; Returns: number
                           },
"sla_status":
{ Args: { "p_request_id": string }; Returns: string
                           },
"sla_status_of":
{ Args: { "r": Omit<Database["public"]['Tables']["requests"]['Row'], Database["public"]['Tables']["requests"]['ComputedFields']> }; Returns: string
                           },
"tamper_demo":
{ Args: { "p_event_id": number }; Returns: Json
                           },
"time_machine_advance":
{ Args: { "p_seconds": number }; Returns: Json
                           },
"track_request":
{ Args: { "p_phone_last4": string,"p_ticket_no": string }; Returns: Json
                           },
"transition_request":
{ Args: { "p_action": string,"p_ai_suggestion_id"?: string,"p_channel"?: Database["public"]['Enums']["channel"],"p_expected_state": Database["public"]['Enums']["request_state"],"p_payload"?: Json,"p_request_id": string }; Returns: Json
                           },
"update_my_profile":
{ Args: { "p_language"?: string,"p_large_text"?: boolean,"p_phone"?: string }; Returns: Json
                           },
"update_sla_policy":
{ Args: { "p_category_code": string,"p_hours": number,"p_note"?: string }; Returns: Json
                           },
"verify_audit_chain":
{ Args: Record<PropertyKey, never>; Returns: Json
                           }
          }
          Enums: {
            "app_role": "citizen"|"officer"|"dept_head"|"manager"|"commissioner","audit_outcome": "accepted"|"refused","channel": "web"|"voice"|"staff"|"system"|"api","request_state": "SUBMITTED"|"TRIAGED"|"ASSIGNED"|"IN_PROGRESS"|"NEEDS_INFO"|"RESOLVED"|"REOPENED"|"CLOSED"|"REJECTED"
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
  "public": {
          Enums: {
            "app_role": ["citizen", "officer", "dept_head", "manager", "commissioner"],"audit_outcome": ["accepted", "refused"],"channel": ["web", "voice", "staff", "system", "api"],"request_state": ["SUBMITTED", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "NEEDS_INFO", "RESOLVED", "REOPENED", "CLOSED", "REJECTED"]
          }
        }
} as const
