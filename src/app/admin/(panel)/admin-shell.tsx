"use client";

import { useQueryClient } from "@tanstack/react-query";
import { FolderTree, Images, LayoutDashboard, LogOut, Menu, Package, Shapes, SlidersHorizontal, Tag, type LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "./use-current-user";

type NavLabel = "dashboard" | "products" | "media" | "attributes" | "types" | "categories" | "brands";
type NavItem = { href: string; label: NavLabel; icon: LucideIcon };
type NavGroup = { title?: "catalog"; items: NavItem[] };

const navigation: NavGroup[] = [
  { items: [{ href: "/admin", label: "dashboard", icon: LayoutDashboard }] },
  {
    title: "catalog",
    items: [
      { href: "/admin/catalog/products", label: "products", icon: Package },
      { href: "/admin/media", label: "media", icon: Images },
      { href: "/admin/catalog/attributes", label: "attributes", icon: SlidersHorizontal },
      { href: "/admin/catalog/types", label: "types", icon: Shapes },
      { href: "/admin/catalog/categories", label: "categories", icon: FolderTree },
      { href: "/admin/catalog/brands", label: "brands", icon: Tag },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useCurrentUser();

  async function logout() {
    await api.POST("/api/auth/logout");
    queryClient.clear();
    router.replace("/admin/login");
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <Link href="/admin" onClick={onNavigate} className="px-2 pt-1">
        <Image src="/brand/wordmark-black.png" alt="Depad" width={110} height={49} loading="eager" className="h-auto w-24" />
      </Link>
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto" aria-label="Admin">
        {navigation.map((group, index) => (
          <div key={group.title ?? index} className="flex flex-col gap-1">
            {group.title && <p className="px-3 text-xs font-medium tracking-wide text-muted-foreground/70 uppercase">{t(group.title)}</p>}
            {group.items.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={isActive(pathname, href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  isActive(pathname, href) && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
                )}
              >
                <Icon className="size-4" />
                {t(label)}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <Separator />
      <div className="flex flex-col gap-2 px-2">
        {user.data ? (
          <p className="truncate text-sm text-muted-foreground" data-testid="current-user">
            {user.data.email}
          </p>
        ) : (
          <Skeleton className="h-4 w-36" />
        )}
        <Button variant="ghost" size="sm" className="justify-start px-0 text-muted-foreground" onClick={logout}>
          <LogOut className="size-4" />
          {t("logout")}
        </Button>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const t = useTranslations("admin.nav");
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-svh bg-muted/30">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 border-r bg-background md:block">
        <Sidebar />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={t("openMenu")} />}>
              <Menu className="size-5" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetTitle className="sr-only">{t("openMenu")}</SheetTitle>
              <Sidebar onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Image src="/brand/wordmark-black.png" alt="Depad" width={90} height={40} className="h-auto w-20" />
        </header>
        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>
    </div>
  );
}
