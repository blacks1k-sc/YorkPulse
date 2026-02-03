// York University Building Polygons from OpenStreetMap
// Fetches actual building footprints and matches them to categories

import { BuildingCategory, buildingCategoryConfig } from "./yorkBuildings";

export interface BuildingPolygon {
  id: string;
  name: string;
  category: BuildingCategory;
  coordinates: [number, number][]; // Array of [lat, lng] pairs forming polygon
  center: [number, number];
  description?: string;
  hours?: string;
}

// Building name to category mapping
const buildingCategoryMap: Record<string, BuildingCategory> = {
  // Gym/Fitness
  "tait mckenzie": "gym",
  "tait mckenzie centre": "gym",
  "aviva centre": "gym",
  "tennis canada": "gym",
  "track and field": "gym",
  "toronto track": "gym",
  "york lions stadium": "gym",
  "stadium": "gym",
  "ice rink": "gym",
  "rink": "gym",
  "gymnasium": "gym",
  "fitness": "gym",
  "recreation": "gym",

  // Food/Dining
  "student centre": "food",
  "york lanes": "food",
  "food court": "food",
  "cafeteria": "food",
  "tim hortons": "food",
  "starbucks": "food",
  "dining": "food",
  "restaurant": "food",

  // Study Spaces
  "scott library": "study",
  "steacie": "study",
  "library": "study",
  "william small": "study",

  // Academic Buildings
  "ross building": "academic",
  "ross": "academic",
  "vari hall": "academic",
  "lassonde": "academic",
  "bergeron": "academic",
  "schulich": "academic",
  "osgoode": "academic",
  "curtis": "academic",
  "lecture hall": "academic",
  "accolade": "academic",
  "health": "academic",
  "dahdaleh": "academic",
  "life sciences": "academic",
  "farquharson": "academic",
  "petrie": "academic",
  "chemistry": "academic",
  "physics": "academic",
  "biology": "academic",
  "behavioural": "academic",
  "administrative": "academic",
  "kaneff": "academic",
  "seneca": "academic",
  "central square": "academic",
  "atkinson": "academic",

  // Transit
  "pioneer village": "transit",
  "york university station": "transit",
  "subway": "transit",
  "bus terminal": "transit",
  "station": "transit",

  // Residences
  "residence": "residence",
  "college": "residence",
  "founders": "residence",
  "vanier": "residence",
  "winters": "residence",
  "mclaughlin": "residence",
  "stong": "residence",
  "bethune": "residence",
  "calumet": "residence",
  "tatham": "residence",
  "pond": "residence",
  "assiniboine": "residence",
  "quad": "residence",
};

// Determine category from building name
function getCategoryFromName(name: string): BuildingCategory {
  const lowerName = name.toLowerCase();

  for (const [keyword, category] of Object.entries(buildingCategoryMap)) {
    if (lowerName.includes(keyword)) {
      return category;
    }
  }

  return "academic"; // Default to academic for unknown buildings
}

// York University Keele Campus boundaries
// Expanded to include all campus buildings from Aviva Centre to Lassonde/Bergeron
const CAMPUS_BOUNDS = {
  west: -79.5200,   // West of Aviva Centre
  east: -79.4900,   // East edge including Lassonde/Bergeron area
  north: 43.7900,   // North of Steeles
  south: 43.7600,   // South campus edge (includes The Quad at 43.768)
};

// Check if a coordinate is within campus bounds
function isWithinCampus(lat: number, lng: number): boolean {
  return (
    lng >= CAMPUS_BOUNDS.west &&
    lng <= CAMPUS_BOUNDS.east &&
    lat >= CAMPUS_BOUNDS.south &&
    lat <= CAMPUS_BOUNDS.north
  );
}

// Check if a building's center is within campus bounds
function isBuildingWithinCampus(coordinates: [number, number][]): boolean {
  // Calculate center point
  const centerLat = coordinates.reduce((sum, c) => sum + c[0], 0) / coordinates.length;
  const centerLng = coordinates.reduce((sum, c) => sum + c[1], 0) / coordinates.length;

  return isWithinCampus(centerLat, centerLng);
}

// Overpass API query for York University buildings (tighter bounds)
const OVERPASS_QUERY = `
[out:json][timeout:30];
(
  // York University campus area - restricted to west of Keele
  way["building"](${CAMPUS_BOUNDS.south},${CAMPUS_BOUNDS.west},${CAMPUS_BOUNDS.north},${CAMPUS_BOUNDS.east});
  relation["building"](${CAMPUS_BOUNDS.south},${CAMPUS_BOUNDS.west},${CAMPUS_BOUNDS.north},${CAMPUS_BOUNDS.east});
);
out body geom;
`;

