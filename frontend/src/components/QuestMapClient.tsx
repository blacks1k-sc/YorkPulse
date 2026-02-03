"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polygon, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { motion, AnimatePresence } from "framer-motion";
import { SideQuest, QuestCategory } from "@/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Clock, MapPin, Navigation, Locate, X, Building2, Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildingCategoryConfig, type BuildingCategory } from "@/data/yorkBuildings";
import { fetchBuildingPolygons, fallbackBuildings, type BuildingPolygon, getBuildingInfo } from "@/data/yorkBuildingPolygons";

// York University campus center coordinates
const YORK_CENTER: [number, number] = [43.7735, -79.5019];
const DEFAULT_ZOOM = 16;

// Category config with gradients and emojis
const categoryConfig: Record<QuestCategory, {
  emoji: string;
  gradient: string;
  color: string;
  label: string;
}> = {
  gym: {
    emoji: "💪",
    gradient: "linear-gradient(135deg, #ef4444, #dc2626)",
    color: "#ef4444",
    label: "Gym"
  },
  food: {
    emoji: "🍜",
    gradient: "linear-gradient(135deg, #f97316, #ea580c)",
    color: "#f97316",
    label: "Food"
  },
  study: {
    emoji: "📚",
    gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    color: "#3b82f6",
    label: "Study"
  },
  game: {
    emoji: "🎮",
    gradient: "linear-gradient(135deg, #22c55e, #16a34a)",
    color: "#22c55e",
    label: "Game"
  },
  commute: {
    emoji: "🚗",
    gradient: "linear-gradient(135deg, #a855f7, #9333ea)",
    color: "#a855f7",
    label: "Commute"
  },
  custom: {
    emoji: "✨",
    gradient: "linear-gradient(135deg, #6b7280, #4b5563)",
    color: "#6b7280",
    label: "Custom"
  },
};

// Create custom pulsing marker icons
const createMarkerIcon = (category: QuestCategory) => {
  const config = categoryConfig[category];
  return L.divIcon({
    className: "custom-quest-marker",
    html: `
      <div class="marker-container">
        <div class="marker-pulse" style="background: ${config.color}"></div>
        <div class="marker-inner" style="background: ${config.gradient}">
          <span class="marker-emoji">${config.emoji}</span>
        </div>
      </div>
    `,
    iconSize: [44, 44],
    iconAnchor: [22, 44],
    popupAnchor: [0, -44],
  });
};

// Recenter control component
function RecenterControl() {
  const map = useMap();

  const handleRecenter = useCallback(() => {
    map.flyTo(YORK_CENTER, DEFAULT_ZOOM, { duration: 0.8 });
  }, [map]);

  return (
    <div className="leaflet-top leaflet-right" style={{ marginTop: 80, marginRight: 10 }}>
      <div className="leaflet-control">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRecenter}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 border border-white/20"
          title="Recenter to York Campus"
        >
          <Navigation className="w-5 h-5 text-white" />
        </motion.button>
      </div>
    </div>
  );
}

