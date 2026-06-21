
CREATE OR REPLACE VIEW public.v_reporting_activity AS
  SELECT 'incidents'::text AS module, i.reported_by AS actor_user_id, i.created_at FROM incidents i WHERE i.reported_by IS NOT NULL
  UNION ALL
  SELECT 'near_misses'::text, n.reported_by, n.created_at FROM near_misses n WHERE n.reported_by IS NOT NULL
  UNION ALL
  SELECT 'observations'::text, o.observed_by, o.created_at FROM safety_observations o WHERE o.observed_by IS NOT NULL
  UNION ALL
  SELECT 'hazards'::text, h.reported_by, h.created_at FROM hazards h WHERE h.reported_by IS NOT NULL
  UNION ALL
  SELECT 'ppe_inspections'::text, p.created_by, p.created_at FROM ppe_inspections p WHERE p.created_by IS NOT NULL
  UNION ALL
  SELECT 'inspections'::text, ins.created_by, ins.created_at FROM inspections ins WHERE ins.created_by IS NOT NULL
  UNION ALL
  SELECT 'audits'::text, a.created_by, a.created_at FROM audits a WHERE a.created_by IS NOT NULL
  UNION ALL
  SELECT 'capa'::text, ac.created_by, ac.created_at FROM actions ac WHERE ac.created_by IS NOT NULL
  UNION ALL
  SELECT 'emergency_response'::text, er.created_by, er.created_at FROM emergency_response_records er WHERE er.created_by IS NOT NULL
  UNION ALL
  SELECT 'safety_committee'::text, sc.created_by, sc.created_at FROM safety_committee_meetings sc WHERE sc.created_by IS NOT NULL;
