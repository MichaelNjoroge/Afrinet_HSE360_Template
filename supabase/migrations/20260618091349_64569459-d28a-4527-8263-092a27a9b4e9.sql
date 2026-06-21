REVOKE EXECUTE ON FUNCTION public.recompute_hse_objective_rag(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_objective_rag() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_recompute_objective_rag_self() FROM PUBLIC, anon, authenticated;