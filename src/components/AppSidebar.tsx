import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  UserCircle2,
  ClipboardList,
  LogOut,
  FileBarChart2,
  Target,
  UserCheck,
  UserPlus,
  History,
  Settings,
  ChevronRight,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { useState, type ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import bfpLogo from "@/assets/bfp-mimaropa.svg";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useAuth, type AppModule } from "@/lib/auth";
import AvatarWithFallback from "@/components/avatar-with-fallback";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  module: AppModule;
  children?: NavItem[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Menu-to-module map. Sidebar visibility is driven entirely by
// `canAccess(module)` from AuthContext — no per-item role arrays.
const GROUPS: NavGroup[] = [
  {
    label: "Personal",
    items: [
      {
        to: "/",
        label: "Dashboard",
        icon: <LayoutDashboard className="h-4 w-4" />,
        module: "dashboard",
      },
      {
        to: "/profile",
        label: "My Profile",
        icon: <UserCircle2 className="h-4 w-4" />,
        module: "profile",
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        to: "/monitoring",
        label: "Fire Safety Compliance",
        icon: <ClipboardList className="h-4 w-4" />,
        module: "monitoring",
      },
      {
        to: "/target-reference",
        label: "Target Reference",
        icon: <Target className="h-4 w-4" />,
        module: "monitoring",
      },
      {
        to: "/revision-requests",
        label: "Revision Request",
        icon: <History className="h-4 w-4" />,
        module: "target-revisions",
        children: [
          {
            to: "/settings",
            label: "Settings",
            icon: <Settings className="h-4 w-4" />,
            module: "target-revisions",
          },
        ],
      },
    ],
  },
  {
    label: "Report",
    items: [
      {
        to: "/reports",
        label: "Matrix Reports",
        icon: <FileBarChart2 className="h-4 w-4" />,
        module: "reports",
      },
    ],
  },
  {
    label: "User",
    items: [
      {
        to: "/users/available",
        label: "Available Users",
        icon: <UserPlus className="h-4 w-4" />,
        module: "users",
      },
      {
        to: "/users/active",
        label: "Active Users",
        icon: <UserCheck className="h-4 w-4" />,
        module: "users",
      },
    ],
  },
];

export function AppSidebar() {
  const { user, logout, canAccess, systemAccess } = useAuth();
  const [signoutOpen, setSignoutOpen] = useState(false);
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isActive = (to: string) => pathname === to || (to !== "/" && pathname.startsWith(to));

  const closeOnMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const canSee = (item: NavItem) => canAccess(item.module);

  const displayName = user
    ? [user.rankcode, user.fullname].filter(Boolean).join(" ") || user.fullname || user.name
    : "";
  const roleName = systemAccess?.rolename ?? "";
  
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link
          to="/"
          onClick={closeOnMobile}
          className={`flex min-w-0 items-center gap-2.5 py-1.5 ${collapsed ? "justify-center px-0" : "px-1"}`}
        >
          <div
            className={`grid shrink-0 place-items-center rounded-xl bg-white p-1 shadow-elegant ring-1 ring-sidebar-border transition-all ${
              collapsed ? "h-8 w-8 p-0.5" : "h-11 w-11"
            }`}
          >
            <img
              src={bfpLogo}
              alt="BFP MIMAROPA"
              loading="eager"
              className="h-full w-full object-contain"
            />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight">BFP MIMAROPA</div>
              <div className="truncate text-[10px] uppercase tracking-wider text-sidebar-foreground/70">
                Fire Safety Inspection
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {GROUPS.map((group) => {
          const items = group.items.filter(canSee);
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const visibleChildren = item.children?.filter(canSee) ?? [];
                    const hasChildren = visibleChildren.length > 0;
                    const isItemActive = isActive(item.to);
                    const isChildActive = visibleChildren.some((c) => isActive(c.to));
                    const isOpen = isItemActive || isChildActive;

                    if (!hasChildren) {
                      return (
                        <SidebarMenuItem key={item.to}>
                          <SidebarMenuButton asChild isActive={isItemActive} tooltip={item.label}>
                            <Link to={item.to} onClick={closeOnMobile}>
                              {item.icon}
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }

                    return (
                      <Collapsible key={item.to} defaultOpen={isOpen} className="group/collapsible">
                        <SidebarMenuItem>
                          <SidebarMenuButton asChild isActive={isItemActive} tooltip={item.label}>
                            <Link to={item.to} onClick={closeOnMobile}>
                              {item.icon}
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuAction
                              aria-label={`Toggle ${item.label} menu`}
                              className="transition-transform group-data-[state=open]/collapsible:rotate-90"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </SidebarMenuAction>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {visibleChildren.map((child) => (
                                <SidebarMenuSubItem key={child.to}>
                                  <SidebarMenuSubButton asChild isActive={isActive(child.to)}>
                                    <Link to={child.to} onClick={closeOnMobile}>
                                      {child.icon}
                                      <span>{child.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {user && (
          <div
            className={
              collapsed
                ? "flex flex-col items-center gap-2 py-1"
                : "flex items-center gap-2 px-1 py-1"
            }
          >
            <Link
              to="/profile"
              onClick={closeOnMobile}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-sidebar-accent"
              aria-label="My Profile"
            >
              <AvatarWithFallback
                entity={user}
                src={user.profileurl || undefined}
                name={displayName}
                className="h-9 w-9 shrink-0"
              />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold leading-tight">{displayName}</div>
                  <div className="truncate text-[11px] text-sidebar-foreground/70">{roleName}</div>
                </div>
              )}
            </Link>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                      onClick={() => setSignoutOpen(true)}
                    aria-label="Sign out"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-destructive transition-colors hover:bg-destructive/10 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="bg-destructive text-destructive-foreground">Sign out</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </SidebarFooter>
        <ConfirmDialog
          open={signoutOpen}
          onOpenChange={(v) => setSignoutOpen(v)}
          title="Sign out"
          description="Are you sure you want to sign out?"
          ContentIcon={LogOut}
          contentIconBgClass="bg-destructive/10"
          contentIconColorClass="text-destructive"
          confirmLabel="Sign out"
          confirmVariant="destructive"
          onConfirm={() => {
            setSignoutOpen(false);
            logout();
            closeOnMobile();
            navigate("/");
          }}
        />
    </Sidebar>
  );
}
