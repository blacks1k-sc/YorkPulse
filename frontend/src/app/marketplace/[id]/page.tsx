"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ShoppingBag,
  Clock,
  Star,
  MessageCircle,
  MoreHorizontal,
  Trash2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMarketplaceListing, useDeleteListing, useUpdateListing } from "@/hooks/useMarketplace";
import { useUserRatingSummary } from "@/hooks/useReviews";
import { useStartConversation } from "@/hooks/useMessaging";
import { useAuthStore } from "@/stores/auth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const categories = [
  { value: "textbooks", label: "Textbooks" },
  { value: "electronics", label: "Electronics" },
  { value: "furniture", label: "Furniture" },
  { value: "clothing", label: "Clothing" },
  { value: "tickets", label: "Tickets" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
];

const conditions = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

export default function ListingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = params.id as string;
  const { user, isAuthenticated } = useAuthStore();
  const { toast } = useToast();

  const [selectedImage, setSelectedImage] = useState(0);

  const { data: listing, isLoading } = useMarketplaceListing(listingId);
  const { data: sellerRating } = useUserRatingSummary(listing?.seller.id || "");
  const deleteListingMutation = useDeleteListing();
  const updateListingMutation = useUpdateListing();
  const startConversationMutation = useStartConversation();

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const handleDelete = async () => {
    try {
      await deleteListingMutation.mutateAsync(listingId);
      toast({ title: "Listing deleted" });
      router.push("/marketplace");
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete listing",
        variant: "destructive",
      });
    }
  };

  const handleMarkSold = async () => {
    try {
      await updateListingMutation.mutateAsync({
        id: listingId,
        data: { status: "sold" },
      });
      toast({ title: "Marked as sold" });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update listing",
        variant: "destructive",
      });
    }
  };

  const handleContact = async () => {
    if (!listing) return;

    try {
      const conversation = await startConversationMutation.mutateAsync({
        recipient_id: listing.seller.id,
        initial_message: `Hi! I'm interested in your listing: "${listing.title}"`,
        context_type: "marketplace",
        context_id: listing.id,
      });
      router.push(`/messages/${conversation.id}`);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start conversation",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Skeleton className="w-24 h-8 mb-6" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="w-3/4 h-8" />
            <Skeleton className="w-1/4 h-10" />
            <Skeleton className="w-full h-32" />
          </div>
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl text-center">
        <p className="text-zinc-500">Listing not found</p>
        <Button variant="link" asChild>
          <Link href="/marketplace">Back to Marketplace</Link>
        </Button>
      </div>
    );
  }

  const isOwner = user?.id === listing.seller.id;
  const images = listing.images?.length ? listing.images : [];

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild className="mb-4">
        <Link href="/marketplace">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Link>
      </Button>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Images */}
        <div className="space-y-3">
          <div className="aspect-square rounded-xl bg-zinc-900 overflow-hidden">
            {images.length > 0 ? (
              <img
                src={images[selectedImage]}
                alt={listing.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="w-16 h-16 text-zinc-700" />
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={cn(
                    "w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors",
                    selectedImage === i ? "border-coral-500" : "border-transparent"
                  )}
                >
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div className="space-y-4">
          {/* Status Badge */}
          {listing.status !== "active" && (
            <Badge variant="secondary" className="bg-zinc-800">
              {listing.status === "sold" ? "Sold" : listing.status}
            </Badge>
          )}

          {/* Title & Price */}
          <div>
            <h1 className="text-2xl font-bold mb-2">{listing.title}</h1>
            <p className="text-3xl font-bold text-coral-400">
              ${Number(listing.price).toFixed(2)}
            </p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              {categories.find((c) => c.value === listing.category)?.label || listing.category}
            </Badge>
            <Badge variant="outline">
              {conditions.find((c) => c.value === listing.condition)?.label || listing.condition}
            </Badge>
          </div>

          {/* Description */}
          <div className="p-4 rounded-lg bg-white/5 border border-white/10">
            <p className="text-zinc-300 whitespace-pre-wrap">{listing.description}</p>
          </div>

          {/* Posted Time */}
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Clock className="w-4 h-4" />
            Posted {timeAgo(listing.created_at)}
          </div>

          {/* Actions */}
          {isOwner ? (
            <div className="flex gap-2">
              <Button
                onClick={handleMarkSold}
                disabled={listing.status === "sold"}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <Check className="w-4 h-4 mr-2" />
                {listing.status === "sold" ? "Sold" : "Mark as Sold"}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleDelete} className="text-red-400">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete listing
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            isAuthenticated && (
              <Button
                onClick={handleContact}
                className="w-full bg-coral-500 hover:bg-coral-600"
                disabled={startConversationMutation.isPending}
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Contact Seller
              </Button>
            )
          )}

          {/* Seller Card */}
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12">
                <AvatarImage src={listing.seller.avatar_url || undefined} />
                <AvatarFallback className="bg-coral-500/20 text-coral-400">
                  {listing.seller.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{listing.seller.name}</p>
                {sellerRating?.marketplace_rating && (
                  <div className="flex items-center gap-1 text-sm text-zinc-400">
                    <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                    {sellerRating.marketplace_rating.toFixed(1)}
                    <span className="text-zinc-600">
                      ({sellerRating.marketplace_count} reviews)
                    </span>
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/profile/${listing.seller.id}`}>View Profile</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