// Parse OSM response to building polygons
function parseOSMResponse(data: any): BuildingPolygon[] {
  const buildings: BuildingPolygon[] = [];

  if (!data.elements) return buildings;

  for (const element of data.elements) {
    // Skip if no geometry
    if (!element.geometry && !element.members) continue;

    let coordinates: [number, number][] = [];
    let name = element.tags?.name || element.tags?.["addr:housename"] || "";

    // For ways, extract coordinates directly
    if (element.type === "way" && element.geometry) {
      coordinates = element.geometry.map((point: any) => [point.lat, point.lon]);
    }

    // For relations (multipolygons), get outer way
    if (element.type === "relation" && element.members) {
      const outerWay = element.members.find((m: any) => m.role === "outer");
      if (outerWay?.geometry) {
        coordinates = outerWay.geometry.map((point: any) => [point.lat, point.lon]);
      }
    }

    // Skip if no valid coordinates or too few points
    if (coordinates.length < 3) continue;

    // Calculate center point
    const center: [number, number] = [
      coordinates.reduce((sum, c) => sum + c[0], 0) / coordinates.length,
      coordinates.reduce((sum, c) => sum + c[1], 0) / coordinates.length,
    ];

    // Skip buildings outside campus bounds (east of Keele Street)
    if (!isWithinCampus(center[0], center[1])) continue;

    // Skip buildings without names (unless they're large enough to be significant)
    const area = calculatePolygonArea(coordinates);
    if (!name && area < 500) continue; // Skip small unnamed buildings

    // Generate ID
    const id = `osm-${element.type}-${element.id}`;

    // Determine category
    const category = getCategoryFromName(name || `building-${element.id}`);

    buildings.push({
      id,
      name: name || "Campus Building",
      category,
      coordinates,
      center,
    });
  }

  return buildings;
}

// Calculate polygon area (approximate, for filtering)
function calculatePolygonArea(coords: [number, number][]): number {
  let area = 0;
  const n = coords.length;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += coords[i][0] * coords[j][1];
    area -= coords[j][0] * coords[i][1];
  }

  return Math.abs(area / 2) * 111000 * 111000; // Convert to approximate square meters
}

