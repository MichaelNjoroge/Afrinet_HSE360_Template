export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      actions: {
        Row: {
          action_type: string
          approver_id: string | null
          closure_evidence: string | null
          completed_on: string | null
          created_at: string
          created_by: string
          due_date: string
          effectiveness_review: string | null
          effectiveness_status: string | null
          evidence: string | null
          id: string
          owner_id: string | null
          preventive_action: string | null
          priority: string
          source_record_id: string | null
          source_reference: string | null
          source_type: string
          status: string
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          action_type?: string
          approver_id?: string | null
          closure_evidence?: string | null
          completed_on?: string | null
          created_at?: string
          created_by: string
          due_date: string
          effectiveness_review?: string | null
          effectiveness_status?: string | null
          evidence?: string | null
          id?: string
          owner_id?: string | null
          preventive_action?: string | null
          priority: string
          source_record_id?: string | null
          source_reference?: string | null
          source_type: string
          status?: string
          title: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          action_type?: string
          approver_id?: string | null
          closure_evidence?: string | null
          completed_on?: string | null
          created_at?: string
          created_by?: string
          due_date?: string
          effectiveness_review?: string | null
          effectiveness_status?: string | null
          evidence?: string | null
          id?: string
          owner_id?: string | null
          preventive_action?: string | null
          priority?: string
          source_record_id?: string | null
          source_reference?: string | null
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          approval_level: number
          approver_id: string
          created_at: string
          decided_at: string | null
          decision_note: string | null
          id: string
          module: string
          record_id: string
          request_note: string | null
          requested_by: string
          status: string
          updated_at: string
        }
        Insert: {
          approval_level?: number
          approver_id: string
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          id?: string
          module: string
          record_id: string
          request_note?: string | null
          requested_by: string
          status?: string
          updated_at?: string
        }
        Update: {
          approval_level?: number
          approver_id?: string
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          id?: string
          module?: string
          record_id?: string
          request_note?: string | null
          requested_by?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          audit_id: string
          created_at: string
          executive_summary: string
          findings: string
          generated_by: string
          id: string
          recommendations: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          audit_id: string
          created_at?: string
          executive_summary: string
          findings: string
          generated_by?: string
          id?: string
          recommendations: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          audit_id?: string
          created_at?: string
          executive_summary?: string
          findings?: string
          generated_by?: string
          id?: string
          recommendations?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_reports_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "audits"
            referencedColumns: ["id"]
          },
        ]
      }
      audits: {
        Row: {
          area: string
          audit_number: string
          audit_team: string | null
          audit_type: string
          closure_details: string | null
          completed_on: string | null
          created_at: string
          created_by: string
          department: string | null
          department_id: string | null
          findings_summary: string | null
          id: string
          issued_on: string | null
          lead_auditor: string
          non_conformities: string | null
          notes: string | null
          opportunities_for_improvement: string | null
          scheduled_on: string
          scope: string | null
          score: number | null
          site: string
          site_id: string | null
          status: string
          title: string
          updated_at: string
          verification_evidence: string | null
        }
        Insert: {
          area: string
          audit_number: string
          audit_team?: string | null
          audit_type: string
          closure_details?: string | null
          completed_on?: string | null
          created_at?: string
          created_by: string
          department?: string | null
          department_id?: string | null
          findings_summary?: string | null
          id?: string
          issued_on?: string | null
          lead_auditor: string
          non_conformities?: string | null
          notes?: string | null
          opportunities_for_improvement?: string | null
          scheduled_on: string
          scope?: string | null
          score?: number | null
          site?: string
          site_id?: string | null
          status?: string
          title: string
          updated_at?: string
          verification_evidence?: string | null
        }
        Update: {
          area?: string
          audit_number?: string
          audit_team?: string | null
          audit_type?: string
          closure_details?: string | null
          completed_on?: string | null
          created_at?: string
          created_by?: string
          department?: string | null
          department_id?: string | null
          findings_summary?: string | null
          id?: string
          issued_on?: string | null
          lead_auditor?: string
          non_conformities?: string | null
          notes?: string | null
          opportunities_for_improvement?: string | null
          scheduled_on?: string
          scope?: string | null
          score?: number | null
          site?: string
          site_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          verification_evidence?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audits_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audits_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      company_report_settings: {
        Row: {
          company_name: string
          created_at: string
          default_timezone: string
          id: string
          letterhead_path: string | null
          report_footer: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          company_name?: string
          created_at?: string
          default_timezone?: string
          id?: string
          letterhead_path?: string | null
          report_footer?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          default_timezone?: string
          id?: string
          letterhead_path?: string | null
          report_footer?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      competency_records: {
        Row: {
          assessed_on: string | null
          assessor: string | null
          competency_name: string
          created_at: string
          created_by: string
          current_level: number
          employee_id: string
          evidence: string | null
          expires_on: string | null
          id: string
          required_level: number
          status: string
          updated_at: string
        }
        Insert: {
          assessed_on?: string | null
          assessor?: string | null
          competency_name: string
          created_at?: string
          created_by: string
          current_level: number
          employee_id: string
          evidence?: string | null
          expires_on?: string | null
          id?: string
          required_level: number
          status?: string
          updated_at?: string
        }
        Update: {
          assessed_on?: string | null
          assessor?: string | null
          competency_name?: string
          created_at?: string
          created_by?: string
          current_level?: number
          employee_id?: string
          evidence?: string | null
          expires_on?: string | null
          id?: string
          required_level?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "competency_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competency_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_risk_assessments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assessed_by: string
          contractor_id: string
          controls: string
          created_at: string
          hazards: string
          id: string
          initial_risk_score: number
          reference: string
          residual_risk_score: number
          status: string
          task_description: string
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assessed_by?: string
          contractor_id: string
          controls: string
          created_at?: string
          hazards: string
          id?: string
          initial_risk_score: number
          reference: string
          residual_risk_score: number
          status?: string
          task_description: string
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assessed_by?: string
          contractor_id?: string
          controls?: string
          created_at?: string
          hazards?: string
          id?: string
          initial_risk_score?: number
          reference?: string
          residual_risk_score?: number
          status?: string
          task_description?: string
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contractor_risk_assessments_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          approval_status: string
          company_name: string
          contact_email: string | null
          contact_person: string
          contact_phone: string | null
          created_at: string
          created_by: string
          hse_score: number | null
          id: string
          insurance_expiry: string | null
          insurance_provider: string | null
          owner_id: string | null
          performance_notes: string | null
          permit_expiry: string | null
          permit_reference: string | null
          reference: string
          scope_of_work: string
          site_id: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: string
          company_name: string
          contact_email?: string | null
          contact_person: string
          contact_phone?: string | null
          created_at?: string
          created_by: string
          hse_score?: number | null
          id?: string
          insurance_expiry?: string | null
          insurance_provider?: string | null
          owner_id?: string | null
          performance_notes?: string | null
          permit_expiry?: string | null
          permit_reference?: string | null
          reference: string
          scope_of_work: string
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: string
          company_name?: string
          contact_email?: string | null
          contact_person?: string
          contact_phone?: string | null
          created_at?: string
          created_by?: string
          hse_score?: number | null
          id?: string
          insurance_expiry?: string | null
          insurance_provider?: string | null
          owner_id?: string | null
          performance_notes?: string | null
          permit_expiry?: string | null
          permit_reference?: string | null
          reference?: string
          scope_of_work?: string
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractors_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractors_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractors_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          site_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      emergency_response_records: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          lessons_learned: string | null
          location: string | null
          occurred_at: string
          outcome: string | null
          participants: number | null
          performance_rating: string | null
          record_type: string
          reference: string | null
          report_content: string | null
          response_time_minutes: number | null
          scenario: string
          signatories: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          lessons_learned?: string | null
          location?: string | null
          occurred_at: string
          outcome?: string | null
          participants?: number | null
          performance_rating?: string | null
          record_type?: string
          reference?: string | null
          report_content?: string | null
          response_time_minutes?: number | null
          scenario: string
          signatories?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          lessons_learned?: string | null
          location?: string | null
          occurred_at?: string
          outcome?: string | null
          participants?: number | null
          performance_rating?: string | null
          record_type?: string
          reference?: string | null
          report_content?: string | null
          response_time_minutes?: number | null
          scenario?: string
          signatories?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          account_status: string
          approval_level: number
          avatar_path: string | null
          created_at: string
          department: string | null
          email: string | null
          employment_status: string
          full_name: string
          id: string
          job_title: string | null
          manager_employee_id: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          account_status?: string
          approval_level?: number
          avatar_path?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          employment_status?: string
          full_name: string
          id?: string
          job_title?: string | null
          manager_employee_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          account_status?: string
          approval_level?: number
          avatar_path?: string | null
          created_at?: string
          department?: string | null
          email?: string | null
          employment_status?: string
          full_name?: string
          id?: string
          job_title?: string | null
          manager_employee_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_employee_id_fkey"
            columns: ["manager_employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
        ]
      }
      environmental_aspects: {
        Row: {
          action_due_date: string | null
          activity: string
          additional_controls: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          aspect: string
          closure_evidence: string | null
          condition: string
          corrective_actions: string | null
          created_at: string
          created_by: string
          department_id: string | null
          existing_controls: string | null
          id: string
          immediate_action: string | null
          impact: string
          investigation_findings: string | null
          lessons_learned: string | null
          likelihood: number
          owner_id: string | null
          preventive_actions: string | null
          reference: string
          responsible_person_id: string | null
          review_date: string
          root_cause: string | null
          severity: number
          significance_rating: string | null
          significance_score: number | null
          site_id: string | null
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          action_due_date?: string | null
          activity: string
          additional_controls?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          aspect: string
          closure_evidence?: string | null
          condition?: string
          corrective_actions?: string | null
          created_at?: string
          created_by: string
          department_id?: string | null
          existing_controls?: string | null
          id?: string
          immediate_action?: string | null
          impact: string
          investigation_findings?: string | null
          lessons_learned?: string | null
          likelihood: number
          owner_id?: string | null
          preventive_actions?: string | null
          reference: string
          responsible_person_id?: string | null
          review_date: string
          root_cause?: string | null
          severity: number
          significance_rating?: string | null
          significance_score?: number | null
          site_id?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          action_due_date?: string | null
          activity?: string
          additional_controls?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          aspect?: string
          closure_evidence?: string | null
          condition?: string
          corrective_actions?: string | null
          created_at?: string
          created_by?: string
          department_id?: string | null
          existing_controls?: string | null
          id?: string
          immediate_action?: string | null
          impact?: string
          investigation_findings?: string | null
          lessons_learned?: string | null
          likelihood?: number
          owner_id?: string | null
          preventive_actions?: string | null
          reference?: string
          responsible_person_id?: string | null
          review_date?: string
          root_cause?: string | null
          severity?: number
          significance_rating?: string | null
          significance_score?: number | null
          site_id?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "environmental_aspects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "environmental_aspects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "environmental_aspects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "environmental_aspects_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      environmental_emission_records: {
        Row: {
          action_due_date: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          calculation_method: string | null
          corrective_actions: string | null
          created_at: string
          created_by: string
          emission_source: string
          id: string
          investigation_findings: string | null
          notes: string | null
          period_end: string
          period_start: string
          preventive_actions: string | null
          quantity: number
          responsible_person_id: string | null
          root_cause: string | null
          scope: string
          site_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          action_due_date?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          calculation_method?: string | null
          corrective_actions?: string | null
          created_at?: string
          created_by: string
          emission_source: string
          id?: string
          investigation_findings?: string | null
          notes?: string | null
          period_end: string
          period_start: string
          preventive_actions?: string | null
          quantity: number
          responsible_person_id?: string | null
          root_cause?: string | null
          scope: string
          site_id?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          action_due_date?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          calculation_method?: string | null
          corrective_actions?: string | null
          created_at?: string
          created_by?: string
          emission_source?: string
          id?: string
          investigation_findings?: string | null
          notes?: string | null
          period_end?: string
          period_start?: string
          preventive_actions?: string | null
          quantity?: number
          responsible_person_id?: string | null
          root_cause?: string | null
          scope?: string
          site_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "environmental_emission_records_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      environmental_resource_records: {
        Row: {
          action_due_date: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          corrective_actions: string | null
          cost: number | null
          created_at: string
          created_by: string
          id: string
          investigation_findings: string | null
          notes: string | null
          period_end: string
          period_start: string
          preventive_actions: string | null
          quantity: number
          resource_type: string
          responsible_person_id: string | null
          root_cause: string | null
          site_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          action_due_date?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          corrective_actions?: string | null
          cost?: number | null
          created_at?: string
          created_by: string
          id?: string
          investigation_findings?: string | null
          notes?: string | null
          period_end: string
          period_start: string
          preventive_actions?: string | null
          quantity: number
          resource_type: string
          responsible_person_id?: string | null
          root_cause?: string | null
          site_id?: string | null
          unit: string
          updated_at?: string
        }
        Update: {
          action_due_date?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          corrective_actions?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string
          id?: string
          investigation_findings?: string | null
          notes?: string | null
          period_end?: string
          period_start?: string
          preventive_actions?: string | null
          quantity?: number
          resource_type?: string
          responsible_person_id?: string | null
          root_cause?: string | null
          site_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "environmental_resource_records_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      environmental_waste_records: {
        Row: {
          action_due_date: string | null
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          corrective_actions: string | null
          created_at: string
          created_by: string
          disposal_method: string
          disposal_reference: string | null
          id: string
          investigation_findings: string | null
          notes: string | null
          preventive_actions: string | null
          quantity: number
          recorded_on: string
          responsible_person_id: string | null
          root_cause: string | null
          site_id: string | null
          transporter: string | null
          unit: string
          updated_at: string
          waste_category: string
          waste_type: string
        }
        Insert: {
          action_due_date?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          corrective_actions?: string | null
          created_at?: string
          created_by: string
          disposal_method: string
          disposal_reference?: string | null
          id?: string
          investigation_findings?: string | null
          notes?: string | null
          preventive_actions?: string | null
          quantity: number
          recorded_on: string
          responsible_person_id?: string | null
          root_cause?: string | null
          site_id?: string | null
          transporter?: string | null
          unit: string
          updated_at?: string
          waste_category: string
          waste_type: string
        }
        Update: {
          action_due_date?: string | null
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          corrective_actions?: string | null
          created_at?: string
          created_by?: string
          disposal_method?: string
          disposal_reference?: string | null
          id?: string
          investigation_findings?: string | null
          notes?: string | null
          preventive_actions?: string | null
          quantity?: number
          recorded_on?: string
          responsible_person_id?: string | null
          root_cause?: string | null
          site_id?: string | null
          transporter?: string | null
          unit?: string
          updated_at?: string
          waste_category?: string
          waste_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "environmental_waste_records_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_attachments: {
        Row: {
          caption: string | null
          created_at: string
          file_name: string
          file_size: number
          id: string
          mime_type: string
          module: string
          record_id: string
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_name: string
          file_size: number
          id?: string
          mime_type: string
          module: string
          record_id: string
          storage_path: string
          uploaded_by?: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_name?: string
          file_size?: number
          id?: string
          mime_type?: string
          module?: string
          record_id?: string
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: []
      }
      generated_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          generated_by: string
          id: string
          module: string
          record_id: string | null
          report_data: Json
          report_number: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          generated_by?: string
          id?: string
          module: string
          record_id?: string | null
          report_data?: Json
          report_number: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          generated_by?: string
          id?: string
          module?: string
          record_id?: string | null
          report_data?: Json
          report_number?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      hazards: {
        Row: {
          additional_controls: string | null
          closure_evidence: string | null
          created_at: string
          department: string
          department_id: string | null
          description: string
          existing_controls: string | null
          id: string
          likelihood: number
          location: string
          owner_id: string | null
          reference: string
          reported_by: string
          risk_rating: string | null
          risk_score: number | null
          severity: number
          site: string
          site_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          additional_controls?: string | null
          closure_evidence?: string | null
          created_at?: string
          department: string
          department_id?: string | null
          description: string
          existing_controls?: string | null
          id?: string
          likelihood: number
          location: string
          owner_id?: string | null
          reference: string
          reported_by: string
          risk_rating?: string | null
          risk_score?: number | null
          severity: number
          site?: string
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          additional_controls?: string | null
          closure_evidence?: string | null
          created_at?: string
          department?: string
          department_id?: string | null
          description?: string
          existing_controls?: string | null
          id?: string
          likelihood?: number
          location?: string
          owner_id?: string | null
          reference?: string
          reported_by?: string
          risk_rating?: string | null
          risk_score?: number | null
          severity?: number
          site?: string
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hazards_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hazards_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hazards_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hazards_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      hse_document_versions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          change_summary: string | null
          created_at: string
          document_id: string
          effective_date: string | null
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          status: string
          storage_path: string
          uploaded_by: string
          version_number: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          change_summary?: string | null
          created_at?: string
          document_id: string
          effective_date?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          status?: string
          storage_path: string
          uploaded_by: string
          version_number: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          change_summary?: string | null
          created_at?: string
          document_id?: string
          effective_date?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          status?: string
          storage_path?: string
          uploaded_by?: string
          version_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "hse_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "hse_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      hse_documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          current_version: string
          department_id: string | null
          document_number: string
          document_type: string
          id: string
          owner_id: string | null
          review_date: string
          site_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          current_version?: string
          department_id?: string | null
          document_number: string
          document_type: string
          id?: string
          owner_id?: string | null
          review_date: string
          site_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          current_version?: string
          department_id?: string | null
          document_number?: string
          document_type?: string
          id?: string
          owner_id?: string | null
          review_date?: string
          site_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hse_documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hse_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hse_documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hse_documents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      hse_objective_monthly_progress: {
        Row: {
          actual_value: number | null
          created_at: string
          id: string
          month: number
          notes: string | null
          objective_id: string
          target_value: number | null
          updated_at: string
          updated_by: string | null
          year: number
        }
        Insert: {
          actual_value?: number | null
          created_at?: string
          id?: string
          month: number
          notes?: string | null
          objective_id: string
          target_value?: number | null
          updated_at?: string
          updated_by?: string | null
          year: number
        }
        Update: {
          actual_value?: number | null
          created_at?: string
          id?: string
          month?: number
          notes?: string | null
          objective_id?: string
          target_value?: number | null
          updated_at?: string
          updated_by?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "hse_objective_monthly_progress_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "hse_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      hse_objectives: {
        Row: {
          achievement_percent: number | null
          baseline: number
          created_at: string
          created_by: string
          current_performance: number
          direction: string
          id: string
          kpi: string
          notes: string | null
          objective: string
          owner_id: string | null
          rag_status: string | null
          reference: string
          review_date: string
          status: string
          target: number
          updated_at: string
        }
        Insert: {
          achievement_percent?: number | null
          baseline: number
          created_at?: string
          created_by: string
          current_performance: number
          direction?: string
          id?: string
          kpi: string
          notes?: string | null
          objective: string
          owner_id?: string | null
          rag_status?: string | null
          reference: string
          review_date: string
          status?: string
          target: number
          updated_at?: string
        }
        Update: {
          achievement_percent?: number | null
          baseline?: number
          created_at?: string
          created_by?: string
          current_performance?: number
          direction?: string
          id?: string
          kpi?: string
          notes?: string | null
          objective?: string
          owner_id?: string | null
          rag_status?: string | null
          reference?: string
          review_date?: string
          status?: string
          target?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hse_objectives_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hse_objectives_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          action_due_date: string | null
          approved_at: string | null
          approved_by: string | null
          closure_evidence: string | null
          created_at: string
          department: string | null
          department_id: string | null
          description: string
          id: string
          immediate_action: string | null
          incident_type: string
          investigation_findings: string | null
          lessons_learned: string | null
          location: string
          occurred_at: string
          persons_involved: string | null
          reference: string
          reported_by: string
          reporter_name: string | null
          responsible_person_id: string | null
          root_cause: string | null
          severity: string
          site: string
          site_id: string | null
          status: string
          title: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          action_due_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          closure_evidence?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          description: string
          id?: string
          immediate_action?: string | null
          incident_type: string
          investigation_findings?: string | null
          lessons_learned?: string | null
          location: string
          occurred_at: string
          persons_involved?: string | null
          reference: string
          reported_by: string
          reporter_name?: string | null
          responsible_person_id?: string | null
          root_cause?: string | null
          severity: string
          site?: string
          site_id?: string | null
          status?: string
          title: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          action_due_date?: string | null
          approved_at?: string | null
          approved_by?: string | null
          closure_evidence?: string | null
          created_at?: string
          department?: string | null
          department_id?: string | null
          description?: string
          id?: string
          immediate_action?: string | null
          incident_type?: string
          investigation_findings?: string | null
          lessons_learned?: string | null
          location?: string
          occurred_at?: string
          persons_involved?: string | null
          reference?: string
          reported_by?: string
          reporter_name?: string | null
          responsible_person_id?: string | null
          root_cause?: string | null
          severity?: string
          site?: string
          site_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_responsible_person_id_fkey"
            columns: ["responsible_person_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_responsible_person_id_fkey"
            columns: ["responsible_person_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incidents_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_checklist_items: {
        Row: {
          action_id: string | null
          created_at: string
          created_by: string
          id: string
          inspection_id: string
          item_order: number
          observation: string | null
          requirement: string
          result: string
          updated_at: string
        }
        Insert: {
          action_id?: string | null
          created_at?: string
          created_by: string
          id?: string
          inspection_id: string
          item_order?: number
          observation?: string | null
          requirement: string
          result?: string
          updated_at?: string
        }
        Update: {
          action_id?: string | null
          created_at?: string
          created_by?: string
          id?: string
          inspection_id?: string
          item_order?: number
          observation?: string | null
          requirement?: string
          result?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspection_checklist_items_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspection_checklist_items_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspection_reports: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          executive_summary: string
          findings: string
          generated_by: string
          id: string
          inspection_id: string
          recommendations: string
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          executive_summary: string
          findings: string
          generated_by?: string
          id?: string
          inspection_id: string
          recommendations: string
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          executive_summary?: string
          findings?: string
          generated_by?: string
          id?: string
          inspection_id?: string
          recommendations?: string
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "inspection_reports_inspection_id_fkey"
            columns: ["inspection_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id"]
          },
        ]
      }
      inspections: {
        Row: {
          area: string
          attendees: string | null
          completion_notes: string | null
          created_at: string
          created_by: string
          department: string
          department_id: string | null
          findings: string | null
          id: string
          inspection_type: string
          inspector_id: string | null
          reference: string
          required_actions: string | null
          scheduled_on: string
          site: string
          site_id: string | null
          status: string
          summary: string | null
          title: string
          updated_at: string
          visit_date: string | null
        }
        Insert: {
          area: string
          attendees?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by: string
          department: string
          department_id?: string | null
          findings?: string | null
          id?: string
          inspection_type: string
          inspector_id?: string | null
          reference: string
          required_actions?: string | null
          scheduled_on: string
          site?: string
          site_id?: string | null
          status?: string
          summary?: string | null
          title: string
          updated_at?: string
          visit_date?: string | null
        }
        Update: {
          area?: string
          attendees?: string | null
          completion_notes?: string | null
          created_at?: string
          created_by?: string
          department?: string
          department_id?: string | null
          findings?: string | null
          id?: string
          inspection_type?: string
          inspector_id?: string | null
          reference?: string
          required_actions?: string | null
          scheduled_on?: string
          site?: string
          site_id?: string | null
          status?: string
          summary?: string | null
          title?: string
          updated_at?: string
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inspections_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_requirements: {
        Row: {
          authority: string
          category: string
          compliance_status: string
          created_at: string
          created_by: string
          department_id: string | null
          evidence: string | null
          id: string
          legal_obligation: string
          owner_id: string | null
          reference: string
          review_date: string
          site_id: string | null
          updated_at: string
        }
        Insert: {
          authority: string
          category: string
          compliance_status?: string
          created_at?: string
          created_by: string
          department_id?: string | null
          evidence?: string | null
          id?: string
          legal_obligation: string
          owner_id?: string | null
          reference: string
          review_date: string
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          authority?: string
          category?: string
          compliance_status?: string
          created_at?: string
          created_by?: string
          department_id?: string | null
          evidence?: string | null
          id?: string
          legal_obligation?: string
          owner_id?: string | null
          reference?: string
          review_date?: string
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "legal_requirements_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_requirements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_requirements_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legal_requirements_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      management_reviews: {
        Row: {
          attendees: string | null
          chairperson_id: string | null
          created_at: string
          created_by: string
          decisions: string | null
          executive_summary: string | null
          id: string
          meeting_date: string
          metrics_snapshot: Json
          period_end: string
          period_start: string
          reference: string
          site_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attendees?: string | null
          chairperson_id?: string | null
          created_at?: string
          created_by: string
          decisions?: string | null
          executive_summary?: string | null
          id?: string
          meeting_date: string
          metrics_snapshot?: Json
          period_end: string
          period_start: string
          reference: string
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attendees?: string | null
          chairperson_id?: string | null
          created_at?: string
          created_by?: string
          decisions?: string | null
          executive_summary?: string | null
          id?: string
          meeting_date?: string
          metrics_snapshot?: Json
          period_end?: string
          period_start?: string
          reference?: string
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_reviews_chairperson_id_fkey"
            columns: ["chairperson_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_reviews_chairperson_id_fkey"
            columns: ["chairperson_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "management_reviews_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      near_misses: {
        Row: {
          action_due_date: string | null
          closure_evidence: string | null
          created_at: string
          department: string
          department_id: string | null
          description: string
          id: string
          immediate_controls: string | null
          investigation_findings: string | null
          location: string
          occurred_at: string
          potential_severity: string
          reference: string
          reported_by: string
          responsible_person_id: string | null
          root_cause: string | null
          site: string
          site_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          action_due_date?: string | null
          closure_evidence?: string | null
          created_at?: string
          department: string
          department_id?: string | null
          description: string
          id?: string
          immediate_controls?: string | null
          investigation_findings?: string | null
          location: string
          occurred_at: string
          potential_severity: string
          reference: string
          reported_by: string
          responsible_person_id?: string | null
          root_cause?: string | null
          site?: string
          site_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          action_due_date?: string | null
          closure_evidence?: string | null
          created_at?: string
          department?: string
          department_id?: string | null
          description?: string
          id?: string
          immediate_controls?: string | null
          investigation_findings?: string | null
          location?: string
          occurred_at?: string
          potential_severity?: string
          reference?: string
          reported_by?: string
          responsible_person_id?: string | null
          root_cause?: string | null
          site?: string
          site_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "near_misses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "near_misses_responsible_person_id_fkey"
            columns: ["responsible_person_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "near_misses_responsible_person_id_fkey"
            columns: ["responsible_person_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "near_misses_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          alert_type: string
          created_at: string
          due_date: string | null
          id: string
          message: string
          read_at: string | null
          recipient_id: string
          source_module: string | null
          source_record_id: string | null
          title: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          due_date?: string | null
          id?: string
          message: string
          read_at?: string | null
          recipient_id: string
          source_module?: string | null
          source_record_id?: string | null
          title: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          due_date?: string | null
          id?: string
          message?: string
          read_at?: string | null
          recipient_id?: string
          source_module?: string | null
          source_record_id?: string | null
          title?: string
        }
        Relationships: []
      }
      permits_to_work: {
        Row: {
          approval_notes: string | null
          approved_at: string | null
          approved_by: string | null
          closed_at: string | null
          closed_by: string | null
          closure_notes: string | null
          contractor_id: string
          controls: string
          created_at: string
          created_by: string
          hazards: string
          id: string
          issued_at: string | null
          issued_by: string | null
          permit_number: string
          requested_at: string | null
          requested_by: string | null
          risk_assessment_id: string
          status: string
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          updated_at: string
          valid_from: string
          valid_until: string
          work_location: string
          work_scope: string
          workers: string | null
        }
        Insert: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closure_notes?: string | null
          contractor_id: string
          controls: string
          created_at?: string
          created_by?: string
          hazards: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          permit_number: string
          requested_at?: string | null
          requested_by?: string | null
          risk_assessment_id: string
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string
          valid_from: string
          valid_until: string
          work_location: string
          work_scope: string
          workers?: string | null
        }
        Update: {
          approval_notes?: string | null
          approved_at?: string | null
          approved_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          closure_notes?: string | null
          contractor_id?: string
          controls?: string
          created_at?: string
          created_by?: string
          hazards?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          permit_number?: string
          requested_at?: string | null
          requested_by?: string | null
          risk_assessment_id?: string
          status?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string
          valid_from?: string
          valid_until?: string
          work_location?: string
          work_scope?: string
          workers?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permits_to_work_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permits_to_work_risk_assessment_id_fkey"
            columns: ["risk_assessment_id"]
            isOneToOne: false
            referencedRelation: "contractor_risk_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      ppe_inspections: {
        Row: {
          corrective_action: string | null
          created_at: string
          created_by: string
          findings: string | null
          id: string
          inspected_on: string
          inspector_id: string | null
          issuance_id: string
          next_inspection_on: string | null
          result: string
          updated_at: string
        }
        Insert: {
          corrective_action?: string | null
          created_at?: string
          created_by: string
          findings?: string | null
          id?: string
          inspected_on: string
          inspector_id?: string | null
          issuance_id: string
          next_inspection_on?: string | null
          result: string
          updated_at?: string
        }
        Update: {
          corrective_action?: string | null
          created_at?: string
          created_by?: string
          findings?: string | null
          id?: string
          inspected_on?: string
          inspector_id?: string | null
          issuance_id?: string
          next_inspection_on?: string | null
          result?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppe_inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppe_inspections_inspector_id_fkey"
            columns: ["inspector_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppe_inspections_issuance_id_fkey"
            columns: ["issuance_id"]
            isOneToOne: false
            referencedRelation: "ppe_issuances"
            referencedColumns: ["id"]
          },
        ]
      }
      ppe_issuances: {
        Row: {
          condition: string
          created_at: string
          created_by: string
          employee_id: string
          expected_replacement_on: string | null
          id: string
          issued_by: string | null
          issued_on: string
          notes: string | null
          ppe_item: string
          quantity: number
          reference: string
          replaced_on: string | null
          serial_number: string | null
          site_id: string | null
          updated_at: string
        }
        Insert: {
          condition?: string
          created_at?: string
          created_by: string
          employee_id: string
          expected_replacement_on?: string | null
          id?: string
          issued_by?: string | null
          issued_on: string
          notes?: string | null
          ppe_item: string
          quantity?: number
          reference: string
          replaced_on?: string | null
          serial_number?: string | null
          site_id?: string | null
          updated_at?: string
        }
        Update: {
          condition?: string
          created_at?: string
          created_by?: string
          employee_id?: string
          expected_replacement_on?: string | null
          id?: string
          issued_by?: string | null
          issued_on?: string
          notes?: string | null
          ppe_item?: string
          quantity?: number
          reference?: string
          replaced_on?: string | null
          serial_number?: string | null
          site_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppe_issuances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppe_issuances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppe_issuances_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppe_issuances_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppe_issuances_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          created_at: string
          department: string | null
          email: string
          employment_status: string
          full_name: string
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          created_at?: string
          department?: string | null
          email: string
          employment_status?: string
          full_name: string
          id: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          created_at?: string
          department?: string | null
          email?: string
          employment_status?: string
          full_name?: string
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      public_endpoint_rate_limits: {
        Row: {
          created_at: string
          key_hash: string
          request_count: number
          route: string
          updated_at: string
          window_started_at: string
        }
        Insert: {
          created_at?: string
          key_hash: string
          request_count?: number
          route: string
          updated_at?: string
          window_started_at: string
        }
        Update: {
          created_at?: string
          key_hash?: string
          request_count?: number
          route?: string
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      report_subscriptions: {
        Row: {
          cadence: string
          created_at: string
          created_by: string
          failure_count: number
          hour_utc: number
          id: string
          is_active: boolean
          last_error: string | null
          last_run_at: string | null
          module: string
          next_run_at: string
          recipients: string[]
          timezone: string
          updated_at: string
          weekday: number | null
        }
        Insert: {
          cadence?: string
          created_at?: string
          created_by?: string
          failure_count?: number
          hour_utc?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_run_at?: string | null
          module: string
          next_run_at?: string
          recipients: string[]
          timezone?: string
          updated_at?: string
          weekday?: number | null
        }
        Update: {
          cadence?: string
          created_at?: string
          created_by?: string
          failure_count?: number
          hour_utc?: number
          id?: string
          is_active?: boolean
          last_error?: string | null
          last_run_at?: string | null
          module?: string
          next_run_at?: string
          recipients?: string[]
          timezone?: string
          updated_at?: string
          weekday?: number | null
        }
        Relationships: []
      }
      risk_assessments: {
        Row: {
          activity: string
          additional_controls: string | null
          category: string | null
          consequence: string | null
          created_at: string
          created_by: string
          department: string | null
          department_id: string | null
          existing_controls: string
          hazard: string
          id: string
          initial_rating: string | null
          initial_score: number | null
          likelihood: number
          owner_id: string | null
          people_exposed: string
          reference: string
          residual_likelihood: number
          residual_rating: string | null
          residual_score: number | null
          residual_severity: number
          review_date: string
          severity: number
          site: string
          site_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          activity: string
          additional_controls?: string | null
          category?: string | null
          consequence?: string | null
          created_at?: string
          created_by: string
          department?: string | null
          department_id?: string | null
          existing_controls: string
          hazard: string
          id?: string
          initial_rating?: string | null
          initial_score?: number | null
          likelihood: number
          owner_id?: string | null
          people_exposed: string
          reference: string
          residual_likelihood: number
          residual_rating?: string | null
          residual_score?: number | null
          residual_severity: number
          review_date: string
          severity: number
          site?: string
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          activity?: string
          additional_controls?: string | null
          category?: string | null
          consequence?: string | null
          created_at?: string
          created_by?: string
          department?: string | null
          department_id?: string | null
          existing_controls?: string
          hazard?: string
          id?: string
          initial_rating?: string | null
          initial_score?: number | null
          likelihood?: number
          owner_id?: string | null
          people_exposed?: string
          reference?: string
          residual_likelihood?: number
          residual_rating?: string | null
          residual_score?: number | null
          residual_severity?: number
          review_date?: string
          severity?: number
          site?: string
          site_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_committee_meetings: {
        Row: {
          agenda: string | null
          chairperson: string | null
          created_at: string
          created_by: string | null
          decisions: string | null
          id: string
          location: string | null
          meeting_date: string
          meeting_number: string | null
          minutes: string | null
          next_meeting_at: string | null
          secretary: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agenda?: string | null
          chairperson?: string | null
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          id?: string
          location?: string | null
          meeting_date: string
          meeting_number?: string | null
          minutes?: string | null
          next_meeting_at?: string | null
          secretary?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agenda?: string | null
          chairperson?: string | null
          created_at?: string
          created_by?: string | null
          decisions?: string | null
          id?: string
          location?: string | null
          meeting_date?: string
          meeting_number?: string | null
          minutes?: string | null
          next_meeting_at?: string | null
          secretary?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      safety_committee_signatories: {
        Row: {
          created_at: string
          full_name: string
          id: string
          meeting_id: string
          role_title: string | null
          signatory_position: number
          signature_note: string | null
          signed_at: string | null
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          meeting_id: string
          role_title?: string | null
          signatory_position: number
          signature_note?: string | null
          signed_at?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          meeting_id?: string
          role_title?: string | null
          signatory_position?: number
          signature_note?: string | null
          signed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safety_committee_signatories_meeting_id_fkey"
            columns: ["meeting_id"]
            isOneToOne: false
            referencedRelation: "safety_committee_meetings"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_observations: {
        Row: {
          created_at: string
          department: string
          department_id: string | null
          description: string
          id: string
          immediate_response: string | null
          location: string
          observation_type: string
          observed_at: string
          observed_by: string
          reference: string
          site: string
          site_id: string | null
          status: string
          supervisor_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department: string
          department_id?: string | null
          description: string
          id?: string
          immediate_response?: string | null
          location: string
          observation_type: string
          observed_at: string
          observed_by: string
          reference: string
          site?: string
          site_id?: string | null
          status?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string
          department_id?: string | null
          description?: string
          id?: string
          immediate_response?: string | null
          location?: string
          observation_type?: string
          observed_at?: string
          observed_by?: string
          reference?: string
          site?: string
          site_id?: string | null
          status?: string
          supervisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "safety_observations_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_observations_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_observations_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_observations_supervisor_id_fkey"
            columns: ["supervisor_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          code: string
          county: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          county?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          county?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      training_records: {
        Row: {
          certificate_reference: string | null
          completed_on: string | null
          course_name: string
          created_at: string
          created_by: string
          employee_id: string
          expires_on: string | null
          id: string
          notes: string | null
          provider: string | null
          status: string
          updated_at: string
        }
        Insert: {
          certificate_reference?: string | null
          completed_on?: string | null
          course_name: string
          created_at?: string
          created_by: string
          employee_id: string
          expires_on?: string | null
          id?: string
          notes?: string | null
          provider?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          certificate_reference?: string | null
          completed_on?: string | null
          course_name?: string
          created_at?: string
          created_by?: string
          employee_id?: string
          expires_on?: string | null
          id?: string
          notes?: string | null
          provider?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "v_employee_names"
            referencedColumns: ["id"]
          },
        ]
      }
      user_activity_logs: {
        Row: {
          action: string
          actor_id: string
          context: Json
          created_at: string
          id: string
          module: string
          record_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          context?: Json
          created_at?: string
          id?: string
          module: string
          record_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          context?: Json
          created_at?: string
          id?: string
          module?: string
          record_id?: string | null
        }
        Relationships: []
      }
      user_module_permissions: {
        Row: {
          can_approve: boolean
          can_create: boolean
          can_delete: boolean
          can_edit: boolean
          can_export: boolean
          can_view: boolean
          created_at: string
          granted_by: string | null
          id: string
          module: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          created_at?: string
          granted_by?: string | null
          id?: string
          module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_approve?: boolean
          can_create?: boolean
          can_delete?: boolean
          can_edit?: boolean
          can_export?: boolean
          can_view?: boolean
          created_at?: string
          granted_by?: string | null
          id?: string
          module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workflow_events: {
        Row: {
          actor_id: string
          created_at: string
          event_type: string
          evidence: string | null
          from_status: string | null
          id: string
          module: string
          note: string | null
          record_id: string
          to_status: string | null
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_type: string
          evidence?: string | null
          from_status?: string | null
          id?: string
          module: string
          note?: string | null
          record_id: string
          to_status?: string | null
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_type?: string
          evidence?: string | null
          from_status?: string | null
          id?: string
          module?: string
          note?: string | null
          record_id?: string
          to_status?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      profiles_directory: {
        Row: {
          avatar_path: string | null
          department: string | null
          full_name: string | null
          id: string | null
          job_title: string | null
        }
        Insert: {
          avatar_path?: string | null
          department?: string | null
          full_name?: string | null
          id?: string | null
          job_title?: string | null
        }
        Update: {
          avatar_path?: string | null
          department?: string | null
          full_name?: string | null
          id?: string | null
          job_title?: string | null
        }
        Relationships: []
      }
      v_employee_names: {
        Row: {
          email: string | null
          id: string | null
          name: string | null
          user_id: string | null
        }
        Insert: {
          email?: string | null
          id?: string | null
          name?: string | null
          user_id?: string | null
        }
        Update: {
          email?: string | null
          id?: string | null
          name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      v_reporting_activity: {
        Row: {
          actor_user_id: string | null
          created_at: string | null
          module: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      advance_report_run: {
        Args: {
          _cadence: string
          _current: string
          _hour: number
          _timezone: string
          _weekday: number
        }
        Returns: string
      }
      claim_employee_account: { Args: never; Returns: string }
      consume_endpoint_rate_limit: {
        Args: {
          _key_hash: string
          _limit: number
          _route: string
          _window_seconds: number
        }
        Returns: boolean
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      directory_names: {
        Args: never
        Returns: {
          id: string
          name: string
        }[]
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_employee_reporting_history: {
        Args: { _user_id: string; _window_months?: number }
        Returns: {
          module: string
          month: string
          reports_count: number
        }[]
      }
      get_reporting_index: {
        Args: { _window_months?: number }
        Returns: {
          department: string
          full_name: string
          job_title: string
          module: string
          month: string
          reports_count: number
          user_id: string
          user_rank: number
          user_total: number
        }[]
      }
      has_module_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hse_objective_achievement: {
        Args: {
          _baseline: number
          _current: number
          _direction: string
          _target: number
        }
        Returns: number
      }
      hse_risk_rating: { Args: { _score: number }; Returns: string }
      is_approval_role: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      process_due_report_subscriptions: { Args: never; Returns: number }
      purge_old_audit_logs: { Args: never; Returns: number }
      purge_old_operational_data: { Args: never; Returns: number }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recompute_hse_objective_rag: {
        Args: { _objective_id: string }
        Returns: undefined
      }
      user_auth_level: { Args: { _user_id: string }; Returns: number }
    }
    Enums: {
      app_role:
        | "admin"
        | "hse_manager"
        | "supervisor"
        | "employee"
        | "auditor"
        | "hr_manager"
        | "director"
        | "hse_coordinator"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "hse_manager",
        "supervisor",
        "employee",
        "auditor",
        "hr_manager",
        "director",
        "hse_coordinator",
      ],
    },
  },
} as const
