"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LocationPickerWrapperProps {
  value: { lat: number | null; lng: number | null; name: string };
  onChange: (location: { lat: number | null; lng: number | null; name: string }) => void;
  className?: string;
}

export function LocationPickerWrapper({ value, onChange, className }: LocationPickerWrapperProps) {
  const [PickerComponent, setPickerComponent] = useState<React.ComponentType<LocationPickerWrapperProps> | null>(null);

  useEffect(() => {
    // Only import the picker component on the client side
    import("./LocationPicker").then((mod) => {
      setPickerComponent(() => mod.default);
    });
  }, []);

  if (!PickerComponent) {
    return (
      <div className={cn("h-64 bg-zinc-800 rounded-xl flex items-center justify-center", className)}>
        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  return <PickerComponent value={value} onChange={onChange} className={className} />;
}

export default LocationPickerWrapper;
