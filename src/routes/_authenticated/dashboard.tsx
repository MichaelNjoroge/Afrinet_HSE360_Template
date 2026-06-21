import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ReportActions } from "@/components/report-actions";
import { ReportingDashboard } from "@/components/reporting-dashboard";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  BookOpenCheck,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  FileDown,
  FileSearch,
  FileSpreadsheet,
  FileStack,
  FileWarning,
  GraduationCap,
  HardHat,
  Leaf,
  LayoutDashboard,
  ListChecks,
  LockKeyhole,
  LogOut,
  Menu,
  Camera,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Shirt,
  Target,
  Users,
  X,
  LifeBuoy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  createModuleRecord,
  getModulePack,
  transitionModuleRecord,
} from "@/lib/module-pack.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BulletTextarea } from "@/components/ui/bullet-textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModulePackTwo, type PackTwoModule } from "@/components/module-pack-two";
import { ModulePacksThreeFour, type EnterpriseModule } from "@/components/module-packs-three-four";
import { deleteManagedRecord, updateManagedRecord } from "@/lib/record-management.functions";
import {
  adminResetEmployeePassword,
  bulkDeleteEmployees,
  deleteEmployee,
  inviteEmployee,
  removeEmployeeAvatar,
  requestEmployeeProfileChange,
  saveEmployee,
  setEmployeeAvatar,
} from "@/lib/employees.functions";
import {
  EditRecordDialog,
  RecordDetailDialog,
  RowActions,
  SortControls,
  useSortedRows,
} from "@/components/record-management";
import { BulkImportButton } from "@/components/bulk-import";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { saveProfilePhoto } from "@/lib/profile.functions";
import { downloadCSV } from "@/lib/export";
import { compressImage } from "@/lib/image-compress";
import { getMyModulePermissions } from "@/lib/permissions.functions";
import { EvidencePanel } from "@/components/evidence-panel";
import { AuditReportPanel } from "@/components/audit-report-panel";
import { saveEvidenceMetadata } from "@/lib/evidence.functions";
import { ModuleGalleryPanel } from "@/components/module-gallery-panel";
import { PermissionAdministration } from "@/components/permission-administration";
import { EmployeePermissionsPanel } from "@/components/employee-permissions-panel";
import { CameraCaptureDialog } from "@/components/camera-capture-dialog";
import { PasswordInput } from "@/components/ui/password-input";
import { EmployeeNamesProvider, useEmployeeNames } from "@/lib/employee-display";
import { getAuthLevel, MIN_LEVEL_TO_CLOSE } from "@/lib/auth-levels";
import { NotificationBell } from "@/components/notification-bell";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Afrinet HSE360™ | Prosel HSE ERP" },
      {
        name: "description",
        content: "Prosel Limited enterprise health, safety and environment management system.",
      },
    ],
  }),
  component: Dashboard,
});

type ModuleKey =
  | "overview"
  | "incidents"
  | "hazards"
  | "observations"
  | "near_misses"
  | "risks"
  | "audits"
  | "capa"
  | "employees"
  | PackTwoModule
  | EnterpriseModule;
type OperationalModule = Exclude<
  ModuleKey,
  "overview" | "employees" | PackTwoModule | EnterpriseModule
>;
type Row = Record<string, unknown>;
type Pack = Awaited<ReturnType<typeof getModulePack>>;

const modules = [
  { key: "overview", label: "Dashboard", icon: LayoutDashboard },
  { key: "incidents", label: "Incident management", icon: FileWarning },
  { key: "hazards", label: "Hazard reporting", icon: ShieldAlert },
  { key: "observations", label: "Safety observations", icon: Eye },
  { key: "near_misses", label: "Near miss management", icon: Activity },
  { key: "environment", label: "Environmental management", icon: Leaf },
  { key: "risks", label: "Risk register", icon: AlertTriangle },
  { key: "audits", label: "Audit management", icon: ClipboardCheck },
  { key: "capa", label: "Central CAPA", icon: Target },
] as const;

const modulePackTwo = [
  { key: "inspections", label: "Inspection management", icon: ListChecks },
  { key: "objectives", label: "Objectives & targets", icon: Target },
] as const;

const hrModules = [
  { key: "employees", label: "Employee directory", icon: Users },
  { key: "training", label: "Training management", icon: GraduationCap },
  { key: "competencies", label: "Competency matrix", icon: BookOpenCheck },
  { key: "legal", label: "Legal compliance", icon: FileSearch },
] as const;

const packTwoKeys = new Set<ModuleKey>([
  ...modulePackTwo.map((item) => item.key),
  "training",
  "competencies",
]);
const modulePackThree = [
  { key: "contractors", label: "Contractor management", icon: BriefcaseBusiness },
  { key: "ppe", label: "PPE management", icon: Shirt },
] as const;
const modulePackFour = [
  { key: "documents", label: "Document control", icon: FileStack },
  { key: "reviews", label: "Management review", icon: ClipboardCheck },
  { key: "safety_committee", label: "Safety Committee", icon: Users },
  { key: "emergency_response", label: "Emergency Response", icon: ShieldAlert },
  { key: "reporting", label: "Reporting centre", icon: FileSpreadsheet },
  { key: "intelligence", label: "Business intelligence", icon: BrainCircuit },
  { key: "global_search", label: "Global search", icon: Search },
  { key: "notifications", label: "Notifications", icon: Bell },
] as const;
const enterpriseKeys = new Set<ModuleKey>(
  [...modulePackThree, ...modulePackFour, hrModules[3], modules[5]].map((item) => item.key),
);
const enterpriseTitle = (key: EnterpriseModule) =>
  [...modulePackThree, ...modulePackFour, ...hrModules].find((item) => item.key === key)?.label ??
  "Enterprise module";

const config: Record<OperationalModule, { title: string; description: string; action: string }> = {
  incidents: {
    title: "Incident management",
    description: "Investigate events from first report through verified closure.",
    action: "Report incident",
  },
  hazards: {
    title: "Hazard reporting",
    description: "Identify hazards early, rank exposure and track controls.",
    action: "Report hazard",
  },
  observations: {
    title: "Safety observations",
    description: "Capture positive behaviour, unsafe acts and unsafe conditions.",
    action: "Log observation",
  },
  near_misses: {
    title: "Near miss management",
    description: "Record high-potential events and prevent recurrence.",
    action: "Report near miss",
  },
  risks: {
    title: "Enterprise risk register",
    description: "Assess initial and residual risk using the 5×5 matrix.",
    action: "Add risk",
  },
  audits: {
    title: "Audit management",
    description: "Plan and control internal, external, compliance and certification audits.",
    action: "Plan audit",
  },
  capa: {
    title: "Central CAPA",
    description: "Control corrective and preventive actions across every source module.",
    action: "Add CAPA",
  },
};

