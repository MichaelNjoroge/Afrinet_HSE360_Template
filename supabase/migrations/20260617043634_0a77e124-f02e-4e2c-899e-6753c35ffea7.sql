
-- Environmental records: require module permission on INSERT
DROP POLICY IF EXISTS "Authenticated staff can create resource records" ON public.environmental_resource_records;
CREATE POLICY "Authorized staff can create resource records"
  ON public.environmental_resource_records FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_module_permission(auth.uid(), 'environment', 'create')
      OR public.has_module_permission(auth.uid(), 'environment', 'edit')
    )
  );

DROP POLICY IF EXISTS "Authenticated staff can create emission records" ON public.environmental_emission_records;
CREATE POLICY "Authorized staff can create emission records"
  ON public.environmental_emission_records FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_module_permission(auth.uid(), 'environment', 'create')
      OR public.has_module_permission(auth.uid(), 'environment', 'edit')
    )
  );

DROP POLICY IF EXISTS "Authenticated staff can create waste records" ON public.environmental_waste_records;
CREATE POLICY "Authorized staff can create waste records"
  ON public.environmental_waste_records FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_module_permission(auth.uid(), 'environment', 'create')
      OR public.has_module_permission(auth.uid(), 'environment', 'edit')
    )
  );

-- Document versions: require module permission on INSERT and UPDATE
DROP POLICY IF EXISTS "Authenticated staff can create document versions" ON public.hse_document_versions;
CREATE POLICY "Authorized staff can create document versions"
  ON public.hse_document_versions FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      public.has_module_permission(auth.uid(), 'documents', 'create')
      OR public.has_module_permission(auth.uid(), 'documents', 'edit')
    )
  );

DROP POLICY IF EXISTS "Uploaders and HSE leaders can update document versions" ON public.hse_document_versions;
CREATE POLICY "Authorized uploaders and HSE leaders update document versions"
  ON public.hse_document_versions FOR UPDATE TO authenticated
  USING (
    (uploaded_by = auth.uid() AND public.has_module_permission(auth.uid(), 'documents', 'edit'))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
  )
  WITH CHECK (
    (uploaded_by = auth.uid() AND public.has_module_permission(auth.uid(), 'documents', 'edit'))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'hse_manager'::public.app_role)
  );

-- PPE inspections: require module permission on INSERT
DROP POLICY IF EXISTS "Authenticated staff can create PPE inspections" ON public.ppe_inspections;
CREATE POLICY "Authorized staff can create PPE inspections"
  ON public.ppe_inspections FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_module_permission(auth.uid(), 'ppe', 'create')
      OR public.has_module_permission(auth.uid(), 'ppe', 'edit')
    )
  );

-- Convert directory_names to SECURITY INVOKER (relies on existing SELECT policies)
CREATE OR REPLACE FUNCTION public.directory_names()
 RETURNS TABLE(id uuid, name text)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
  SELECT e.id, e.full_name FROM public.employees e WHERE e.full_name IS NOT NULL
  UNION
  SELECT e.user_id, e.full_name
  FROM public.employees e
  WHERE e.user_id IS NOT NULL AND e.full_name IS NOT NULL
  UNION
  SELECT p.id, p.full_name FROM public.profiles p WHERE p.full_name IS NOT NULL
$function$;
