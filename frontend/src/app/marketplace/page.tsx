"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ShoppingBag,
  Plus,
  Filter,
  Search,
  User,
  Clock,
  Loader2,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMarketplaceListings } from "@/hooks/useMarketplace";
import { useUIStore } from "@/stores/ui";
import { useAuthStore } from "@/stores/auth";
import { cn } from "@/lib/utils";
import type { MarketplaceListing } from "@/types";

const categories = [
  { value: "all", label: "All Categories" },
  { value: "textbooks", label: "Textbooks" },
  { value: "electronics", label: "Electronics" },
  { value: "furniture", label: "Furniture" },
  { value: "clothing", label: "Clothing" },
  { value: "tickets", label: "Tickets" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
];

const conditions = [
  { value: "all", label: "Any Condition" },
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

function ListingCard({ listing }: { listing: MarketplaceListing }) {
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <Link href={`/marketplace/${listing.id}`}>
        <div className="rounded-xl bg-white/5 border border-white/10 hover:border-coral-500/30 transition-colors overflow-hidden">
          {/* Image */}
          <div className="aspect-square bg-zinc-900 relative">
            {listing.images && listing.images.length > 0 ? (
              <img
                src={listing.images[0]}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="w-12 h-12 text-zinc-700" />
              </div>
            )}
            <Badge
              className="absolute top-2 right-2 bg-black/50 backdrop-blur-sm"
              variant="secondary"
            >
              {conditions.find((c) => c.value === listing.condition)?.label || listing.condition}
            </Badge>
          </div>

          {/* Details */}
          <div className="p-3">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="font-medium line-clamp-1">{listing.title}</h3>
            </div>

            <p className="text-lg font-bold text-coral-400 mb-2">
              ${Number(listing.price).toFixed(2)}
            </p>

            <div className="flex items-center justify-between text-xs text-zinc-500">
              <div className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {listing.seller.name}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {timeAgo(listing.created_at)}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function ListingSkeleton() {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
      <Skeleton className="aspect-square" />
      <div className="p-3">
        <Skeleton className="w-3/4 h-5 mb-2" />
        <Skeleton className="w-1/3 h-6 mb-2" />
        <Skeleton className="w-full h-4" />
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const [category, setCategory] = useState<string>("all");
  const [condition, setCondition] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const { openCreateModal } = useUIStore();
  const { isAuthenticated } = useAuthStore();

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useMarketplaceListings({
      category: category === "all" ? undefined : category,
      condition: condition === "all" ? undefined : condition,
      search: searchQuery || undefined,
      per_page: 20,
    });

  const listings = data?.pages.flatMap((page) => page.items) || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(search);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-coral-500/20 flex items-center justify-center">
            <ShoppingBag className="w-5 h-5 text-coral-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Marketplace</h1>
            <p className="text-sm text-zinc-500">Buy & sell with verified students</p>
          </div>
        </div>
        {isAuthenticated && (
          <Button
            onClick={() => openCreateModal("marketplace")}
            size="sm"
            className="bg-coral-500 hover:bg-coral-600"
          >
            <Plus className="w-4 h-4 mr-1" />
            Sell
          </Button>
        )}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search listings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </form>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-2">
        <Filter className="w-4 h-4 text-zinc-500 flex-shrink-0" />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40 flex-shrink-0">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={condition} onValueChange={setCondition}>
          <SelectTrigger className="w-36 flex-shrink-0">
            <SelectValue placeholder="Condition" />
          </SelectTrigger>
          <SelectContent>
            {conditions.map((cond) => (
              <SelectItem key={cond.value} value={cond.value}>
                {cond.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Listings Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <ListingSkeleton />
          <ListingSkeleton />
          <ListingSkeleton />
          <ListingSkeleton />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingBag className="w-12 h-12 mx-auto text-zinc-700 mb-4" />
          <p className="text-zinc-500">No listings found</p>
          {isAuthenticated && (
            <Button
              onClick={() => openCreateModal("marketplace")}
              variant="link"
              className="text-coral-400"
            >
              Create the first listing
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>

          {hasNextPage && (
            <div className="text-center pt-6">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Load more"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