const flows: Record<OperationalModule, string[]> = {
  incidents: ["reported", "investigated", "approved", "actioned", "verified", "closed"],
  hazards: ["open", "in_progress", "closed"],
  observations: ["open", "in_progress", "closed"],
  near_misses: ["reported", "investigated", "actioned", "verified", "closed"],
  risks: ["draft", "active", "under_review", "closed"],
  audits: ["planned", "conducted", "issued", "actioned", "verified", "closed"],
  capa: ["open", "in_progress", "awaiting_verification", "completed", "closed"],
};

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchPack = useServerFn(getModulePack);
  const createRecord = useServerFn(createModuleRecord);
  const transition = useServerFn(transitionModuleRecord);
  const updateRecord = useServerFn(updateManagedRecord);
  const removeRecord = useServerFn(deleteManagedRecord);
  const saveEmployeeFn = useServerFn(saveEmployee);
  const inviteEmployeeFn = useServerFn(inviteEmployee);
  const deleteEmployeeFn = useServerFn(deleteEmployee);
  const saveProfilePhotoFn = useServerFn(saveProfilePhoto);
  const bulkDeleteEmployeesFn = useServerFn(bulkDeleteEmployees);
  const setEmployeeAvatarFn = useServerFn(setEmployeeAvatar);
  const removeEmployeeAvatarFn = useServerFn(removeEmployeeAvatar);
  const fetchPermissions = useServerFn(getMyModulePermissions);
  const { data: permissions } = useQuery({
    queryKey: ["module-permissions"],
    queryFn: () => fetchPermissions(),
  });
  const { data, isLoading, error } = useQuery({
    queryKey: ["module-pack-1"],
    queryFn: () => fetchPack(),
  });
  const userLevel = getAuthLevel(data?.roles);
  // Module visibility gated by authorization level
  const visibleModules = useMemo(
    () =>
      modules.filter((m) => {
        // risks, audits, capa => Level 4+
        if (["risks", "audits", "capa"].includes(m.key)) return userLevel >= 4;
        return true;
      }),
    [userLevel],
  );
  const visiblePackTwo = useMemo(
    () =>
      modulePackTwo.filter((m) => {
        // Inspection management is hidden from Level 1 (plain employees);
        // the DB has_module_permission() function is the source of truth, so
        // admin overrides still work via the user_module_permissions table.
        if (m.key === "inspections") {
          return userLevel >= 2 && permissions?.inspections?.view !== false;
        }
        return true;
      }),
    [userLevel, permissions],
  );
  const visibleHrModules = useMemo(
    () =>
      hrModules.filter((m) => {
        // training, competencies, legal => Level 4+
        // employees stays visible (own record only for sub-L4 — handled in Employees component)
        if (["training", "competencies", "legal"].includes(m.key)) return userLevel >= 4;
        return true;
      }),
    [userLevel],
  );
  const visiblePackThree = useMemo(
    () =>
      modulePackThree.filter((m) => {
        // contractors => Level 3+ visible (onboard restricted to L4+ inside the panel)
        if (m.key === "contractors") return userLevel >= 3;
        return true;
      }),
    [userLevel],
  );
  const visiblePackFour = useMemo(
    () =>
      modulePackFour.filter((m) => {
        // documents, reviews, reporting, intelligence, safety_committee, emergency_response => Level 4+
        if (["documents", "reviews", "reporting", "intelligence", "safety_committee", "emergency_response"].includes(m.key))
          return userLevel >= 4;
        return true;
      }),
    [userLevel],
  );
  const [active, setActive] = useState<ModuleKey>("overview");
  const [mobile, setMobile] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [passwordDialog, setPasswordDialog] = useState(false);
  const [photoDialog, setPhotoDialog] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fullName = String(user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "HSE User");
  const selectModule = (key: ModuleKey, addHistory = true) => {
    setActive(key);
    setMobile(false);
    setSearch("");
    if (addHistory && window.history.state?.hseModule !== key) {
      window.history.pushState(
        { ...window.history.state, hseModule: key },
        "",
        window.location.href,
      );
    }
  };
  useEffect(() => {
    window.history.replaceState(
      { ...window.history.state, hseModule: "overview" },
      "",
      window.location.href,
    );
    const restoreModule = (event: PopStateEvent) => {
      const module = event.state?.hseModule;
      if (typeof module === "string") selectModule(module as ModuleKey, false);
    };
    window.addEventListener("popstate", restoreModule);
    return () => window.removeEventListener("popstate", restoreModule);
  }, []);
  const finish = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ["module-pack-1"] });
    setDialog(false);
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  };
  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  };
  const refresh = async () => {
    setRefreshing(true);
    await queryClient.refetchQueries({ type: "active" });
    setRefreshing(false);
    setNotice("Module data refreshed");
    window.setTimeout(() => setNotice(""), 2200);
  };
  return (
    <EmployeeNamesProvider
      employees={(data?.employees ?? []) as Row[]}
      directory={data?.directory ?? []}
    >
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={`${mobile ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:translate-x-0`}
      >
        <div className="flex h-20 items-center justify-between border-b border-sidebar-border px-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-safety text-safety-foreground">
              <HardHat />
            </span>
            <div>
              <p className="font-display text-lg font-bold">Afrinet HSE360™</p>
              <p className="text-[10px] tracking-[.18em] text-sidebar-foreground/55">
                PROSEL LIMITED
              </p>
            </div>
          </div>
          <Button
            variant="nav"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobile(false)}
            aria-label="Close menu"
          >
            <X />
          </Button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {navSections({
            visibleModules,
            visiblePackTwo,
            visibleHrModules,
            visiblePackThree,
            visiblePackFour,
          }).map((section) => (
            <NavGroup
              key={section.label}
              label={section.label}
              items={section.items}
              active={active}
              select={selectModule}
            />
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-4">
          <div className="mb-3 flex items-center gap-3 px-2">
            <Avatar className="size-9 border border-sidebar-border">
              <AvatarImage
                src={data?.currentAvatarUrl ?? undefined}
                alt={`${fullName} profile photo`}
                className="object-cover"
              />
              <AvatarFallback className="bg-safety font-bold text-safety-foreground">
                {fullName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{fullName}</p>
              <p className="truncate text-xs text-sidebar-foreground/55">
                {data?.roles.join(" · ") || "employee"}
              </p>
            </div>
          </div>
          <Button variant="nav" className="w-full" onClick={() => setPasswordDialog(true)}>
            <LockKeyhole />
            Change password
          </Button>
          {data?.roles.includes("admin") && (
            <Button variant="nav" className="w-full" onClick={() => setPhotoDialog(true)}>
              <Camera />
              Change profile photo
            </Button>
          )}
          {data?.roles.includes("admin") && (
            <Button
              variant="nav"
              className="w-full"
              onClick={() => navigate({ to: "/admin-monitoring" })}
            >
              <Activity />
              System monitoring
            </Button>
          )}
          {data?.roles.includes("admin") && (
            <Button
              variant="nav"
              className="w-full"
              onClick={() => navigate({ to: "/admin-support-runbook" })}
            >
              <LifeBuoy />
              Support runbook
            </Button>
          )}
          <Button variant="nav" className="w-full" onClick={signOut}>
            <LogOut />
            Sign out
          </Button>
        </div>
      </aside>
      {mobile && (
        <Button
          variant="ghost"
          className="fixed inset-0 z-30 h-auto w-auto rounded-none bg-foreground/30 lg:hidden"
          onClick={() => setMobile(false)}
          aria-label="Close navigation"
        />
      )}
      <main className="lg:ml-72">
        <header className="sticky top-0 z-20 grid h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/95 px-3 backdrop-blur sm:px-8">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              onClick={() => setMobile(true)}
              aria-label="Open menu"
            >
              <Menu />
            </Button>
            <div className="min-w-0">
              <p className="hidden truncate text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground sm:block">
                Prosel Limited · Thika, Kenya
              </p>
              <h1 className="truncate text-base font-bold sm:text-2xl">
                {active === "overview"
                  ? "Dashboard"
                  : active === "employees"
                    ? "Employee directory"
                    : enterpriseKeys.has(active)
                      ? enterpriseTitle(active as EnterpriseModule)
                      : packTwoKeys.has(active)
                        ? modulePackTwo.find((item) => item.key === active)?.label
                        : config[active as OperationalModule].title}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <NotificationBell />
            <Button variant="outline" size="icon" className="sm:hidden" onClick={refresh} disabled={refreshing} aria-label="Refresh">
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
            </Button>
            <Button variant="outline" className="hidden sm:inline-flex" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={refreshing ? "animate-spin" : ""} />
              <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
            </Button>
            <div className="hidden items-center gap-2 rounded-full bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground md:flex">
              <span className="size-2 rounded-full bg-success" />
              System operational
            </div>
          </div>
        </header>

        <div className="p-3 sm:p-8">
          {enterpriseKeys.has(active) ? (
            <ModulePacksThreeFour
              active={active as EnterpriseModule}
              employees={(data?.employees ?? []) as Row[]}
              roles={data?.roles ?? []}
              currentUserId={user.id}
            />
          ) : packTwoKeys.has(active) ? (
            <ModulePackTwo
              active={active as PackTwoModule}
              employees={(data?.employees ?? []) as Row[]}
              roles={data?.roles ?? []}
              currentUserId={user.id}
            />
          ) : error ? (
            <Empty text="Module Pack 1 could not be loaded. Please refresh." />
          ) : active === "overview" ? (
            <Overview data={data} loading={isLoading} select={selectModule} userName={fullName} roles={data?.roles ?? []} userId={user.id} />
          ) : active === "employees" ? (
            <Employees
              rows={(data?.employees ?? []) as Row[]}
              search={search}
              setSearch={setSearch}
              roles={data?.roles ?? []}
              permission={permissions?.employees}
              save={async (payload) => {
                await saveEmployeeFn({ data: payload as never });
                await finish("Employee saved");
              }}
              invite={async (id, role) => {
                await inviteEmployeeFn({ data: { employeeId: id, role: role as never } });
                await finish("Employee account invitation sent");
              }}
              remove={async (id) => {
                await deleteEmployeeFn({ data: { employeeId: id } });
                await finish("Employee removed");
              }}
              bulkRemove={async (ids) => {
                await bulkDeleteEmployeesFn({ data: { ids } });
                await finish(`${ids.length} employees removed`);
              }}
              setAvatar={async (employeeId, avatarPath) => {
                await setEmployeeAvatarFn({ data: { employeeId, avatarPath } });
                await finish("Profile photo saved");
              }}
              removeAvatar={async (employeeId) => {
                await removeEmployeeAvatarFn({ data: { employeeId } });
                await finish("Profile photo removed");
              }}
              currentUserId={user.id}
            />
          ) : (() => {
            const allRows = (data?.[active as OperationalModule] ?? []) as Row[];
            const isAdminLike = (data?.roles ?? []).some((r) =>
              ["admin", "director", "hse_manager", "hr_manager", "hse_coordinator", "supervisor", "auditor"].includes(r),
            );
            const ownerKey =
              active === "observations"
                ? "observed_by"
                : ["incidents", "hazards", "near_misses"].includes(active)
                  ? "reported_by"
                  : "created_by";
            const scopedRows = isAdminLike
              ? allRows
              : allRows.filter((r) => r[ownerKey] === user.id);
            return (
            <Register
              active={active as OperationalModule}
              rows={scopedRows}
              loading={isLoading}
              search={search}
              setSearch={setSearch}
              open={() => setDialog(true)}
              imported={async (count) => finish(`${count} records imported`)}
              update={async (row, changes) => {
                await updateRecord({
                  data: { module: active as OperationalModule, recordId: String(row.id), changes },
                });
                await finish("Record updated");
              }}
              remove={async (row) => {
                await removeRecord({
                  data: { module: active as OperationalModule, recordId: String(row.id) },
                });
                await finish("Record deleted");
              }}
              permission={permissions?.[active as OperationalModule]}
              roles={data?.roles ?? []}
              userId={user.id}
              transition={async (row, next) => {
                await transition({
                  data: {
                    module: active as OperationalModule,
                    recordId: String(row.id),
                    fromStatus: String(row.status),
                    toStatus: next,
                    note: "Advanced from the Module Pack 1 register",
                  },
                });
                await finish(`Record moved to ${next.replaceAll("_", " ")}`);
              }}
            />
            );
          })()}
        </div>
      </main>
      {active !== "overview" &&
        active !== "employees" &&
        !packTwoKeys.has(active) &&
        !enterpriseKeys.has(active) && (
          <RecordDialog
            active={active as OperationalModule}
            open={dialog}
            setOpen={setDialog}
            employees={(data?.employees ?? []) as Row[]}
            save={async (payload) => {
              const result = (await createRecord({ data: payload as never })) as {
                recordId?: string;
              };
              await finish(`${config[active as OperationalModule].title} record saved`);
              return result?.recordId ?? "";
            }}
          />
        )}
      {notice && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-xl"
        >
          <CheckCircle2 />
          {notice}
        </div>
      )}
      <ChangePasswordDialog open={passwordDialog} setOpen={setPasswordDialog} />
      <ProfilePhotoDialog
        open={photoDialog}
        setOpen={setPhotoDialog}
        userId={user.id}
        currentUrl={data?.currentAvatarUrl ?? null}
        fullName={fullName}
        save={async (avatarPath) => {
          await saveProfilePhotoFn({ data: { avatarPath } });
          await queryClient.invalidateQueries({ queryKey: ["module-pack-1"] });
          setNotice("Profile photo updated");
          window.setTimeout(() => setNotice(""), 2200);
        }}
      />
    </div>
    </EmployeeNamesProvider>
  );
}

type NavItem = { key: ModuleKey; label: string; icon: typeof LayoutDashboard };
type NavSection = { label: string; items: ReadonlyArray<NavItem> };

function navSections({
  visibleModules,
  visiblePackTwo,
  visibleHrModules,
  visiblePackThree,
  visiblePackFour,
}: {
  visibleModules: ReadonlyArray<NavItem>;
  visiblePackTwo: ReadonlyArray<NavItem>;
  visibleHrModules: ReadonlyArray<NavItem>;
  visiblePackThree: ReadonlyArray<NavItem>;
  visiblePackFour: ReadonlyArray<NavItem>;
}): NavSection[] {
  const byKey = new Map<ModuleKey, NavItem>();
  [
    ...visibleModules,
    ...visiblePackTwo,
    ...visibleHrModules,
    ...visiblePackThree,
    ...visiblePackFour,
  ].forEach((item) => byKey.set(item.key as ModuleKey, item as NavItem));
  const pick = (keys: ModuleKey[]): NavItem[] =>
    keys.map((k) => byKey.get(k)).filter((x): x is NavItem => Boolean(x));

  const sections: NavSection[] = [
    { label: "Overview", items: pick(["overview"]) },
    {
      label: "Frontline operations",
      items: pick(["incidents", "hazards", "observations", "near_misses", "environment"]),
    },
    {
      label: "Risk, audit & assurance",
      items: pick(["risks", "audits", "inspections", "capa"]),
    },
    {
      label: "Planning & performance",
      items: pick(["objectives", "reviews", "reporting", "intelligence"]),
    },
    {
      label: "HR & workforce",
      items: pick(["employees", "training", "competencies", "ppe", "contractors"]),
    },
    {
      label: "Governance & compliance",
      items: pick(["legal", "documents", "safety_committee", "emergency_response"]),
    },
    { label: "Tools", items: pick(["global_search", "notifications"]) },
  ];
  return sections.filter((s) => s.items.length > 0);
}

function NavGroup({
  label,
  items,
  active,
  select,
}: {
  label: string;
  items: ReadonlyArray<NavItem>;
  active: ModuleKey;
  select: (key: ModuleKey) => void;
}) {
  const containsActive = items.some((i) => i.key === active);
  const isOverview = label === "Overview";
  const [open, setOpen] = useState<boolean>(containsActive || isOverview);
  useEffect(() => {
    if (containsActive) setOpen(true);
  }, [containsActive]);
  return (
    <div className="pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[10px] font-bold uppercase tracking-[.2em] text-sidebar-foreground/55 hover:text-sidebar-foreground"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronRight
          className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {items.map((item) => (
            <Button
              key={item.key}
              variant="nav"
              className={`w-full ${active === item.key ? "bg-sidebar-accent text-sidebar-accent-foreground" : ""}`}
              onClick={() => select(item.key)}
            >
              <item.icon />
              {item.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}


function Overview({
  data,
  loading,
  select,
  userName,
  roles,
  userId,
}: {
  data?: Pack;
  loading: boolean;
  select: (key: ModuleKey) => void;
  userName: string;
  roles: string[];
  userId: string;
}) {
  const isAdminLike = roles.some((r) =>
    ["admin", "director", "hse_manager", "hr_manager"].includes(r),
  );
  const today = new Date().toISOString().slice(0, 10);
  const rows = data ?? {
    incidents: [],
    hazards: [],
    observations: [],
    near_misses: [],
    risks: [],
    audits: [],
    capa: [],
    employees: [],
    roles: [],
  };
  const indicators = [
    {
      label: "Open incidents",
      value: rows.incidents.filter((r) => r.status !== "closed").length,
      key: "incidents" as ModuleKey,
      icon: FileWarning,
    },
    {
      label: "High / extreme hazards",
      value: rows.hazards.filter((r) => ["high", "extreme"].includes(r.risk_rating ?? "")).length,
      key: "hazards" as ModuleKey,
      icon: ShieldAlert,
    },
    {
      label: "Open near misses",
      value: rows.near_misses.filter((r) => r.status !== "closed").length,
      key: "near_misses" as ModuleKey,
      icon: Activity,
    },
    {
      label: "Overdue CAPA",
      value: rows.capa.filter(
        (r) => !["completed", "closed"].includes(r.status) && r.due_date < today,
      ).length,
      key: "capa" as ModuleKey,
      icon: Target,
    },
  ];
  const openActions = indicators.reduce((total, item) => total + item.value, 0);
  return (
    <div className="mx-auto max-w-7xl">
      <section className="relative mb-7 overflow-hidden rounded-2xl bg-primary px-5 py-6 text-primary-foreground shadow-xl sm:px-9 sm:py-9">
        <div className="absolute -right-20 -top-28 size-80 rounded-full border border-primary-foreground/15" />
        <div className="absolute -right-8 -top-12 size-48 rounded-full border border-primary-foreground/15" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <p className="mb-3 text-xs font-bold uppercase tracking-[.2em] text-safety">
              HSE Dashboard
            </p>
            <h2 className="max-w-3xl text-2xl font-bold leading-tight sm:text-4xl">
              Welcome back, {userName.split(" ")[0]}

            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-primary-foreground/75 sm:text-base">
              Your HSE workspace has {openActions} active item{openActions === 1 ? "" : "s"}{" "}
              requiring attention today.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-lg bg-primary-foreground/10 px-4 py-3 text-sm font-semibold">
              <CalendarDays className="text-safety" />
              {new Intl.DateTimeFormat("en-KE", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }).format(new Date())}
            </div>
            <Button variant="safety" size="lg" onClick={() => select("incidents")}>
              <Plus /> Report incident
            </Button>
          </div>
        </div>
      </section>
      {loading ? (
        <div className="py-20 text-center text-muted-foreground">Loading operational data…</div>
      ) : (
        <>
          <details open className="group">
            <summary className="mb-4 flex cursor-pointer items-end justify-between list-none [&::-webkit-details-marker]:hidden">
              <div className="flex items-center gap-2">
                <ChevronRight className="size-5 text-muted-foreground transition-transform group-open:rotate-90" />
                <div>
                  <h3 className="text-xl font-bold">Items requiring attention</h3>
                  <p className="text-sm text-muted-foreground">
                    Select a card to open its live register
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-warning/15 px-3 py-1 text-xs font-bold text-warning">
                {openActions} active
              </span>
            </summary>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {indicators.map((item) => (
                <Button
                  key={item.label}
                  variant="outline"
                  className="group h-auto min-h-36 w-full flex-col items-start justify-between rounded-xl bg-card p-5 text-left shadow-sm hover:border-primary/40 hover:shadow-md"
                  onClick={() => select(item.key)}
                >
                  <span className="flex w-full items-start justify-between">
                    <span className="grid size-10 place-items-center rounded-lg bg-primary/10">
                      <item.icon className="text-primary" />
                    </span>
                    <ChevronRight className="text-muted-foreground transition-transform group-hover:translate-x-1" />
                  </span>
                  <span>
                    <strong className="block font-display text-3xl">{item.value}</strong>
                    <span className="text-sm font-semibold text-muted-foreground">
                      {item.label}
                    </span>
                  </span>
                </Button>
              ))}
            </div>
          </details>
          <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="border bg-card">
              <div className="border-b px-5 py-4">
                <h3 className="font-bold">Latest incident reports</h3>
                <p className="text-sm text-muted-foreground">
                  Recently reported events and current workflow position
                </p>
              </div>
              <div className="divide-y">
                {(isAdminLike
                  ? rows.incidents
                  : rows.incidents.filter((r) => r.reported_by === userId)
                )
                  .slice(0, 5)
                  .map((row) => (
                    <div key={row.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{row.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.reference} · {row.location}
                        </p>
                      </div>
                      <Status value={row.status} />
                    </div>
                  ))}
                {!(isAdminLike
                  ? rows.incidents
                  : rows.incidents.filter((r) => r.reported_by === userId)
                ).length && (
                  <Empty
                    text={
                      isAdminLike
                        ? "No incidents reported."
                        : "You have not reported any incidents yet. Only your own incident records are shown here."
                    }
                  />
                )}
              </div>
            </div>
            <RiskMatrix />
          </section>
          <section className="mt-6 space-y-4">
            <div className="relative overflow-hidden rounded-xl border-2 border-warning bg-gradient-to-r from-warning/20 via-warning/10 to-transparent p-5 shadow-md ring-2 ring-warning/30 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-warning text-warning-foreground shadow-lg">
                  <Bell className="size-6 animate-pulse" />
                </span>
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-[.18em] text-warning">
                    KPI Reminder
                  </p>
                  <p className="mt-1 text-lg font-bold text-foreground">
                    {userName}, your reporting matters!
                  </p>
                  <p className="mt-1 text-sm leading-6 text-foreground/85">
                    Reporting incidents, near-misses, hazards and safety observations is a
                    formal <strong>Key Performance Indicator (KPI)</strong> that will be
                    assessed during your next performance review. Keep your reporting index
                    strong — every report makes our workplace safer.
                  </p>
                </div>
              </div>
            </div>
            <ReportingDashboard isAdminView={isAdminLike} />
          </section>
        </>
      )}
    </div>
  );
}

function ProfilePhotoDialog({
  open,
  setOpen,
  userId,
  currentUrl,
  fullName,
  save,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  userId: string;
  currentUrl: string | null;
  fullName: string;
  save: (avatarPath: string) => Promise<void>;
}) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const uploadFile = async (raw: File): Promise<boolean> => {
    setMessage("");
    if (!raw || raw.size === 0) {
      setMessage("Choose a photo to upload.");
      return false;
    }
    const allowed = new Map([
      ["image/jpeg", "jpg"],
      ["image/png", "png"],
      ["image/webp", "webp"],
    ]);
    if (!allowed.has(raw.type)) {
      setMessage("Use a JPG, PNG, or WebP image.");
      return false;
    }
    if (raw.size > 5 * 1024 * 1024) {
      setMessage("Profile photos must be 5 MB or smaller.");
      return false;
    }
    setUploading(true);
    try {
      const file = await compressImage(raw, { maxEdge: 800, quality: 0.85 });
      const extension = allowed.get(file.type) ?? "jpg";
      const avatarPath = `${userId}/avatar.${extension}`;
      const { error } = await supabase.storage
        .from("profile-photos")
        .upload(avatarPath, file, { upsert: true, contentType: file.type });
      if (error) {
        setMessage(error.message);
        return false;
      }
      await save(avatarPath);
      setOpen(false);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The profile photo could not be saved.");
      return false;
    } finally {
      setUploading(false);
    }
  };
  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = new FormData(form).get("photo");
    if (!(raw instanceof File)) return setMessage("Choose a photo to upload.");
    const ok = await uploadFile(raw);
    if (ok) form.reset();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setMessage("");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Profile photo</DialogTitle>
          <DialogDescription>
            Upload a clear photo for your account and Employee Directory entry.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
          <Avatar className="size-16 border">
            <AvatarImage
              src={currentUrl ?? undefined}
              alt={`${fullName} profile photo`}
              className="object-cover"
            />
            <AvatarFallback className="bg-primary font-bold text-primary-foreground">
              {fullName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{fullName}</p>
            <p className="text-xs text-muted-foreground">JPG, PNG or WebP · maximum 5 MB</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={upload}>
          <div className="space-y-2">
            <Label htmlFor="profilePhoto">Choose a new photo</Label>
            <Input
              id="profilePhoto"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
            />
            <p className="text-xs text-muted-foreground">
              Pick from your gallery, or use the camera button below to take a new photo.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCameraOpen(true)}
              className="gap-2"
            >
              <Camera className="h-4 w-4" /> Take photo with camera
            </Button>
          </div>
          {message && (
            <p role="alert" className="rounded-md bg-muted p-3 text-sm">
              {message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading ? "Uploading…" : "Upload photo"}
            </Button>
          </div>
        </form>
      </DialogContent>
      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={async (file) => { await uploadFile(file); }}
        title="Take profile photo"
        description="Center your face in the frame, then capture."
      />
    </Dialog>
  );
}

function ChangePasswordDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("newPassword") ?? "");
    const confirmation = String(form.get("confirmPassword") ?? "");
    if (password.length < 8) return setMessage("Use at least 8 characters for your new password.");
    if (password !== confirmation) return setMessage("The new passwords do not match.");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setMessage(error.message);
    setMessage("Password changed successfully.");
    event.currentTarget.reset();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        setMessage("");
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change your password</DialogTitle>
          <DialogDescription>
            Create a secure password for your individual account.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <PasswordInput
              id="newPassword"
              name="newPassword"
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              required
            />
          </div>
          {message && (
            <p role="status" className="rounded-md bg-muted p-3 text-sm">
              {message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Changing…" : "Change password"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Register({
  active,
  rows,
  loading,
  search,
  setSearch,
  open,
  imported,
  transition,
  update,
  remove,
  permission,
  roles,
  userId,
}: {
  active: OperationalModule;
  rows: Row[];
  loading: boolean;
  search: string;
  setSearch: (value: string) => void;
  open: () => void;
  imported: (count: number) => Promise<void>;
  transition: (row: Row, next: string) => Promise<void>;
  update: (row: Row, changes: Row) => Promise<void>;
  remove: (row: Row) => Promise<void>;
  permission?: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    approve: boolean;
    export: boolean;
  };
  roles?: string[];
  userId: string;
}) {
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Row | null>(null);
  const [evidence, setEvidence] = useState<Row | null>(null);
  const registerRef = useRef<HTMLDivElement>(null);
  const cfg = config[active];
  const sorted = useSortedRows(rows, search);
  const { names: employeeNameLookup } = useEmployeeNames();
  const isAdmin = roles?.includes("admin") === true;
  const registerLevel = getAuthLevel(roles);
  const canCloseRecords = registerLevel >= MIN_LEVEL_TO_CLOSE;
  const canDeleteAny = roles?.some((role) => ["admin", "hr_manager"].includes(role)) === true;
  const ownerKey =
    active === "observations"
      ? "observed_by"
      : ["incidents", "hazards", "near_misses"].includes(active)
        ? "reported_by"
        : "created_by";
  const latestOwnId = rows
    .filter((row) => row[ownerKey] === userId)
    .sort((left, right) =>
      String(right.created_at ?? "").localeCompare(String(left.created_at ?? "")),
    )[0]?.id;
  const canAdd = isAdmin || permission?.create === true || permission?.edit === true;
  const canExport = isAdmin || permission?.export !== false;
  const filtered = useMemo(
    () =>
      sorted.filtered.filter((row) => {
        const displayStatus =
          active === "capa" &&
          !["completed", "closed"].includes(String(row.status)) &&
          String(row.due_date) < new Date().toISOString().slice(0, 10)
            ? "overdue"
            : String(row.status);
        return status === "all" || displayStatus === status;
      }),
    [active, sorted.filtered, status],
  );
  return (
    <>
      {(["incidents", "hazards", "observations", "near_misses", "audits"] as ModuleKey[]).includes(
        active,
      ) && (
        <ModuleGalleryPanel
          module={active as "incidents" | "hazards" | "observations" | "near_misses" | "audits"}
          title={`${cfg.title} · photo library`}
          canAdd={isAdmin}
          canDelete={isAdmin}
          ownerOnly={!isAdmin}
          currentUserId={userId}
        />
      )}

      <section className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="max-w-2xl text-muted-foreground">{cfg.description}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">
            {flows[active].join(" → ").replaceAll("_", " ")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canAdd && <BulkImportButton module={active} onComplete={imported} />}
          {canExport && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => downloadCSV(active, filtered, { nameLookup: employeeNameLookup })}
              disabled={!filtered.length}
            >
              <FileDown /> Export
            </Button>
          )}
          <ReportActions
            targetRef={registerRef}
            fileName={`${active}-register`}
            title={`${cfg.title} register`}
            subtitle={`${filtered.length} records · Generated ${new Date().toLocaleDateString()}`}
            module={active}
          />
          {canAdd && (
            <Button variant="safety" size="lg" onClick={open}>
              <Plus />
              Create new entry
            </Button>
          )}
        </div>
      </section>
      <div ref={registerRef} className="border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Search ${cfg.title.toLowerCase()}…`}
            />
          </div>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            {flows[active].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <SortControls
            keys={sorted.keys}
            sortKey={sorted.sortKey}
            setSortKey={sorted.setSortKey}
            direction={sorted.direction}
            toggleDirection={sorted.toggleDirection}
          />
          <p className="text-sm text-muted-foreground">{filtered.length} records</p>
        </div>
        {loading ? (
          <div className="p-14 text-center text-muted-foreground">Loading register…</div>
        ) : filtered.length ? (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[1040px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wider text-muted-foreground shadow-sm">

                <tr>
                  <th className="px-5 py-3">Record</th>
                  <th className="px-5 py-3">Context</th>
                  <th className="px-5 py-3">Date / owner</th>
                  <th className="px-5 py-3">Risk / priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Workflow</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((row) => {
                  const current = flows[active].indexOf(String(row.status));
                  const next = flows[active][current + 1];
                  const displayStatus =
                    active === "capa" &&
                    !["completed", "closed"].includes(String(row.status)) &&
                    String(row.due_date) < new Date().toISOString().slice(0, 10)
                      ? "overdue"
                      : String(row.status);
                  return (
                    <tr
                      key={String(row.id)}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => setDetail(row)}
                    >
                      <td className="max-w-sm px-5 py-4">
                        <p className="truncate font-semibold">
                          {String(row.title ?? row.activity ?? row.description ?? "HSE record")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {String(
                            row.reference ?? row.audit_number ?? row.source_reference ?? "CAPA",
                          )}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="capitalize">
                          {String(
                            row.incident_type ??
                              row.observation_type ??
                              row.audit_type ??
                              row.category ??
                              row.source_type ??
                              "—",
                          ).replaceAll("_", " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {String(row.department ?? row.location ?? row.area ?? "Thika")}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {String(
                          row.occurred_at ??
                            row.observed_at ??
                            row.scheduled_on ??
                            row.review_date ??
                            row.due_date ??
                            row.created_at ??
                            "—",
                        ).slice(0, 10)}
                      </td>
                      <td className="px-5 py-4">
                        <RiskBadge
                          value={String(
                            row.residual_rating ??
                              row.risk_rating ??
                              row.potential_severity ??
                              row.severity ??
                              row.priority ??
                              "—",
                          )}
                          score={row.residual_score ?? row.risk_score}
                        />
                      </td>
                      <td className="px-5 py-4">
                        <Status value={displayStatus} />
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {next && permission?.approve === true ? (
                          next === "closed" && !canCloseRecords ? (
                            <span className="text-xs font-semibold text-muted-foreground">
                              Level 4+ required to close
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy === String(row.id)}
                              onClick={async () => {
                                setBusy(String(row.id));
                                try {
                                  await transition(row, next);
                                } finally {
                                  setBusy("");
                                }
                              }}
                            >
                              {busy === String(row.id)
                                ? "Updating…"
                                : `Move to ${next.replaceAll("_", " ")}`}
                              <ChevronRight />
                            </Button>
                          )
                        ) : !next ? (
                          <span className="text-xs font-semibold text-success">
                            Workflow complete
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800 ring-1 ring-amber-300">
                            Awaiting {String(next).replaceAll("_", " ")}
                          </span>
                        )}

                      </td>
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          row={row}
                          onEdit={setEditing}
                          onDelete={remove}
                          onEvidence={
                            ["incidents", "hazards", "observations", "near_misses", "audits", "capa"].includes(
                              active,
                            )
                              ? setEvidence
                              : undefined
                          }
                          evidenceLabel={active === "audits" ? "Report" : "Photos"}
                          canEdit={
                            permission?.edit !== false &&
                            (canDeleteAny ||
                              row[ownerKey] !== userId ||
                              row.id === latestOwnId)
                          }
                          canDelete={
                            permission?.delete === true && (canDeleteAny || row.id === latestOwnId)
                          }

                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty text={`No ${cfg.title.toLowerCase()} records match this view.`}>
            {[
              "incidents",
              "hazards",
              "observations",
              "near_misses",
              "audits",
            ].includes(active) && (
              <Button type="button" size="sm" variant="outline" disabled>
                <Camera />
                Photos available on each saved record
              </Button>
            )}
          </Empty>
        )}
      </div>
      <EditRecordDialog
        row={editing}
        open={!!editing}
        setOpen={(open) => !open && setEditing(null)}
        save={async (changes) => {
          if (editing) await update(editing, changes);
        }}
      />
      <RecordDetailDialog
        row={detail}
        open={!!detail}
        setOpen={(open) => !open && setDetail(null)}
        title={`${config[active].title} · record profile`}
        description="Full record details. Click the action buttons in the row to edit, manage photos, or change status."
      />
      <Dialog open={evidence !== null} onOpenChange={(open) => !open && setEvidence(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {active === "audits" ? "Audit evidence & AI report" : "Supporting evidence"}
            </DialogTitle>
            <DialogDescription>
              {active === "audits"
                ? "Upload audit evidence and generate an ISO-aligned draft audit report."
                : "Upload, preview, or delete private photographic evidence for this record."}
            </DialogDescription>
          </DialogHeader>
          {evidence && active === "audits" ? (
            <AuditReportPanel
              auditId={String(evidence.id)}
              canEdit={permission?.edit !== false}
              canApprove={permission?.approve === true || isAdmin}
            />
          ) : evidence ? (
            <EvidencePanel
              module={active}
              recordId={String(evidence.id)}
              canAdd={permission?.edit !== false}
              canDelete={permission?.edit !== false || permission?.delete === true}
              photosOnly
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {active === "risks" && (
        <div className="mt-6 max-w-md">
          <RiskMatrix />
        </div>
      )}
    </>
  );
}

function Employees({
  rows,
  search,
  setSearch,
  roles,
  save,
  invite,
  remove,
  bulkRemove,
  setAvatar,
  removeAvatar,
  currentUserId,
  permission,
}: {
  rows: Row[];
  search: string;
  setSearch: (value: string) => void;
  roles: string[];
  save: (payload: Row) => Promise<void>;
  invite: (id: string, role: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  bulkRemove: (ids: string[]) => Promise<void>;
  setAvatar: (employeeId: string, avatarPath: string) => Promise<void>;
  removeAvatar: (employeeId: string) => Promise<void>;
  currentUserId: string;
  permission?: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    approve: boolean;
    export: boolean;
  };
}) {
  const sorted = useSortedRows(rows, search);
  const [editing, setEditing] = useState<Row | null>(null);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<Row | null>(null);
  const [invitingId, setInvitingId] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [colSort, setColSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(null);
  const isAdmin = roles.includes("admin");
  const empLevel = getAuthLevel(roles);
  const isPrivilegedHR = empLevel >= 4; // L4/L5 manage all employees
  const canEditEmployees = isPrivilegedHR && isAdmin && permission?.edit !== false;
  const canDeleteEmployees = isPrivilegedHR && permission?.delete === true;
  const canAddEmployees =
    isPrivilegedHR && (isAdmin || permission?.create === true || permission?.edit === true);
  const canExportEmployees = isPrivilegedHR && (isAdmin || permission?.export !== false);
  const [photo, setPhoto] = useState<Row | null>(null);
  const displayedRows = useMemo(() => {
    // Sub-L4 users only see their own employee record (read-only).
    const scoped = isPrivilegedHR
      ? sorted.filtered
      : sorted.filtered.filter((row) => row.user_id === currentUserId);
    const base = [...scoped];
    if (!colSort) return base;
    const { key, dir } = colSort;
    return base.sort((a, b) => {
      const left = String(a[key] ?? "");
      const right = String(b[key] ?? "");
      return left.localeCompare(right, undefined, { numeric: true }) * (dir === "asc" ? 1 : -1);
    });
  }, [sorted.filtered, colSort, isPrivilegedHR, currentUserId]);
  const toggleColumn = (key: string) =>
    setColSort((prev) =>
      prev?.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  const sortIndicator = (key: string) =>
    colSort?.key === key ? (colSort.dir === "asc" ? " ▲" : " ▼") : "";
  const toggleRow = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected =
    displayedRows.length > 0 && displayedRows.every((row) => selected.has(String(row.id)));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(displayedRows.map((row) => String(row.id))));

  return (
    <>
      <section className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="max-w-2xl text-muted-foreground">
            Create employees, assign reporting managers and approval levels, then issue each person
            a secure individual account.
          </p>
        </div>
        {inviteMessage && (
          <p role="status" className="rounded-md bg-muted px-4 py-2 text-sm">
            {inviteMessage}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {canExportEmployees && (
            <Button
              variant="outline"
              onClick={() => downloadCSV("employees", sorted.filtered)}
              disabled={!sorted.filtered.length}
            >
              <FileDown /> Export CSV
            </Button>
          )}
          {canAddEmployees && (
            <>
              <BulkImportButton
                module="employees"
                onComplete={async () => {
                  window.location.reload();
                }}
              />
              <Button
                variant="safety"
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus />
                Create new entry
              </Button>
            </>
          )}
        </div>
      </section>
      <section className="mb-5 border bg-muted/30 p-4">
        <h3 className="font-semibold">Approval levels: interpretation and use</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Levels define an employee’s position in an approval chain. They do not grant access to a
          module; module rights are assigned separately by an administrator.
        </p>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Level 1", "Employee", "Creates and submits own records."],
            ["Level 2", "Supervisor", "Reviews team submissions and first-line actions."],
            ["Level 3", "Department manager", "Approves departmental records and escalations."],
            ["Level 4", "HSE / senior manager", "Reviews high-risk and cross-department matters."],
            ["Level 5", "Director / final authority", "Provides the highest and final approval."],
          ].map(([level, role, use]) => (
            <div key={level} className="border-l-2 border-primary pl-3">
              <dt className="font-semibold">{level}</dt>
              <dd className="mt-0.5 font-medium">{role}</dd>
              <dd className="mt-1 text-xs text-muted-foreground">{use}</dd>
            </div>
          ))}
        </dl>
      </section>
      <details open className="group border bg-card">
        <summary className="flex cursor-pointer items-center justify-between gap-3 border-b px-4 py-3 list-none [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-2">
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-open:rotate-90" />
            <h3 className="font-semibold">Employee register ({displayedRows.length})</h3>
          </div>
          <span className="text-xs text-muted-foreground">Click to collapse / expand</span>
        </summary>
        <div className="flex flex-col gap-3 border-b p-4 md:flex-row md:items-center">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search employees…"
            />
          </div>
          <SortControls
            keys={sorted.keys}
            sortKey={sorted.sortKey}
            setSortKey={sorted.setSortKey}
            direction={sorted.direction}
            toggleDirection={sorted.toggleDirection}
          />
          <p className="text-sm text-muted-foreground">{displayedRows.length} employees</p>
        </div>
        {canDeleteEmployees && selected.size > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
            <p className="text-sm font-medium">
              {selected.size} selected
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelected(new Set())}>
                Clear selection
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  if (!window.confirm(`Delete ${selected.size} selected employees permanently?`))
                    return;
                  await bulkRemove(Array.from(selected));
                  setSelected(new Set());
                }}
              >
                Delete selected
              </Button>
            </div>
          </div>
        )}
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="sticky top-0 z-10 bg-muted text-xs uppercase tracking-wider text-muted-foreground shadow-sm">

              <tr>
                {canDeleteEmployees && (
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all employees"
                      checked={allSelected}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                <th
                  className="cursor-pointer px-5 py-3"
                  onClick={() => toggleColumn("full_name")}
                >
                  Employee{sortIndicator("full_name")}
                </th>
                <th className="cursor-pointer px-5 py-3" onClick={() => toggleColumn("job_title")}>
                  Job title{sortIndicator("job_title")}
                </th>
                <th
                  className="cursor-pointer px-5 py-3"
                  onClick={() => toggleColumn("department")}
                >
                  Department{sortIndicator("department")}
                </th>
                <th
                  className="cursor-pointer px-5 py-3"
                  onClick={() => toggleColumn("approval_level")}
                >
                  Approval{sortIndicator("approval_level")}
                </th>
                <th
                  className="cursor-pointer px-5 py-3"
                  onClick={() => toggleColumn("account_status")}
                >
                  Account Status{sortIndicator("account_status")}
                </th>
                {(isAdmin || canEditEmployees || canDeleteEmployees) && (
                  <th className="px-5 py-3 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayedRows.map((row) => (
                <tr
                  key={String(row.id)}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                  onClick={() => setProfile(row)}
                >
                  {canDeleteEmployees && (
                    <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${String(row.full_name)}`}
                        checked={selected.has(String(row.id))}
                        onChange={() => toggleRow(String(row.id))}
                      />
                    </td>
                  )}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-auto rounded-full p-0"
                        onClick={(event) => {
                          event.stopPropagation();
                          setPhoto(row);
                        }}
                        aria-label={`Enlarge ${String(row.full_name)} profile photo`}
                      >
                        <Avatar className="size-10 border">
                          <AvatarImage
                            src={typeof row.avatar_url === "string" ? row.avatar_url : undefined}
                            alt={`${String(row.full_name)} profile photo`}
                            className="object-cover"
                          />
                          <AvatarFallback className="bg-primary/10 font-bold text-primary">
                            {String(row.full_name).slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                      <div>
                        <p className="font-semibold">{String(row.full_name)}</p>
                        <p className="text-xs text-muted-foreground">
                          {String(row.email ?? "No work email")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">{String(row.job_title ?? "—")}</td>
                  <td className="px-5 py-4">{String(row.department ?? "—")}</td>
                  <td className="px-5 py-4">
                    Level {String(row.approval_level ?? 0)}
                    <p className="text-xs text-muted-foreground">
                      {rows.find((item) => item.id === row.manager_employee_id)?.full_name
                        ? `Reports to ${String(rows.find((item) => item.id === row.manager_employee_id)?.full_name)}`
                        : "No manager"}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <Status value={String(row.account_status ?? "not_invited")} />
                  </td>
                  {(isAdmin || canEditEmployees || canDeleteEmployees) && (
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-1">
                        {isAdmin && row.account_status !== "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={invitingId === String(row.id)}
                            onClick={async (event) => {
                              event.stopPropagation();
                              setInvitingId(String(row.id));
                              setInviteMessage("");
                              try {
                                await invite(String(row.id), "employee");
                                setInviteMessage(`Message sent successfully to ${String(row.email)}.`);
                              } catch (cause) {
                                setInviteMessage(
                                  cause instanceof Error
                                    ? `Message was not sent because ${cause.message}`
                                    : "Message was not sent because the invitation could not be sent.",
                                );
                              } finally {
                                setInvitingId("");
                              }
                            }}
                          >
                            {invitingId === String(row.id)
                              ? "Sending…"
                              : row.user_id
                                ? "Resend invite"
                                : "Invite"}
                          </Button>
                        )}
                        {canEditEmployees && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditing(row);
                              setOpen(true);
                            }}
                          >
                            Modify
                          </Button>
                        )}
                        {canDeleteEmployees && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={(event) => {
                              event.stopPropagation();
                              if (window.confirm("Delete this employee?"))
                                void remove(String(row.id));
                            }}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <EmployeeDialog open={open} setOpen={setOpen} row={editing} employees={rows} save={save} />
      <EmployeeProfileDialog
        row={profile}
        employees={rows}
        canEdit={canEditEmployees}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
        setAvatar={setAvatar}
        removeAvatar={removeAvatar}
        close={() => setProfile(null)}
        edit={(row) => {
          setProfile(null);
          setEditing(row);
          setOpen(true);
        }}
      />
      <Dialog open={photo !== null} onOpenChange={(value) => !value && setPhoto(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{String(photo?.full_name ?? "Employee photo")}</DialogTitle>
            <DialogDescription>Employee directory profile photo.</DialogDescription>
          </DialogHeader>
          {typeof photo?.avatar_url === "string" ? (
            <img
              src={photo.avatar_url}
              alt={`${String(photo.full_name)} profile photo`}
              className="max-h-[65vh] w-full rounded-lg object-contain"
            />
          ) : (
            <p className="p-10 text-center text-muted-foreground">
              No profile photo has been uploaded.
            </p>
          )}
        </DialogContent>
      </Dialog>
      {isAdmin && <PermissionAdministration employees={rows} />}
    </>
  );
}

function EmployeeProfileDialog({
  row,
  employees,
  canEdit,
  isAdmin,
  currentUserId,
  setAvatar,
  removeAvatar,
  close,
  edit,
}: {
  row: Row | null;
  employees: Row[];
  canEdit: boolean;
  isAdmin: boolean;
  currentUserId: string;
  setAvatar: (employeeId: string, avatarPath: string) => Promise<void>;
  removeAvatar: (employeeId: string) => Promise<void>;
  close: () => void;
  edit: (row: Row) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const manager = employees.find((employee) => employee.id === row?.manager_employee_id);
  const directReports = employees.filter((employee) => employee.id !== row?.id && employee.manager_employee_id === row?.id);
  const isSelf = row?.user_id === currentUserId;
  const canManagePhoto = (isAdmin || isSelf) && typeof row?.user_id === "string";
  const details = [
    ["Work email", row?.email],
    ["Phone", row?.phone],
    ["Job title", row?.job_title],
    ["Department", row?.department],
    ["Employment status", row?.employment_status],
    ["Account status", row?.account_status],
    ["Approval level", row ? `Level ${String(row.approval_level ?? 0)}` : null],
    ["Reports to", manager?.full_name],
  ];
  async function uploadRawFile(raw: File) {
    if (!row || !canManagePhoto) return;
    if (!raw || raw.size === 0) return;
    if (raw.size > 5 * 1024 * 1024) {
      setMessage("Photo must be 5 MB or smaller.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const file = await compressImage(raw, { maxEdge: 800, quality: 0.85 });
      const extension = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const userId = String(row.user_id);
      const avatarPath = `${userId}/avatar.${extension}`;
      const { error } = await supabase.storage
        .from("profile-photos")
        .upload(avatarPath, file, { upsert: true, contentType: file.type });
      if (error) {
        setMessage(error.message);
        return;
      }
      await setAvatar(String(row.id), avatarPath);
      close();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The photo could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  async function uploadPhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = (new FormData(form).get("photo") as File | null) ?? null;
    if (!raw) return;
    await uploadRawFile(raw);
    form.reset();
  }
  async function deletePhoto() {
    if (!row || !canManagePhoto) return;
    if (!window.confirm("Remove this profile photo?")) return;
    setBusy(true);
    setMessage("");
    try {
      await removeEmployeeAvatarHelper(removeAvatar, String(row.id));
      close();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "The photo could not be removed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open={row !== null} onOpenChange={(value) => !value && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Employee profile</DialogTitle>
          <DialogDescription>
            Full directory record. {isAdmin ? "Administrators can manage profile photo, reporting line and approval level." : "Employees can update their own profile photo."}
          </DialogDescription>
        </DialogHeader>
        {row && (
          <div className="space-y-5">
            <div className="flex items-center gap-4 border-b pb-5">
              <Avatar className="size-20 border">
                <AvatarImage
                  src={typeof row.avatar_url === "string" ? row.avatar_url : undefined}
                  alt={`${String(row.full_name)} profile photo`}
                  className="object-cover"
                />
                <AvatarFallback className="bg-primary/10 text-xl font-bold text-primary">
                  {String(row.full_name).slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h4 className="text-xl font-bold">{String(row.full_name)}</h4>
                <p className="text-sm text-muted-foreground">
                  {String(row.job_title ?? "Employee")} ·{" "}
                  {String(row.department ?? "No department")}
                </p>
              </div>
            </div>
            {canManagePhoto ? (
              <form onSubmit={uploadPhoto} className="space-y-3 rounded-md border p-4">
                <p className="text-sm font-semibold">
                  Profile photo {isSelf ? "(your account)" : "(admin override)"}
                </p>
                <Input
                  name="photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={busy}
                />
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or WebP · max 5 MB · pick a file or use the in-app camera below.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCameraOpen(true)}
                  disabled={busy}
                  className="gap-2"
                >
                  <Camera className="h-4 w-4" /> Take photo with camera
                </Button>
                {message && <p className="text-sm text-destructive">{message}</p>}
                <div className="flex flex-wrap justify-end gap-2">
                  {typeof row.avatar_url === "string" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={deletePhoto}
                      disabled={busy}
                    >
                      Remove current photo
                    </Button>
                  )}
                  <Button type="submit" disabled={busy}>
                    {busy ? "Saving…" : typeof row.avatar_url === "string" ? "Replace photo" : "Upload photo"}
                  </Button>
                </div>
                <CameraCaptureDialog
                  open={cameraOpen}
                  onOpenChange={setCameraOpen}
                  onCapture={async (file) => { await uploadRawFile(file); }}
                  title={isSelf ? "Take profile photo" : `Take photo for ${String(row.full_name)}`}
                  description="Center the subject in the frame, then capture."
                />
              </form>
            ) : !row.user_id ? (
              <p className="rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                A profile photo can be added after this employee has been invited and an account is linked.
              </p>
            ) : null}
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {details.map(([label, value]) => (
                <div key={String(label)}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {String(label)}
                  </dt>
                  <dd className="mt-1 text-sm font-medium capitalize">{String(value ?? "—")}</dd>
                </div>
              ))}
            </dl>
            <div className="rounded-md border bg-muted/30 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Reporting structure
              </p>
              <p className="mt-2 text-sm">
                <span className="font-semibold">Reports to:</span>{" "}
                {manager?.full_name ? String(manager.full_name) : "No manager assigned"}
              </p>
              <p className="mt-2 text-sm font-semibold">Direct reports ({directReports.length}):</p>
              {directReports.length ? (
                <ul className="mt-1 list-inside list-disc text-sm">
                  {directReports.map((report) => (
                    <li key={String(report.id)}>
                      {String(report.full_name)}
                      <span className="text-muted-foreground">
                        {" "}· Level {String(report.approval_level ?? 1)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">No direct reports.</p>
              )}
            </div>
            {isAdmin && typeof row.user_id === "string" && (
              <>
                <AdminPasswordResetCard employeeId={String(row.id)} email={String(row.email ?? "")} />
                <EmployeePermissionsPanel userId={String(row.user_id)} />
              </>
            )}
            {isSelf && !canEdit && (
              <RequestProfileChangeCard employeeId={String(row.id)} />
            )}
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={close}>
                Close
              </Button>
              {canEdit && (
                <Button type="button" onClick={() => edit(row)}>
                  Modify profile
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RequestProfileChangeCard({ employeeId }: { employeeId: string }) {
  const submit = useServerFn(requestEmployeeProfileChange);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  async function send() {
    if (message.trim().length < 5) {
      setStatus({ ok: false, text: "Please describe the changes (at least 5 characters)." });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await submit({ data: { employeeId, message: message.trim() } });
      setStatus({ ok: true, text: "Request sent. An administrator will review and update your record." });
      setMessage("");
    } catch (cause) {
      setStatus({
        ok: false,
        text: cause instanceof Error ? cause.message : "Could not submit your request.",
      });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-md border bg-muted/30 p-4">
      <p className="text-sm font-semibold">Request changes from an administrator</p>
      <p className="mt-1 text-xs text-muted-foreground">
        You cannot edit your directory record directly. Describe the changes you need and an
        administrator will action them on your behalf.
      </p>
      <textarea
        className="mt-3 w-full rounded-md border bg-background p-2 text-sm"
        rows={3}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="e.g. Update my phone number to +254 712 345 678"
        disabled={busy}
        maxLength={2000}
      />
      {status && (
        <p className={`mt-2 text-xs ${status.ok ? "text-success" : "text-destructive"}`}>
          {status.text}
        </p>
      )}
      <div className="mt-3 flex justify-end">
        <Button type="button" onClick={send} disabled={busy}>
          {busy ? "Sending…" : "Send request"}
        </Button>
      </div>
    </div>
  );
}

function AdminPasswordResetCard({ employeeId, email }: { employeeId: string; email: string }) {
  const resetFn = useServerFn(adminResetEmployeePassword);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function send() {
    setBusy(true);
    setMessage("");
    try {
      await resetFn({ data: { employeeId } });
      setMessage(`Message sent successfully to ${email}.`);
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? `Message was not sent because ${cause.message}`
          : "Message was not sent because the reset email could not be sent.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-md border bg-muted/30 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Account password
      </p>
      <p className="mt-2 text-sm">
        Send a secure password reset link to this employee's work email. The link expires after a
        single use.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={send} disabled={busy || !email}>
          {busy ? "Sending…" : "Send password reset link"}
        </Button>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
      </div>
    </div>
  );
}

async function removeEmployeeAvatarHelper(
  remove: (employeeId: string) => Promise<void>,
  employeeId: string,
) {
  await remove(employeeId);
}

function EmployeeDialog({
  open,
  setOpen,
  row,
  employees,
  save,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  row: Row | null;
  employees: Row[];
  save: (payload: Row) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim();
    try {
      await save({
        id: row?.id,
        fullName: value("fullName"),
        email: value("email"),
        phone: value("phone"),
        department: value("department"),
        jobTitle: value("jobTitle"),
        employmentStatus: value("employmentStatus"),
        managerEmployeeId: value("manager"),
        approvalLevel: Number(value("approvalLevel")),
        role: value("role"),
      });
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The employee could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{row ? "Modify employee" : "Add employee"}</DialogTitle>
          <DialogDescription>
            Set the directory details, reporting manager, approval level and account role.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            name="fullName"
            defaultValue={String(row?.full_name ?? "")}
            required
          />
          <Field
            label="Work email"
            name="email"
            type="email"
            defaultValue={String(row?.email ?? "")}
            required
          />
          <Field label="Phone" name="phone" defaultValue={String(row?.phone ?? "")} />
          <Field
            label="Department"
            name="department"
            defaultValue={String(row?.department ?? "")}
          />
          <Field label="Job title" name="jobTitle" defaultValue={String(row?.job_title ?? "")} />
          <SelectField
            label="Employment status"
            name="employmentStatus"
            options={["active", "inactive", "on_leave"]}
            defaultValue={String(row?.employment_status ?? "active")}
            required
          />
          <SelectField
            label="Reports to"
            name="manager"
            options={employees
              .filter((item) => item.id !== row?.id)
              .map((item) => ({ value: String(item.id), label: String(item.full_name) }))}
            defaultValue={String(row?.manager_employee_id ?? "")}
          />
          <SelectField
            label="Approval level"
            name="approvalLevel"
            options={[
              { value: "1", label: "Level 1 — Employee submission" },
              { value: "2", label: "Level 2 — Supervisor review" },
              { value: "3", label: "Level 3 — Department approval" },
              { value: "4", label: "Level 4 — HSE / senior review" },
              { value: "5", label: "Level 5 — Final authority" },
            ]}
            defaultValue={String(row?.approval_level ?? 1)}
            required
          />
          <SelectField
            label="System role"
            name="role"
            options={[
              "employee",
              "supervisor",
              "auditor",
              "hse_manager",
              "hse_coordinator",
              "hr_manager",
              "director",
              "admin",
            ]}
            defaultValue={String(row?.role ?? "employee")}
            required
          />
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save employee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RecordDialog({
  active,
  open,
  setOpen,
  employees,
  save,
}: {
  active: OperationalModule;
  open: boolean;
  setOpen: (value: boolean) => void;
  employees: Row[];
  save: (payload: Record<string, unknown>) => Promise<string | void>;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const evidenceModule = (
    ["incidents", "hazards", "observations", "near_misses", "audits"] as const
  ).find((value) => value === active);
  const saveEvidence = useServerFn(saveEvidenceMetadata);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "").trim();
    const shared = {
      module: active,
      site: value("site"),
      department: value("department"),
      location: value("location"),
    } as Record<string, unknown>;
    let payload: Record<string, unknown> = shared;
    if (active === "incidents") {
      const peopleAll = form.getAll("people").map((v) => String(v).trim()).filter(Boolean);
      const inspector = value("inspector");
      const peopleJoined = peopleAll.join(", ");
      payload = {
        ...shared,
        title: value("title"),
        type: value("type"),
        occurredAt: value("date"),
        severity: value("severity"),
        description: value("description"),
        immediateAction: value("immediate"),
        personsInvolved: inspector
          ? `${peopleJoined}${peopleJoined ? " | " : ""}Inspector: ${employees.find((e) => String(e.id) === inspector)?.full_name ?? inspector}`
          : peopleJoined,
        ownerId: value("owner"),
        dueDate: value("dueDate"),
      };
    }

    if (active === "hazards")
      payload = {
        ...shared,
        description: value("description"),
        likelihood: Number(value("likelihood")),
        severity: Number(value("riskSeverity")),
        existingControls: value("controls"),
        additionalControls: value("additionalControls"),
        ownerId: value("owner"),
      };
    if (active === "observations")
      payload = {
        ...shared,
        observationType: value("type"),
        description: value("description"),
        immediateResponse: value("immediate"),
        observedAt: value("date"),
        supervisorId: value("owner"),
      };
    if (active === "near_misses")
      payload = {
        ...shared,
        title: value("title"),
        occurredAt: value("date"),
        description: value("description"),
        potentialSeverity: value("severity"),
        immediateControls: value("immediate"),
        ownerId: value("owner"),
        dueDate: value("dueDate"),
      };
    if (active === "risks")
      payload = {
        ...shared,
        activity: value("title"),
        category: value("type"),
        hazard: value("description"),
        consequence: value("consequence"),
        peopleExposed: value("people"),
        existingControls: value("controls"),
        additionalControls: value("additionalControls"),
        likelihood: Number(value("likelihood")),
        severity: Number(value("riskSeverity")),
        residualLikelihood: Number(value("residualLikelihood")),
        residualSeverity: Number(value("residualSeverity")),
        ownerId: value("owner"),
        reviewDate: value("date"),
      };
    if (active === "audits")
      payload = {
        ...shared,
        title: value("title"),
        auditType: value("type"),
        area: value("location"),
        scope: value("description"),
        leadAuditor: value("leadAuditor"),
        auditTeam: value("people"),
        scheduledOn: value("date"),
      };
    if (active === "capa")
      payload = {
        module: active,
        title: value("title"),
        actionType: value("actionType"),
        sourceType: value("type"),
        sourceReference: value("sourceReference"),
        ownerId: value("owner"),
        dueDate: value("date"),
        priority: value("severity"),
        preventiveAction: value("description"),
      };
    try {
      const recordId = await save(payload);
      if (recordId && evidenceModule && photos.length) {
        const { data: auth } = await supabase.auth.getUser();
        if (auth.user) {
          for (const original of photos) {
            try {
              const file = await compressImage(original);
              const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
              const path = `${auth.user.id}/${evidenceModule}/${recordId}/${crypto.randomUUID()}.${extension}`;
              const { error: uploadError } = await supabase.storage
                .from("hse-evidence")
                .upload(path, file, { contentType: file.type, upsert: false });
              if (uploadError) continue;
              await saveEvidence({
                data: {
                  module: evidenceModule,
                  recordId,
                  storagePath: path,
                  fileName: file.name,
                  mimeType: file.type as "image/jpeg" | "image/png" | "image/webp",
                  fileSize: file.size,
                },
              });
            } catch {
              // Photo failures shouldn't roll back the saved record.
            }
          }
        }
      }
      setPhotos([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The record could not be saved.");
    } finally {
      setSaving(false);
    }
  }
  const employeeOptions = employees.map((row) => ({
    value: String(row.id),
    label: String(row.full_name),
  }));
  const typeOptions =
    active === "incidents"
      ? [
          "injury",
          "environmental",
          "property_damage",
          "near_miss",
          "occupational_illness",
          "security",
          "work_site",
          "safety_observation",
          "other",
        ]

      : active === "observations"
        ? ["positive_behaviour", "unsafe_act", "unsafe_condition"]
        : active === "audits"
          ? ["internal", "external", "one_maestro", "icc_audit", "compliance", "other"]
          : active === "capa"
            ? [
                "incident",
                "hazard",
                "observation",
                "near_miss",
                "risk",
                "audit",
                "inspection",
                "management_review",
                "other",
              ]
            : [
                "physical",
                "chemical",
                "biological",
                "ergonomic",
                "psychosocial",
                "fire",
                "electrical",
                "operational",
              ];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{config[active].action}</DialogTitle>
          <DialogDescription>
            Required fields are marked. Records receive a unique reference automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {!["hazards", "observations"].includes(active) && (
            <Field
              label={active === "risks" ? "Activity / task" : "Title"}
              name="title"
              required
              wide
            />
          )}
          {active === "capa" && (
            <SelectField
              label="Action type"
              name="actionType"
              options={["corrective", "preventive"]}
              required
            />
          )}
          {!["near_misses", "hazards"].includes(active) && (
            <SelectField
              label={
                active === "capa"
                  ? "Source module"
                  : active === "observations"
                    ? "Observation type"
                    : "Category / type"
              }
              name="type"
              options={typeOptions}
              required
            />
          )}
          {active === "capa" && <Field label="Source reference" name="sourceReference" />}
          {!["capa"].includes(active) && (
            <>
              <Field label="Site" name="site" defaultValue="Thika" required />
              <Field label="Department" name="department" required />
            </>
          )}
          {!["risks", "capa"].includes(active) && (
            <Field label={active === "audits" ? "Area" : "Location"} name="location" required />
          )}
          {["incidents", "observations", "near_misses"].includes(active) && (
            <Field label="Date and time" name="date" type="datetime-local" required />
          )}
          {active === "audits" && (
            <>
              <Field label="Scheduled date" name="date" type="date" required />
              <Field label="Lead auditor" name="leadAuditor" required />
            </>
          )}
          {active === "risks" && <Field label="Review date" name="date" type="date" required />}
          {active === "capa" && <Field label="Due date" name="date" type="date" required />}
          {["incidents", "near_misses", "capa"].includes(active) && (
            <SelectField
              label={active === "capa" ? "Priority" : "Severity potential"}
              name="severity"
              options={
                active === "capa"
                  ? ["low", "medium", "high", "critical"]
                  : ["low", "moderate", "high", "critical"]
              }
              required
            />
          )}
          {["incidents", "near_misses", "risks", "hazards", "observations", "capa"].includes(
            active,
          ) && (
            <SelectField
              label={active === "observations" ? "Supervisor" : "Responsible person"}
              name="owner"
              options={employeeOptions}
            />
          )}
          {active === "near_misses" && <></>}
          {active === "hazards" && <></>}
          <TextField
            label={
              active === "audits"
                ? "Scope"
                : active === "capa"
                  ? "Preventive action / detail"
                  : active === "risks"
                    ? "Hazard"
                    : "Description"
            }
            name="description"
            required
          />
          {active === "risks" && (
            <>
              <TextField label="Consequence" name="consequence" required />
              <TextField label="People exposed" name="people" required />
            </>
          )}
          {active === "audits" && <TextField label="Audit team" name="people" />}
          {active === "incidents" && (
            <>
              <div className="space-y-2 sm:col-span-2">
                <Label>Persons involved</Label>
                <p className="text-xs text-muted-foreground">
                  Tap each employee on site during the incident. Works smoothly on mobile.
                </p>
                <div className="max-h-64 overflow-y-auto rounded-md border border-input bg-background p-2">
                  {employeeOptions.length === 0 ? (
                    <p className="px-2 py-3 text-sm text-muted-foreground">
                      No employees available.
                    </p>
                  ) : (
                    <ul className="grid gap-1 sm:grid-cols-2">
                      {employeeOptions.map((opt) => (
                        <li key={opt.value}>
                          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted/60 active:bg-muted">
                            <input
                              type="checkbox"
                              name="people"
                              value={opt.label}
                              className="h-5 w-5 shrink-0 rounded border-input accent-primary"
                            />
                            <span className="truncate">{opt.label}</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              <SelectField label="Name of inspector" name="inspector" options={employeeOptions} />
            </>
          )}


          {["incidents", "observations", "near_misses"].includes(active) && (
            <TextField
              label={
                active === "observations"
                  ? "Immediate response"
                  : active === "near_misses"
                    ? "Immediate controls"
                    : "Immediate action"
              }
              name="immediate"
            />
          )}
          {["incidents", "near_misses"].includes(active) && (
            <Field label="Action due date" name="dueDate" type="date" />
          )}
          {["hazards", "risks"].includes(active) && (
            <>
              <TextField label="Existing controls" name="controls" required />
              <TextField label="Additional controls" name="additionalControls" />
              <SelectField
                label="Initial likelihood"
                name="likelihood"
                options={["1", "2", "3", "4", "5"]}
                required
              />
              <SelectField
                label="Initial severity"
                name="riskSeverity"
                options={["1", "2", "3", "4", "5"]}
                required
              />
            </>
          )}
          {active === "risks" && (
            <>
              <SelectField
                label="Residual likelihood"
                name="residualLikelihood"
                options={["1", "2", "3", "4", "5"]}
                required
              />
              <SelectField
                label="Residual severity"
                name="residualSeverity"
                options={["1", "2", "3", "4", "5"]}
                required
              />
            </>
          )}
          {evidenceModule && (
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="record-photos">Attach photos (optional)</Label>
              <Input
                id="record-photos"
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                onChange={(event) =>
                  setPhotos(Array.from(event.currentTarget.files ?? []).slice(0, 10))
                }
              />
              <p className="text-xs text-muted-foreground">
                {photos.length
                  ? `${photos.length} photo${photos.length === 1 ? "" : "s"} ready to upload after save.`
                  : "Tap to choose from your gallery or take a new photo. JPG/PNG/WebP, up to 10 files."}
              </p>
            </div>
          )}
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save record"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RiskMatrix() {
  const values = [5, 4, 3, 2, 1];
  return (
    <section className="border bg-card">
      <div className="border-b px-5 py-4">
        <h3 className="font-bold">5×5 risk matrix</h3>
        <p className="text-sm text-muted-foreground">Likelihood × severity</p>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-5 gap-1">
          {values.flatMap((likelihood) =>
            [1, 2, 3, 4, 5].map((severity) => {
              const score = likelihood * severity;
              const rating =
                score <= 4 ? "low" : score <= 9 ? "medium" : score <= 16 ? "high" : "extreme";
              return (
                <div
                  key={`${likelihood}-${severity}`}
                  className={`grid aspect-square place-items-center rounded text-xs font-bold ${rating === "low" ? "bg-success/20 text-success" : rating === "medium" ? "bg-safety/35 text-safety-foreground" : rating === "high" ? "bg-warning/20 text-warning" : "bg-destructive/15 text-destructive"}`}
                  title={`${rating}: ${score}`}
                >
                  {score}
                </div>
              );
            }),
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold text-muted-foreground">
          <span>1–4 Low</span>
          <span>5–9 Medium</span>
          <span>10–16 High</span>
          <span>17–25 Extreme</span>
        </div>
      </div>
    </section>
  );
}
function Field({
  label,
  name,
  type = "text",
  required = false,
  wide = false,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  wide?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        maxLength={type === "text" ? 200 : undefined}
      />
    </div>
  );
}
function TextField({
  label,
  name,
  required = false,
}: {
  label: string;
  name: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </Label>
      <BulletTextarea
        id={name}
        name={name}
        required={required}
        maxLength={4000}
        rows={5}
        className="min-h-[120px] max-h-[360px] resize-y overflow-y-auto whitespace-pre-wrap break-words"
      />
    </div>
  );
}
function SelectField({
  label,
  name,
  options,
  required = false,
  defaultValue,
}: {
  label: string;
  name: string;
  options: Array<string | { value: string; label: string }>;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required ? " *" : ""}
      </Label>
      <select
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="">Select…</option>
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { value: option, label: option.replaceAll("_", " ") }
              : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </div>
  );
}
function RiskBadge({ value, score }: { value: string; score?: unknown }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${["extreme", "critical"].includes(value) ? "bg-destructive/10 text-destructive" : value === "high" ? "bg-warning/15 text-warning" : value === "low" ? "bg-success/15 text-success" : "bg-safety/20 text-safety-foreground"}`}
    >
      {value.replaceAll("_", " ")}
      {score ? ` · ${String(score)}` : ""}
    </span>
  );
}
function Status({ value }: { value: string }) {
  const v = (value ?? "").toLowerCase();
  const map: Record<string, string> = {
    // Account status
    active: "bg-emerald-500 text-white shadow-sm",
    invited: "bg-lime-400 text-lime-950 shadow-sm",
    not_invited: "bg-stone-300 text-stone-800",
    suspended: "bg-amber-400 text-amber-950 shadow-sm",
    disabled: "bg-stone-400 text-white",
    // Workflow statuses — vivid, distinct, catchy
    reported: "bg-sky-500 text-white shadow-sm",
    investigated: "bg-amber-500 text-white shadow-sm",
    approved: "bg-emerald-500 text-white shadow-sm",
    actioned: "bg-indigo-500 text-white shadow-sm",
    verified: "bg-teal-500 text-white shadow-sm",
    closed: "bg-emerald-600 text-white shadow",
    completed: "bg-emerald-600 text-white shadow",
    open: "bg-sky-500 text-white shadow-sm",
    in_progress: "bg-violet-500 text-white shadow-sm",
    overdue: "bg-rose-600 text-white shadow-md animate-pulse",
    critical: "bg-rose-700 text-white shadow-md animate-pulse",
    draft: "bg-slate-400 text-white",
    pending: "bg-yellow-400 text-yellow-950 shadow-sm",
    scheduled: "bg-blue-500 text-white shadow-sm",
    rejected: "bg-rose-500 text-white shadow-sm",
  };
  const cls = map[v] ?? "bg-slate-400 text-white";
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider capitalize ring-1 ring-black/5 ${cls}`}
    >
      {value.replaceAll("_", " ")}
    </span>
  );
}

function Empty({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="p-12 text-center">
      <BarChart3 className="mx-auto mb-3 size-9 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">{text}</p>
      {children && <div className="mt-4 flex justify-center">{children}</div>}
    </div>
  );
}
