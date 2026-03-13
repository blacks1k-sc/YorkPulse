"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { QuestCategory } from "@/types";

interface QuestLocationMapWrapperProps {
  latitude: number;
  longitude: number;
  locationName: string;
  category: QuestCategory;
}

export function QuestLocationMapWrapper(props: QuestLocationMapWrapperProps) {
  const [MapComponent, setMapComponent] = useState<React.ComponentType<QuestLocationMapWrapperProps> | null>(null);

  useEffect(() => {
    // Only import the map component on the client side
    import("./QuestLocationMap").then((mod) => {
      setMapComponent(() => mod.default);
    });
  }, []);

  if (!MapComponent) {
    return (
      <div className="h-40 bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return <MapComponent {...props} />;
}

export default QuestLocationMapWrapper;
