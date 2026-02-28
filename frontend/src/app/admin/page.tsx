"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, Shield, Users, ShoppingBag, FileText, MessageSquare, Flag, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/services/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  is_banned: boolean;
  created_at: string | null;
}

interface AdminVaultPost {
  id: string;
  title: string;
  category: string;
  status: string;
  is_anonymous: boolean;
  flag_count: number;
  author: { id: string; name: string } | null;
  created_at: string | null;
}

interface AdminListing {
  id: string;
  title: string;
  price: number;
  category: string;
  status: string;
  seller: { id: string; name: string } | null;
  created_at: string | null;
}

interface AdminFeedback {
  id: string;
  type: string;
  subject: string;
  message: string;
  status: string;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
  user: { id: string; name: string; email: string };
}

interface AdminReport {
  id: string;
  reporter: { id: string; name: string; avatar_url: string | null };
  reported_user: { id: string; name: string; avatar_url: string | null };
  reason: string;
  explanation: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA");
}

function StatusBadge({ status }: { status: string }) {
  const color: Record<string, string> = {
    active: "bg-green-500/20 text-green-400",
    sold: "bg-blue-500/20 text-blue-400",
    reserved: "bg-yellow-500/20 text-yellow-400",
    deleted: "bg-red-500/20 text-red-400",
    hidden: "bg-orange-500/20 text-orange-400",
    pending: "bg-yellow-500/20 text-yellow-400",
    resolved: "bg-green-500/20 text-green-400",
    dismissed: "bg-zinc-500/20 text-zinc-400",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color[status] ?? "bg-zinc-500/20 text-zinc-400"}`}>
      {status}
    </span>
  );
}

// ─── Pagination controls ──────────────────────────────────────────────────────

function Pagination({
  page,
  hasMore,
  total,
  perPage,
  onPrev,
  onNext,
}: {
  page: number;
  hasMore: boolean;
  total: number;
  perPage: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-zinc-400">
      <span>{total > 0 ? `${from}–${to} of ${total}` : "0 results"}</span>
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={onPrev}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="ghost" disabled={!hasMore} onClick={onNext}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Generic delete button ────────────────────────────────────────────────────

function DeleteButton({ onDelete, label = "Delete" }: { onDelete: () => Promise<void>; label?: string }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handle() {
    if (!confirm(`Are you sure you want to ${label.toLowerCase()}?`)) return;
    setLoading(true);
    try {
      await onDelete();
      toast({ description: `${label} successful.` });
    } catch (err) {
      toast({ description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={handle} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </Button>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [data, setData] = useState<PagedResult<AdminUser> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const result = await api.admin.getUsers(p, 50);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  async function handleDelete(userId: string) {
    await api.admin.deleteUser(userId);
    await load(page);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>;
  if (!data) return null;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-left">
              <th className="pb-2 pr-4 font-medium">Name</th>
              <th className="pb-2 pr-4 font-medium">Email</th>
              <th className="pb-2 pr-4 font-medium">Joined</th>
              <th className="pb-2 pr-4 font-medium">Flags</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((u) => (
              <tr key={u.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="py-2 pr-4">
                  <span className="font-medium">{u.name}</span>
                  {u.is_admin && <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full">admin</span>}
                </td>
                <td className="py-2 pr-4 text-zinc-400">{u.email}</td>
                <td className="py-2 pr-4 text-zinc-500">{fmtDate(u.created_at)}</td>
                <td className="py-2 pr-4">
                  {u.is_banned && <StatusBadge status="banned" />}
                </td>
                <td className="py-2 text-right">
                  {!u.is_admin && (
                    <DeleteButton onDelete={() => handleDelete(u.id)} label="Delete user" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} hasMore={data.has_more} total={data.total} perPage={data.per_page} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
    </div>
  );
}

// ─── Listings Tab ─────────────────────────────────────────────────────────────

function ListingsTab() {
  const [data, setData] = useState<PagedResult<AdminListing> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const result = await api.admin.getListings(p, 50);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  async function handleDelete(id: string) {
    await api.admin.deleteListing(id);
    await load(page);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>;
  if (!data) return null;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-left">
              <th className="pb-2 pr-4 font-medium">Title</th>
              <th className="pb-2 pr-4 font-medium">Seller</th>
              <th className="pb-2 pr-4 font-medium">Price</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium">Listed</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((l) => (
              <tr key={l.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="py-2 pr-4 font-medium max-w-[200px] truncate">{l.title}</td>
                <td className="py-2 pr-4 text-zinc-400">{l.seller?.name ?? "—"}</td>
                <td className="py-2 pr-4">${l.price.toFixed(2)}</td>
                <td className="py-2 pr-4"><StatusBadge status={l.status} /></td>
                <td className="py-2 pr-4 text-zinc-500">{fmtDate(l.created_at)}</td>
                <td className="py-2 text-right">
                  {l.status !== "deleted" && (
                    <DeleteButton onDelete={() => handleDelete(l.id)} label="Delete listing" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} hasMore={data.has_more} total={data.total} perPage={data.per_page} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
    </div>
  );
}

// ─── Vault Posts Tab ──────────────────────────────────────────────────────────

function VaultTab() {
  const [data, setData] = useState<PagedResult<AdminVaultPost> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const result = await api.admin.getVaultPosts(p, 50);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  async function handleDelete(id: string) {
    await api.admin.deleteVaultPost(id);
    await load(page);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>;
  if (!data) return null;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500 text-left">
              <th className="pb-2 pr-4 font-medium">Title</th>
              <th className="pb-2 pr-4 font-medium">Author</th>
              <th className="pb-2 pr-4 font-medium">Category</th>
              <th className="pb-2 pr-4 font-medium">Status</th>
              <th className="pb-2 pr-4 font-medium">Flags</th>
              <th className="pb-2 pr-4 font-medium">Posted</th>
              <th className="pb-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((p) => (
              <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="py-2 pr-4 font-medium max-w-[200px] truncate">{p.title}</td>
                <td className="py-2 pr-4 text-zinc-400">
                  {p.is_anonymous ? <span className="text-zinc-500 italic">Anonymous</span> : (p.author?.name ?? "—")}
                </td>
                <td className="py-2 pr-4 text-zinc-400">{p.category}</td>
                <td className="py-2 pr-4"><StatusBadge status={p.status} /></td>
                <td className="py-2 pr-4">
                  {p.flag_count > 0 && (
                    <span className="flex items-center gap-1 text-orange-400">
                      <Flag className="w-3 h-3" /> {p.flag_count}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-4 text-zinc-500">{fmtDate(p.created_at)}</td>
                <td className="py-2 text-right">
                  {p.status !== "deleted" && (
                    <DeleteButton onDelete={() => handleDelete(p.id)} label="Delete post" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} hasMore={data.has_more} total={data.total} perPage={data.per_page} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
    </div>
  );
}

// ─── Feedback Tab ─────────────────────────────────────────────────────────────

const FEEDBACK_PER_PAGE = 50;

function FeedbackTab() {
  const [items, setItems] = useState<AdminFeedback[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const result = await api.admin.getFeedback(p, FEEDBACK_PER_PAGE);
      setItems(result.items);
      setTotal(result.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  const hasMore = page * FEEDBACK_PER_PAGE < total;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>;

  return (
    <div>
      <div className="space-y-3">
        {items.map((f) => (
          <div key={f.id} className="rounded-lg border border-zinc-800 p-4 bg-zinc-900/50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium">{f.subject}</span>
                  <Badge variant="outline" className="text-xs">{f.type}</Badge>
                  <StatusBadge status={f.status} />
                </div>
                <p className="text-sm text-zinc-400 mb-2">{f.message}</p>
                <p className="text-xs text-zinc-500">
                  From <span className="text-zinc-400">{f.user.name}</span> ({f.user.email}) · {fmtDate(f.created_at)}
                </p>
                {f.admin_response && (
                  <div className="mt-2 text-xs bg-zinc-800 rounded p-2 text-zinc-300">
                    <span className="text-zinc-500">Admin response: </span>{f.admin_response}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Pagination page={page} hasMore={hasMore} total={total} perPage={FEEDBACK_PER_PAGE} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
    </div>
  );
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────

function ReportsTab() {
  const [data, setData] = useState<PagedResult<AdminReport> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const result = await api.admin.getReports(p, 50);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-zinc-500" /></div>;
  if (!data) return null;

  return (
    <div>
      <div className="space-y-3">
        {data.items.map((r) => (
          <div key={r.id} className="rounded-lg border border-zinc-800 p-4 bg-zinc-900/50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">{r.reason}</Badge>
                  <StatusBadge status={r.status} />
                  <span className="text-xs text-zinc-500">{fmtDate(r.created_at)}</span>
                </div>
                <p className="text-sm text-zinc-400 mb-2">{r.explanation}</p>
                <p className="text-xs text-zinc-500">
                  Reporter: <span className="text-zinc-400">{r.reporter.name}</span>
                  {" · "}
                  Reported: <span className="text-zinc-400">{r.reported_user.name}</span>
                </p>
                {r.admin_notes && (
                  <div className="mt-2 text-xs bg-zinc-800 rounded p-2 text-zinc-300">
                    <span className="text-zinc-500">Admin notes: </span>{r.admin_notes}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Pagination page={page} hasMore={data.has_more} total={data.total} perPage={data.per_page} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = "yorkpulse.app@gmail.com";

function isAdmin(user: { is_admin?: boolean; email?: string } | null) {
  return user?.is_admin === true || user?.email?.toLowerCase() === ADMIN_EMAIL;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !isAdmin(user)) {
      router.replace("/");
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated || !isAdmin(user)) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <p className="text-sm text-zinc-500">Manage YorkPulse content and users</p>
        </div>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="users" className="flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Users
          </TabsTrigger>
          <TabsTrigger value="listings" className="flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4" /> Listings
          </TabsTrigger>
          <TabsTrigger value="vault" className="flex items-center gap-1.5">
            <FileText className="w-4 h-4" /> Vault Posts
          </TabsTrigger>
          <TabsTrigger value="feedback" className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4" /> Feedback
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-1.5">
            <Flag className="w-4 h-4" /> Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="listings"><ListingsTab /></TabsContent>
        <TabsContent value="vault"><VaultTab /></TabsContent>
        <TabsContent value="feedback"><FeedbackTab /></TabsContent>
        <TabsContent value="reports"><ReportsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
