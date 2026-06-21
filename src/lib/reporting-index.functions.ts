import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ReportingIndexRow = {
  user_id: string;
  full_name: string | null;
  department: string | null;
  job_title: string | null;
  module: string;
  month: string; // YYYY-MM-01
  reports_count: number;
  user_total: number;
  user_rank: number;
};

export type ReportingIndexSnapshot = {
  rows: ReportingIndexRow[];
  myUserId: string;
  windowMonths: number;
};

export const getReportingIndex = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ windowMonths: z.number().int().min(1).max(36).default(12) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<ReportingIndexSnapshot> => {
    const { data: rows, error } = await context.supabase.rpc("get_reporting_index", {
      _window_months: data.windowMonths,
    });
    if (error) {
      console.error("[reporting-index] rpc failed", error.message);
      throw new Error("The reporting index could not be loaded. Please try again.");
    }
    return {
      rows: (rows ?? []) as ReportingIndexRow[],
      myUserId: context.userId,
      windowMonths: data.windowMonths,
    };
  });

export type EmployeeHistoryRow = {
  module: string;
  month: string;
  reports_count: number;
};

export const getEmployeeReportingHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ userId: z.string().uuid(), windowMonths: z.number().int().min(1).max(36).default(12) })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<EmployeeHistoryRow[]> => {
    const { data: rows, error } = await context.supabase.rpc("get_employee_reporting_history", {
      _user_id: data.userId,
      _window_months: data.windowMonths,
    });
    if (error) {
      console.error("[reporting-index] history rpc failed", error.message);
      throw new Error("This employee's reporting history could not be loaded.");
    }
    return (rows ?? []) as EmployeeHistoryRow[];
  });
