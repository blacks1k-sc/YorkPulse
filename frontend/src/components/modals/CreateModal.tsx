"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  ShoppingBag,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUIStore } from "@/stores/ui";
import { useCreateVaultPost } from "@/hooks/useVault";
import { useCreateListing } from "@/hooks/useMarketplace";
import { useToast } from "@/hooks/use-toast";

const vaultCategories = [
  { value: "academics", label: "Academics" },
  { value: "social", label: "Social" },
  { value: "housing", label: "Housing" },
  { value: "safety", label: "Safety" },
  { value: "mental_health", label: "Mental Health" },
  { value: "general", label: "General" },
];

const marketplaceCategories = [
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

export function CreateModal() {
  const router = useRouter();
  const { toast } = useToast();
  const { isCreateModalOpen, createModalType, closeCreateModal } = useUIStore();

  // Form states
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);

  // Marketplace specific
  const [price, setPrice] = useState("");
  const [condition, setCondition] = useState("");

  const createVaultPost = useCreateVaultPost();
  const createListing = useCreateListing();

  const isLoading = createVaultPost.isPending || createListing.isPending;

  // Quest modal is handled separately by CreateQuestModal
  // This modal only handles vault and marketplace
  if (createModalType === "quest") {
    return null;
  }

  const resetForm = () => {
    setTitle("");
    setContent("");
    setCategory("");
    setIsAnonymous(true);
    setPrice("");
    setCondition("");
  };

  const handleClose = () => {
    closeCreateModal();
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (createModalType === "vault") {
        const post = await createVaultPost.mutateAsync({
          title,
          content,
          category,
          is_anonymous: isAnonymous,
        });
        toast({ title: "Post created" });
        handleClose();
        router.push(`/vault/${post.id}`);
      } else if (createModalType === "marketplace") {
        const listing = await createListing.mutateAsync({
          title,
          description: content,
          price: parseFloat(price),
          category,
          condition,
        });
        toast({ title: "Listing created" });
        handleClose();
        router.push(`/marketplace/${listing.id}`);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create",
        variant: "destructive",
      });
    }
  };

  const getIcon = () => {
    switch (createModalType) {
      case "vault":
        return <Shield className="w-5 h-5 text-purple-400" />;
      case "marketplace":
        return <ShoppingBag className="w-5 h-5 text-coral-400" />;
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (createModalType) {
      case "vault":
        return "New Vault Post";
      case "marketplace":
        return "New Listing";
      default:
        return "";
    }
  };

  const categories = createModalType === "vault" ? vaultCategories : marketplaceCategories;

  return (
    <Dialog open={isCreateModalOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder={
                createModalType === "vault"
                  ? "What is on your mind?"
                  : "What are you selling?"
              }
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Content/Description */}
          <div className="space-y-2">
            <Label htmlFor="content">
              {createModalType === "marketplace" ? "Description" : "Details"}
            </Label>
            <Textarea
              id="content"
              placeholder={
                createModalType === "vault"
                  ? "Share your thoughts..."
                  : "Describe your item..."
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[120px]"
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory} required>
              <SelectTrigger>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vault specific: Anonymous toggle */}
          {createModalType === "vault" && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="anonymous"
                checked={isAnonymous}
                onCheckedChange={(checked) => setIsAnonymous(checked as boolean)}
              />
              <Label htmlFor="anonymous" className="text-sm cursor-pointer">
                Post anonymously
              </Label>
            </div>
          )}

          {/* Marketplace specific fields */}
          {createModalType === "marketplace" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price ($)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Condition</Label>
                <Select value={condition} onValueChange={setCondition} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
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
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-purple-600 hover:bg-purple-700"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
