"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  ShoppingBag,
  Loader2,
  ImagePlus,
  X,
} from "lucide-react";
import { api } from "@/services/api";
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
  const [images, setImages] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setImages([]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Limit to 5 images
    if (images.length >= 5) {
      toast({
        title: "Maximum 5 images",
        description: "You can only upload up to 5 images per listing",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingImage(true);

    try {
      for (const file of Array.from(files)) {
        if (images.length >= 5) break;

        // Validate file type
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
          toast({
            title: "Invalid file type",
            description: "Only JPEG, PNG, and WebP images are allowed",
            variant: "destructive",
          });
          continue;
        }

        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: "Maximum file size is 5MB",
            variant: "destructive",
          });
          continue;
        }

        // Upload directly through backend (avoids CORS issues)
        const { public_url } = await api.marketplace.uploadImageDirect(file);
        setImages((prev) => [...prev, public_url]);
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
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
          images: images.length > 0 ? images : undefined,
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
            <>
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

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Photos (up to 5)</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <div className="flex flex-wrap gap-2">
                  {images.map((url, index) => (
                    <div
                      key={index}
                      className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/10"
                    >
                      <img
                        src={url}
                        alt={`Image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {images.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-white/20 hover:border-coral-500/50 transition-colors flex flex-col items-center justify-center gap-1 text-zinc-500 hover:text-coral-400"
                    >
                      {isUploadingImage ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <ImagePlus className="w-5 h-5" />
                          <span className="text-[10px]">Add</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </>
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