// Fetch building polygons from Overpass API
export async function fetchBuildingPolygons(): Promise<BuildingPolygon[]> {
  try {
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(OVERPASS_QUERY)}`;

    const response = await fetch(url, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }

    const data = await response.json();
    return parseOSMResponse(data);
  } catch (error) {
    console.error("Failed to fetch building polygons:", error);
    return [];
  }
}

// Fallback building data with rectangular approximations
const allFallbackBuildings: BuildingPolygon[] = [
  // Gym/Fitness
  {
    id: "fallback-tait",
    name: "Tait McKenzie Centre",
    category: "gym",
    center: [43.77442, -79.50956],
    coordinates: createRectangle([43.77442, -79.50956], 80, 60),
  },
  {
    id: "fallback-aviva",
    name: "Aviva Centre",
    category: "gym",
    center: [43.77162, -79.51210],
    coordinates: createRectangle([43.77162, -79.51210], 100, 80),
  },

  // Food/Dining
  {
    id: "fallback-student-centre",
    name: "Student Centre",
    category: "food",
    center: [43.77635, -79.49595],
    coordinates: createRectangle([43.77635, -79.49595], 60, 40),
  },
  {
    id: "fallback-york-lanes",
    name: "York Lanes Mall",
    category: "food",
    center: [43.77280, -79.50080],
    coordinates: createRectangle([43.77280, -79.50080], 70, 50),
  },

  // Study Spaces
  {
    id: "fallback-scott",
    name: "Scott Library",
    category: "study",
    center: [43.77380, -79.50380],
    coordinates: createRectangle([43.77380, -79.50380], 80, 60),
  },
  {
    id: "fallback-steacie",
    name: "Steacie Science Library",
    category: "study",
    center: [43.77250, -79.50550],
    coordinates: createRectangle([43.77250, -79.50550], 50, 40),
  },

  // Academic Buildings
  {
    id: "fallback-ross",
    name: "Ross Building",
    category: "academic",
    center: [43.77436, -79.49315],
    coordinates: createRectangle([43.77436, -79.49315], 120, 80),
  },
  {
    id: "fallback-vari",
    name: "Vari Hall",
    category: "academic",
    center: [43.77310, -79.50360],
    coordinates: createRectangle([43.77310, -79.50360], 50, 50),
  },
  {
    id: "fallback-lassonde",
    name: "Lassonde Building",
    category: "academic",
    center: [43.77410, -79.49080],
    coordinates: createRectangle([43.77410, -79.49080], 70, 50),
  },
  {
    id: "fallback-bergeron",
    name: "Bergeron Centre",
    category: "academic",
    center: [43.77450, -79.49050],
    coordinates: createRectangle([43.77450, -79.49050], 60, 45),
  },
  {
    id: "fallback-schulich",
    name: "Schulich School of Business",
    category: "academic",
    center: [43.77700, -79.49900],
    coordinates: createRectangle([43.77700, -79.49900], 80, 60),
  },
  {
    id: "fallback-osgoode",
    name: "Osgoode Hall Law School",
    category: "academic",
    center: [43.77070, -79.50440],
    coordinates: createRectangle([43.77070, -79.50440], 70, 50),
  },
  {
    id: "fallback-curtis",
    name: "Curtis Lecture Halls",
    category: "academic",
    center: [43.77280, -79.50200],
    coordinates: createRectangle([43.77280, -79.50200], 60, 40),
  },
  {
    id: "fallback-accolade",
    name: "Accolade East",
    category: "academic",
    center: [43.77200, -79.49900],
    coordinates: createRectangle([43.77200, -79.49900], 50, 40),
  },
  {
    id: "fallback-dahdaleh",
    name: "Dahdaleh Building",
    category: "academic",
    center: [43.77127, -79.50061],
    coordinates: createRectangle([43.77127, -79.50061], 60, 45),
  },
  {
    id: "fallback-central",
    name: "Central Square",
    category: "academic",
    center: [43.77350, -79.50350],
    coordinates: createRectangle([43.77350, -79.50350], 100, 70),
  },

  // Transit
  {
    id: "fallback-pioneer",
    name: "Pioneer Village Station",
    category: "transit",
    center: [43.77806, -79.51194],
    coordinates: createRectangle([43.77806, -79.51194], 80, 40),
  },
  {
    id: "fallback-york-station",
    name: "York University Station",
    category: "transit",
    center: [43.77420, -79.49980],
    coordinates: createRectangle([43.77420, -79.49980], 70, 35),
  },

  // Residences
  {
    id: "fallback-founders",
    name: "Founders College",
    category: "residence",
    center: [43.77700, -79.50200],
    coordinates: createRectangle([43.77700, -79.50200], 50, 40),
  },
  {
    id: "fallback-winters",
    name: "Winters College",
    category: "residence",
    center: [43.77500, -79.50700],
    coordinates: createRectangle([43.77500, -79.50700], 50, 40),
  },
  {
    id: "fallback-vanier",
    name: "Vanier College",
    category: "residence",
    center: [43.77600, -79.50600],
    coordinates: createRectangle([43.77600, -79.50600], 50, 40),
  },
  {
    id: "fallback-bethune",
    name: "Bethune College",
    category: "residence",
    center: [43.77350, -79.50500],
    coordinates: createRectangle([43.77350, -79.50500], 50, 40),
  },
  {
    id: "fallback-stong",
    name: "Stong College",
    category: "residence",
    center: [43.77400, -79.49700],
    coordinates: createRectangle([43.77400, -79.49700], 50, 40),
  },
  {
    id: "fallback-quad",
    name: "The Quad",
    category: "residence",
    center: [43.76800, -79.50400],
    coordinates: createRectangle([43.76800, -79.50400], 80, 60),
  },
];

// Export filtered fallback buildings (only within campus bounds)
export const fallbackBuildings: BuildingPolygon[] = allFallbackBuildings.filter(
  building => isWithinCampus(building.center[0], building.center[1])
);

// Create a rectangle from center point
function createRectangle(center: [number, number], widthMeters: number, heightMeters: number): [number, number][] {
  // Convert meters to approximate degrees (at York's latitude)
  const latDelta = heightMeters / 111000 / 2;
  const lngDelta = widthMeters / (111000 * Math.cos(center[0] * Math.PI / 180)) / 2;

  return [
    [center[0] - latDelta, center[1] - lngDelta],
    [center[0] - latDelta, center[1] + lngDelta],
    [center[0] + latDelta, center[1] + lngDelta],
    [center[0] + latDelta, center[1] - lngDelta],
    [center[0] - latDelta, center[1] - lngDelta], // Close the polygon
  ];
}

// Get building info for popup
export function getBuildingInfo(building: BuildingPolygon): {
  name: string;
  category: BuildingCategory;
  color: string;
  emoji: string;
  label: string;
} {
  const config = buildingCategoryConfig[building.category];
  return {
    name: building.name,
    category: building.category,
    color: config.color,
    emoji: config.emoji,
    label: config.label,
  };
}
