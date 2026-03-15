"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, Shield, Users, ShoppingBag, FileText, MessageSquare, Flag, ChevronLeft, ChevronRight, BookOpen, Image, Search } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/useAuth";
import { api } from "@/services/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AdminUser {
  id: string;
  name: string;
  email: string;
  is_admin: boolean;
  is_banned: boolean;
  created_at: string | null;
  last_login_at: string | null;
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

function fmtDateTime(iso: string | null) {
  if (!iso) return "Never";
  const d = new Date(iso);
  return d.toLocaleDateString("en-CA") + " " + d.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
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
    dismissed: "bg-zinc-500/20 text-gray-500",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color[status] ?? "bg-zinc-500/20 text-gray-500"}`}>
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
    <div className="flex items-center justify-between mt-4 text-sm text-gray-500">
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
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (p: number, q: string) => {
    setLoading(true);
    try {
      const result = await api.admin.getUsers(p, 50, q || undefined);
      setData(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, debouncedSearch); }, [load, page, debouncedSearch]);

  function handleSearchChange(val: string) {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(val);
    }, 300);
  }

  async function handleDelete(userId: string) {
    await api.admin.deleteUser(userId);
    await load(page, debouncedSearch);
  }

  return (
    <div>
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : !data ? null : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 text-left">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Last Login</th>
                  <th className="pb-2 pr-4 font-medium">Joined</th>
                  <th className="pb-2 pr-4 font-medium">Flags</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u.id} className="border-b border-gray-200/50 hover:bg-gray-100/30">
                    <td className="py-2 pr-4">
                      <span className="font-medium">{u.name}</span>
                      {u.is_admin && <span className="ml-2 text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded-full">admin</span>}
                    </td>
                    <td className="py-2 pr-4 text-gray-500">{u.email}</td>
                    <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">{fmtDateTime(u.last_login_at)}</td>
                    <td className="py-2 pr-4 text-gray-400">{fmtDate(u.created_at)}</td>
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
        </>
      )}
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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!data) return null;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-400 text-left">
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
              <tr key={l.id} className="border-b border-gray-200/50 hover:bg-gray-100/30">
                <td className="py-2 pr-4 font-medium max-w-[200px] truncate">{l.title}</td>
                <td className="py-2 pr-4 text-gray-500">{l.seller?.name ?? "—"}</td>
                <td className="py-2 pr-4">${l.price.toFixed(2)}</td>
                <td className="py-2 pr-4"><StatusBadge status={l.status} /></td>
                <td className="py-2 pr-4 text-gray-400">{fmtDate(l.created_at)}</td>
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

interface VaultComment {
  id: string;
  content: string;
  is_anonymous: boolean;
  author: { id: string; name: string; avatar_url: string | null } | null;
  created_at: string;
}

function VaultPostComments({ postId }: { postId: string }) {
  const [comments, setComments] = useState<VaultComment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.admin.getVaultPostComments(postId).then((res) => {
      setComments(res.items);
      setLoading(false);
    });
  }, [postId]);

  if (loading) return <div className="py-2 pl-4 text-xs text-gray-400 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> Loading comments…</div>;
  if (comments.length === 0) return <div className="py-2 pl-4 text-xs text-gray-400">No comments.</div>;

  return (
    <div className="pl-4 pb-3 space-y-2">
      {comments.map((c) => (
        <div key={c.id} className="flex items-start gap-2 text-xs">
          <div className="w-1.5 h-1.5 rounded-full bg-gray-300 mt-1.5 flex-shrink-0" />
          <div>
            <span className="font-medium text-gray-700">
              {c.author?.name ?? "—"}
            </span>
            {c.is_anonymous && <span className="text-gray-400 italic ml-1">(anon)</span>}
            <span className="text-gray-400 ml-2">{c.content}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function VaultTab() {
  const [data, setData] = useState<PagedResult<AdminVaultPost> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
    if (expandedId === id) setExpandedId(null);
    await load(page);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!data) return null;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-400 text-left">
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
              <>
                <tr
                  key={p.id}
                  className="border-b border-gray-200/50 hover:bg-gray-100/30 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                >
                  <td className="py-2 pr-4 font-medium max-w-[200px] truncate">
                    <span className="text-gray-400 mr-1">{expandedId === p.id ? "▾" : "▸"}</span>
                    {p.title}
                  </td>
                  <td className="py-2 pr-4 text-gray-500">
                    {p.is_anonymous
                      ? <span>{p.author?.name ?? "—"} <span className="text-gray-400 italic">(anon)</span></span>
                      : (p.author?.name ?? "—")
                    }
                  </td>
                  <td className="py-2 pr-4 text-gray-500">{p.category}</td>
                  <td className="py-2 pr-4"><StatusBadge status={p.status} /></td>
                  <td className="py-2 pr-4">
                    {p.flag_count > 0 && (
                      <span className="flex items-center gap-1 text-orange-400">
                        <Flag className="w-3 h-3" /> {p.flag_count}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-gray-400">{fmtDate(p.created_at)}</td>
                  <td className="py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    {p.status !== "deleted" && (
                      <DeleteButton onDelete={() => handleDelete(p.id)} label="Delete post" />
                    )}
                  </td>
                </tr>
                {expandedId === p.id && (
                  <tr key={`${p.id}-comments`} className="bg-gray-50 border-b border-gray-200/50">
                    <td colSpan={7} className="pt-1">
                      <VaultPostComments postId={p.id} />
                    </td>
                  </tr>
                )}
              </>
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
  const { toast } = useToast();

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

  async function handleResolve(id: string) {
    await api.admin.resolveFeedback(id);
    toast({ description: "Marked as resolved." });
    await load(page);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this feedback?")) return;
    await api.admin.deleteFeedback(id);
    toast({ description: "Feedback deleted." });
    await load(page);
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div>
      <div className="space-y-3">
        {items.map((f) => (
          <div key={f.id} className="rounded-lg border border-gray-200 p-4 bg-white/50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium">{f.subject}</span>
                  <Badge variant="outline" className="text-xs">{f.type}</Badge>
                  <StatusBadge status={f.status} />
                </div>
                <p className="text-sm text-gray-500 mb-2">{f.message}</p>
                <p className="text-xs text-gray-400">
                  From <span className="text-gray-500">{f.user.name}</span> ({f.user.email}) · {fmtDate(f.created_at)}
                </p>
                {f.admin_response && (
                  <div className="mt-2 text-xs bg-gray-100 rounded p-2 text-gray-700">
                    <span className="text-gray-400">Admin response: </span>{f.admin_response}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {f.status !== "resolved" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-green-400 hover:text-green-300 hover:bg-green-500/10 text-xs"
                    onClick={() => handleResolve(f.id)}
                  >
                    ✓ Resolve
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  onClick={() => handleDelete(f.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
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

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!data) return null;

  return (
    <div>
      <div className="space-y-3">
        {data.items.map((r) => (
          <div key={r.id} className="rounded-lg border border-gray-200 p-4 bg-white/50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Badge variant="outline" className="text-xs">{r.reason}</Badge>
                  <StatusBadge status={r.status} />
                  <span className="text-xs text-gray-400">{fmtDate(r.created_at)}</span>
                </div>
                <p className="text-sm text-gray-500 mb-2">{r.explanation}</p>
                <p className="text-xs text-gray-400">
                  Reporter: <span className="text-gray-500">{r.reporter.name}</span>
                  {" · "}
                  Reported: <span className="text-gray-500">{r.reported_user.name}</span>
                </p>
                {r.admin_notes && (
                  <div className="mt-2 text-xs bg-gray-100 rounded p-2 text-gray-700">
                    <span className="text-gray-400">Admin notes: </span>{r.admin_notes}
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

// ─── Course Monitor Tab ───────────────────────────────────────────────────────

function CourseMonitorTab() {
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof api.admin.getCourseOverview>> | null>(null);
  const [messages, setMessages] = useState<Awaited<ReturnType<typeof api.admin.getCourseMessages>> | null>(null);
  const [votes, setVotes] = useState<Awaited<ReturnType<typeof api.admin.getCourseVotes>> | null>(null);
  const [msgPage, setMsgPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<"courses" | "messages" | "votes">("courses");
  const { toast } = useToast();

  const loadOverview = useCallback(async () => {
    const [ov, vt] = await Promise.all([
      api.admin.getCourseOverview(),
      api.admin.getCourseVotes(),
    ]);
    setOverview(ov);
    setVotes(vt);
  }, []);

  const loadMessages = useCallback(async (p: number) => {
    const result = await api.admin.getCourseMessages(p, 50);
    setMessages(result);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadOverview().finally(() => setLoading(false));
  }, [loadOverview]);

  useEffect(() => {
    if (section === "messages") {
      setLoading(true);
      loadMessages(msgPage).finally(() => setLoading(false));
    }
  }, [section, msgPage, loadMessages]);

  async function handleDeleteMessage(id: string) {
    await api.admin.deleteCourseMessage(id);
    toast({ description: "Message deleted." });
    await loadMessages(msgPage);
  }

  if (loading && !overview) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div>
      {/* Sub-nav */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-3">
        {(["courses", "messages", "votes"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              section === s ? "bg-gray-100 text-white" : "text-gray-400 hover:text-gray-700"
            }`}
          >
            {s === "courses" ? "Enrollments" : s === "messages" ? "Messages" : "Prof Votes"}
          </button>
        ))}
      </div>

      {/* ── Enrollments ── */}
      {section === "courses" && overview && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: "Total Courses", value: overview.total_courses },
              { label: "Total Members", value: overview.total_members },
              { label: "Total Messages", value: overview.total_messages },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-gray-200 bg-white/50 p-4 text-center">
                <p className="text-2xl font-bold">{s.value.toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-gray-400 text-left">
                  <th className="pb-2 pr-4 font-medium">Course</th>
                  <th className="pb-2 pr-4 font-medium">Faculty</th>
                  <th className="pb-2 pr-4 font-medium text-right">Members</th>
                  <th className="pb-2 pr-4 font-medium text-right">Messages</th>
                  <th className="pb-2 font-medium text-right">Channels</th>
                </tr>
              </thead>
              <tbody>
                {overview.top_courses.map((c) => (
                  <tr key={c.id} className="border-b border-gray-200/50 hover:bg-gray-100/30">
                    <td className="py-2 pr-4">
                      <span className="font-mono text-purple-400 text-xs mr-2">{c.code}</span>
                      <span className="text-gray-700 truncate max-w-[200px] inline-block align-middle">{c.name}</span>
                    </td>
                    <td className="py-2 pr-4 text-gray-400 text-xs">{c.faculty}</td>
                    <td className="py-2 pr-4 text-right font-medium">{c.member_count}</td>
                    <td className="py-2 pr-4 text-right text-gray-500">{c.message_count}</td>
                    <td className="py-2 text-right text-gray-500">{c.channel_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      {section === "messages" && (
        <div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
          ) : messages && (
            <>
              <div className="space-y-2">
                {messages.items.map((m) => (
                  <div key={m.id} className="rounded-lg border border-gray-200 bg-white/50 p-3 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-medium text-sm">{m.user_name}</span>
                        <span className="text-xs text-gray-400">{m.user_email}</span>
                        <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5 font-mono text-purple-400">{m.course_code}</span>
                        <span className="text-xs text-gray-400">#{m.channel_name}</span>
                        <span className="text-xs text-gray-500 ml-auto">{fmtDate(m.created_at)}</span>
                      </div>
                      {m.message && <p className="text-sm text-gray-700">{m.message}</p>}
                      {m.image_url && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400 mt-1">
                          <Image className="w-3 h-3" /> Image attachment
                        </span>
                      )}
                    </div>
                    <DeleteButton onDelete={() => handleDeleteMessage(m.id)} label="Delete message" />
                  </div>
                ))}
              </div>
              <Pagination
                page={msgPage}
                hasMore={messages.has_more}
                total={messages.total}
                perPage={50}
                onPrev={() => setMsgPage(p => p - 1)}
                onNext={() => setMsgPage(p => p + 1)}
              />
            </>
          )}
        </div>
      )}

      {/* ── Prof Votes ── */}
      {section === "votes" && votes && (
        <div>
          {votes.votes.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No professor votes yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-400 text-left">
                    <th className="pb-2 pr-4 font-medium">Course</th>
                    <th className="pb-2 pr-4 font-medium">Professor</th>
                    <th className="pb-2 pr-4 font-medium">Semester</th>
                    <th className="pb-2 font-medium text-right">Votes</th>
                  </tr>
                </thead>
                <tbody>
                  {votes.votes.map((v, i) => (
                    <tr key={i} className="border-b border-gray-200/50 hover:bg-gray-100/30">
                      <td className="py-2 pr-4">
                        <span className="font-mono text-purple-400 text-xs mr-2">{v.course_code}</span>
                        <span className="text-gray-500 text-xs">{v.course_name}</span>
                      </td>
                      <td className="py-2 pr-4 font-medium">{v.prof_name}</td>
                      <td className="py-2 pr-4 text-gray-500">{v.semester}</td>
                      <td className="py-2 text-right">
                        <span className={`font-medium ${v.vote_count >= v.threshold ? "text-green-400" : "text-gray-700"}`}>
                          {v.vote_count}/{v.threshold}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
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
  const { user, isAuthenticated, isHydrated } = useAuthStore();
  const { isLoading } = useUser();

  useEffect(() => {
    // Wait for store to hydrate AND user query to finish before redirecting
    if (!isHydrated || isLoading) return;
    if (!isAuthenticated || !isAdmin(user)) {
      router.replace("/");
    }
  }, [isHydrated, isLoading, isAuthenticated, user, router]);

  if (!isHydrated || isLoading || !isAuthenticated || !isAdmin(user)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <Shield className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <p className="text-sm text-gray-400">Manage YorkPulse content and users</p>
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
          <TabsTrigger value="courses" className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" /> Course Chat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="listings"><ListingsTab /></TabsContent>
        <TabsContent value="vault"><VaultTab /></TabsContent>
        <TabsContent value="feedback"><FeedbackTab /></TabsContent>
        <TabsContent value="reports"><ReportsTab /></TabsContent>
        <TabsContent value="courses"><CourseMonitorTab /></TabsContent>
      </Tabs>
    </div>
  );
}