// User location control
function UserLocationControl() {
  const map = useMap();
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLocate = useCallback(() => {
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        map.flyTo([latitude, longitude], 17, { duration: 0.8 });
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
      { enableHighAccuracy: true }
    );
  }, [map]);

  return (
    <>
      <div className="leaflet-top leaflet-right" style={{ marginTop: 130, marginRight: 10 }}>
        <div className="leaflet-control">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleLocate}
            disabled={loading}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/30 border border-white/20 disabled:opacity-50"
            title="My Location"
          >
            <Locate className={cn("w-5 h-5 text-white", loading && "animate-pulse")} />
          </motion.button>
        </div>
      </div>
      {userLocation && (
        <Marker
          position={userLocation}
          icon={L.divIcon({
            className: "user-location-marker",
            html: `
              <div class="user-marker">
                <div class="user-marker-pulse"></div>
                <div class="user-marker-dot"></div>
              </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          })}
        />
      )}
    </>
  );
}

// Building polygon component
function BuildingPolygonLayer({
  building,
  isHighlighted,
  onSelect,
}: {
  building: BuildingPolygon;
  isHighlighted: boolean;
  onSelect: (building: BuildingPolygon) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const config = buildingCategoryConfig[building.category];

  const baseOpacity = isHighlighted ? 0.3 : 0.1;
  const baseBorderOpacity = isHighlighted ? 0.7 : 0.3;
  const hoverOpacity = isHighlighted ? 0.5 : 0.25;
  const hoverBorderOpacity = isHighlighted ? 0.9 : 0.5;

  return (
    <Polygon
      positions={building.coordinates}
      pathOptions={{
        color: config.color,
        fillColor: config.color,
        fillOpacity: isHovered ? hoverOpacity : baseOpacity,
        weight: isHovered ? 3 : 2,
        opacity: isHovered ? hoverBorderOpacity : baseBorderOpacity,
      }}
      eventHandlers={{
        click: () => onSelect(building),
        mouseover: () => setIsHovered(true),
        mouseout: () => setIsHovered(false),
      }}
    >
      <Tooltip
        direction="top"
        offset={[0, -10]}
        className="building-tooltip"
        permanent={false}
      >
        <div className="flex items-center gap-2 px-2 py-1">
          <span>{config.emoji}</span>
          <span className="font-medium">{building.name}</span>
        </div>
      </Tooltip>
    </Polygon>
  );
}

// Building markers component with polygon shapes
function BuildingMarkers({
  selectedCategory,
  showBuildings,
  buildings,
  isLoading,
}: {
  selectedCategory: QuestCategory | null;
  showBuildings: boolean;
  buildings: BuildingPolygon[];
  isLoading: boolean;
}) {
  const [selectedBuilding, setSelectedBuilding] = useState<BuildingPolygon | null>(null);

  if (!showBuildings) return null;

  // Map quest categories to building categories for highlighting
  const questToBuildingCategory: Partial<Record<QuestCategory, BuildingCategory>> = {
    gym: "gym",
    food: "food",
    study: "study",
    commute: "transit",
  };

  const highlightCategory = selectedCategory
    ? questToBuildingCategory[selectedCategory]
    : null;

  return (
    <>
      {buildings.map((building) => {
        const isHighlighted = !highlightCategory || building.category === highlightCategory;

        return (
          <BuildingPolygonLayer
            key={building.id}
            building={building}
            isHighlighted={isHighlighted}
            onSelect={setSelectedBuilding}
          />
        );
      })}

      {/* Building popup */}
      {selectedBuilding && (
        <Popup
          position={selectedBuilding.center}
          className="building-popup"
          eventHandlers={{
            remove: () => setSelectedBuilding(null),
          }}
        >
          <BuildingPopupContent building={selectedBuilding} />
        </Popup>
      )}
    </>
  );
}

// Building popup content
function BuildingPopupContent({
  building,
}: {
  building: BuildingPolygon;
}) {
  const info = getBuildingInfo(building);

  return (
    <div className="min-w-[260px] p-1">
      {/* Category badge */}
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-xs font-medium mb-2"
        style={{ background: info.color }}
      >
        <span>{info.emoji}</span>
        <span>{info.label}</span>
      </div>

      {/* Name */}
      <h3 className="font-semibold text-zinc-900 mb-2">{building.name}</h3>

      {/* Description */}
      {building.description && (
        <p className="text-xs text-zinc-600 mb-2">{building.description}</p>
      )}

      {/* Hours */}
      {building.hours && (
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-2">
          <Clock className="w-3 h-3" />
          <span>{building.hours}</span>
        </div>
      )}

      {/* Category indicator */}
      <div className="mt-2 pt-2 border-t border-zinc-200">
        <span className="text-xs text-zinc-500">
          {info.emoji} {info.label} Building
        </span>
      </div>
    </div>
  );
}

// Stats overlay panel
function StatsOverlay({
  quests,
  showBuildings,
  onToggleBuildings,
  buildingCount,
  buildingsLoading,
}: {
  quests: SideQuest[];
  showBuildings: boolean;
  onToggleBuildings: () => void;
  buildingCount: number;
  buildingsLoading: boolean;
}) {
  const questsWithCoords = quests.filter(q => q.latitude && q.longitude);
  const categoryCounts = questsWithCoords.reduce((acc, quest) => {
    acc[quest.category] = (acc[quest.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-3 left-3 z-[1000] pointer-events-auto"
    >
      <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-2xl p-4 shadow-xl shadow-purple-500/10">
        {/* Live indicator */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-400 animate-ping" />
          </div>
          <span className="text-xs text-green-400 font-medium">LIVE</span>
        </div>

        {/* Quest count */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              {questsWithCoords.length}
            </span>
            <span className="text-sm text-zinc-400">active quests</span>
          </div>
        </div>

        {/* Category legend */}
        <div className="space-y-2">
          <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Quest Categories</p>
          {Object.entries(categoryConfig).map(([key, config]) => {
            const count = categoryCounts[key] || 0;
            if (count === 0) return null;
            return (
              <div key={key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: config.gradient }}
                  />
                  <span className="text-sm text-zinc-300">{config.label}</span>
                </div>
                <span className="text-sm text-zinc-500">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/10 my-3" />

        {/* Buildings toggle */}
        <button
          onClick={onToggleBuildings}
          className={cn(
            "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-all text-sm",
            showBuildings
              ? "bg-purple-500/20 border border-purple-500/30"
              : "bg-white/5 border border-white/10 hover:bg-white/10"
          )}
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-400" />
            <span className={showBuildings ? "text-purple-300" : "text-zinc-400"}>
              Buildings
            </span>
            {buildingsLoading ? (
              <Loader2 className="w-3 h-3 text-purple-400 animate-spin" />
            ) : (
              <span className="text-xs text-zinc-500">({buildingCount})</span>
            )}
          </div>
          {showBuildings ? (
            <Eye className="w-4 h-4 text-purple-400" />
          ) : (
            <EyeOff className="w-4 h-4 text-zinc-500" />
          )}
        </button>

        {/* Building legend (when visible) */}
        {showBuildings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 space-y-1.5"
          >
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Building Types</p>
            {Object.entries(buildingCategoryConfig).map(([key, config]) => (
              <div key={key} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ background: config.color, opacity: 0.6 }}
                />
                <span className="text-xs text-zinc-400">{config.label}</span>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// Mobile bottom sheet for quest details
function MobileQuestSheet({
  quest,
  onClose,
  onViewDetails
}: {
  quest: SideQuest | null;
  onClose: () => void;
  onViewDetails: (id: string) => void;
}) {
  if (!quest) return null;

  const config = categoryConfig[quest.category];
  const spotsLeft = quest.max_participants - quest.current_participants;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[2000] md:hidden"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-0 left-0 right-0 backdrop-blur-xl bg-zinc-900/90 border-t border-white/10 rounded-t-3xl p-6"
        >
          {/* Handle bar */}
          <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-4" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          {/* Category badge */}
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-white text-sm mb-3"
            style={{ background: config.gradient }}
          >
            <span>{config.emoji}</span>
            <span>{config.label}</span>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-white mb-3">{quest.activity}</h3>

          {/* Meta info */}
          <div className="flex flex-wrap gap-4 mb-4 text-sm text-zinc-400">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              <span>{quest.location}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span>
                {new Date(quest.start_time).toLocaleString("en-US", {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          {/* Host & participants */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Avatar className="w-10 h-10 border-2 border-white/20">
                <AvatarImage src={quest.host.avatar_url || undefined} />
                <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white">
                  {quest.host.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-white">{quest.host.name}</p>
                <p className="text-xs text-zinc-500">Host</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-400" />
              <span className="text-sm text-zinc-300">
                {spotsLeft > 0 ? `${spotsLeft} spots left` : "Full"}
              </span>
            </div>
          </div>

          {/* Action button */}
          <Button
            onClick={() => onViewDetails(quest.id)}
            className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl"
          >
            View Quest Details
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Custom popup content component
function QuestPopupContent({
  quest,
  onViewDetails
}: {
  quest: SideQuest;
  onViewDetails: () => void;
}) {
  const config = categoryConfig[quest.category];
  const spotsLeft = quest.max_participants - quest.current_participants;

  return (
    <div className="min-w-[280px] p-1">
      {/* Category badge */}
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-white text-xs font-medium mb-2"
        style={{ background: config.gradient }}
      >
        <span>{config.emoji}</span>
        <span>{config.label}</span>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-zinc-900 mb-2 line-clamp-2">{quest.activity}</h3>

      {/* Meta */}
      <div className="space-y-1.5 mb-3 text-xs text-zinc-600">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3" />
          <span className="truncate">{quest.location}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          <span>
            {new Date(quest.start_time).toLocaleString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* Host & spots */}
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-zinc-200">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-medium">
            {quest.host.name.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs text-zinc-600">{quest.host.name}</span>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <Users className="w-3 h-3 text-zinc-500" />
          <span className={spotsLeft > 0 ? "text-green-600" : "text-red-500"}>
            {spotsLeft > 0 ? `${spotsLeft} spots` : "Full"}
          </span>
        </div>
      </div>

      {/* Action button */}
      <button
        onClick={onViewDetails}
        className="w-full py-2 rounded-lg text-white text-sm font-medium transition-all"
        style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }}
      >
        View Quest
      </button>
    </div>
  );
}

interface QuestMapClientProps {
  quests: SideQuest[];
  className?: string;
}

export default function QuestMapClient({ quests, className }: QuestMapClientProps) {
  const router = useRouter();
  const [selectedQuest, setSelectedQuest] = useState<SideQuest | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [showBuildings, setShowBuildings] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<QuestCategory | null>(null);
  const [buildings, setBuildings] = useState<BuildingPolygon[]>(fallbackBuildings);
  const [buildingsLoading, setBuildingsLoading] = useState(true);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch building polygons from OSM
  useEffect(() => {
    let cancelled = false;

    async function loadBuildings() {
      setBuildingsLoading(true);
      try {
        const osmBuildings = await fetchBuildingPolygons();
        if (!cancelled && osmBuildings.length > 0) {
          setBuildings(osmBuildings);
        }
      } catch (error) {
        console.error("Failed to load OSM buildings, using fallback:", error);
        // Keep fallback buildings
      } finally {
        if (!cancelled) {
          setBuildingsLoading(false);
        }
      }
    }

    loadBuildings();

    return () => {
      cancelled = true;
    };
  }, []);

  const questsWithCoords = quests.filter((q) => q.latitude && q.longitude);

  const handleViewDetails = (questId: string) => {
    router.push(`/quests/${questId}`);
  };

  const handleToggleBuildings = () => {
    setShowBuildings(!showBuildings);
  };

  const handleMarkerClick = (quest: SideQuest) => {
    if (isMobile) {
      setSelectedQuest(quest);
    }
  };

  return (
    <div className={cn("relative w-full h-full", className)}>
      {/* Map container with glow effect */}
      <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-[0_0_60px_-15px_rgba(168,85,247,0.4)] border border-white/10">
        <MapContainer
          center={YORK_CENTER}
          zoom={DEFAULT_ZOOM}
          className="w-full h-full"
          style={{ background: "#0A0A0A", height: "100%", minHeight: "400px" }}
          zoomControl={false}
        >
          {/* Dark theme map tiles */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />

          {/* Custom controls */}
          <RecenterControl />
          <UserLocationControl />

          {/* Building overlays (lower z-index than quest markers) */}
          <BuildingMarkers
            selectedCategory={selectedCategory}
            showBuildings={showBuildings}
            buildings={buildings}
            isLoading={buildingsLoading}
          />

          {/* Quest markers */}
          {questsWithCoords.map((quest) => (
            <Marker
              key={quest.id}
              position={[quest.latitude!, quest.longitude!]}
              icon={createMarkerIcon(quest.category)}
              eventHandlers={{
                click: () => handleMarkerClick(quest),
              }}
            >
              {/* Desktop popup */}
              {!isMobile && (
                <Popup className="quest-popup-modern" closeButton={false}>
                  <QuestPopupContent
                    quest={quest}
                    onViewDetails={() => handleViewDetails(quest.id)}
                  />
                </Popup>
              )}
            </Marker>
          ))}
        </MapContainer>

        {/* Stats overlay */}
        <StatsOverlay
          quests={quests}
          showBuildings={showBuildings}
          onToggleBuildings={handleToggleBuildings}
          buildingCount={buildings.length}
          buildingsLoading={buildingsLoading}
        />
      </div>

      {/* Mobile bottom sheet */}
      {isMobile && selectedQuest && (
        <MobileQuestSheet
          quest={selectedQuest}
          onClose={() => setSelectedQuest(null)}
          onViewDetails={handleViewDetails}
        />
      )}

      {/* Marker styles */}
      <style jsx global>{`
        /* Custom marker styles */
        .custom-quest-marker {
          background: transparent !important;
          border: none !important;
        }

        .marker-container {
          position: relative;
          width: 44px;
          height: 44px;
        }

        .marker-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 44px;
          height: 44px;
          border-radius: 50%;
          opacity: 0.3;
          animation: marker-pulse 2s ease-out infinite;
        }

        .marker-inner {
          position: absolute;
          top: 0;
          left: 7px;
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
          border: 2px solid rgba(255, 255, 255, 0.3);
        }

        .marker-emoji {
          transform: rotate(45deg);
          font-size: 14px;
          filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
        }

        @keyframes marker-pulse {
          0% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0.4;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0;
          }
        }

        /* User location marker */
        .user-location-marker {
          background: transparent !important;
          border: none !important;
        }

        .user-marker {
          position: relative;
          width: 24px;
          height: 24px;
        }

        .user-marker-pulse {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: rgba(59, 130, 246, 0.3);
          animation: user-pulse 2s ease-out infinite;
        }

        .user-marker-dot {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #3b82f6;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.5);
        }

        @keyframes user-pulse {
          0% {
            transform: scale(1);
            opacity: 0.5;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        /* Modern popup styles */
        .quest-popup-modern .leaflet-popup-content-wrapper {
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          padding: 0;
          overflow: hidden;
        }

        .quest-popup-modern .leaflet-popup-content {
          margin: 12px;
          min-width: 280px;
        }

        .quest-popup-modern .leaflet-popup-tip {
          background: white;
        }

        /* Custom zoom controls */
        .leaflet-control-zoom {
          border: none !important;
          border-radius: 12px !important;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        }

        .leaflet-control-zoom a {
          background: linear-gradient(135deg, #a855f7, #ec4899) !important;
          color: white !important;
          border: none !important;
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
          font-size: 18px !important;
          font-weight: bold !important;
        }

        .leaflet-control-zoom a:first-child {
          border-radius: 12px 12px 0 0 !important;
        }

        .leaflet-control-zoom a:last-child {
          border-radius: 0 0 12px 12px !important;
        }

        .leaflet-control-zoom a:hover {
          background: linear-gradient(135deg, #9333ea, #db2777) !important;
        }

        .leaflet-control-zoom-in,
        .leaflet-control-zoom-out {
          border-bottom: 1px solid rgba(255, 255, 255, 0.2) !important;
        }

        /* Attribution */
        .leaflet-control-attribution {
          background: rgba(0, 0, 0, 0.6) !important;
          color: rgba(255, 255, 255, 0.5) !important;
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 8px 0 0 0;
        }

        .leaflet-control-attribution a {
          color: rgba(255, 255, 255, 0.7) !important;
        }

        /* Building tooltip styles */
        .building-tooltip {
          background: rgba(0, 0, 0, 0.85) !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 8px !important;
          color: white !important;
          font-size: 12px !important;
          padding: 0 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3) !important;
        }

        .building-tooltip::before {
          border-top-color: rgba(0, 0, 0, 0.85) !important;
        }

        /* Building popup styles */
        .building-popup .leaflet-popup-content-wrapper {
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          padding: 0;
          overflow: hidden;
        }

        .building-popup .leaflet-popup-content {
          margin: 12px;
          min-width: 260px;
        }

        .building-popup .leaflet-popup-tip {
          background: white;
        }

        /* Circle marker hover effect */
        .leaflet-interactive:hover {
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
