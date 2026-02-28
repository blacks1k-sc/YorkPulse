"""Map data API routes with Redis caching."""

import json
import logging
import httpx
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.core.dependencies import get_current_user
from app.models.user import User
from app.services.redis import redis_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/map", tags=["map"])

# Cache settings
BUILDINGS_CACHE_KEY = "map:york_buildings"
CACHE_TTL_SECONDS = 24 * 60 * 60  # 24 hours

# York University Keele Campus boundaries
CAMPUS_BOUNDS = {
    "west": -79.5200,
    "east": -79.4900,
    "north": 43.7900,
    "south": 43.7600,
}

# Overpass API query for York University buildings
OVERPASS_QUERY = f"""
[out:json][timeout:30];
(
  way["building"]({CAMPUS_BOUNDS["south"]},{CAMPUS_BOUNDS["west"]},{CAMPUS_BOUNDS["north"]},{CAMPUS_BOUNDS["east"]});
  relation["building"]({CAMPUS_BOUNDS["south"]},{CAMPUS_BOUNDS["west"]},{CAMPUS_BOUNDS["north"]},{CAMPUS_BOUNDS["east"]});
  way["leisure"="pitch"]({CAMPUS_BOUNDS["south"]},{CAMPUS_BOUNDS["west"]},{CAMPUS_BOUNDS["north"]},{CAMPUS_BOUNDS["east"]});
  way["leisure"="sports_centre"]({CAMPUS_BOUNDS["south"]},{CAMPUS_BOUNDS["west"]},{CAMPUS_BOUNDS["north"]},{CAMPUS_BOUNDS["east"]});
  way["leisure"="stadium"]({CAMPUS_BOUNDS["south"]},{CAMPUS_BOUNDS["west"]},{CAMPUS_BOUNDS["north"]},{CAMPUS_BOUNDS["east"]});
  way["leisure"="track"]({CAMPUS_BOUNDS["south"]},{CAMPUS_BOUNDS["west"]},{CAMPUS_BOUNDS["north"]},{CAMPUS_BOUNDS["east"]});
  way["leisure"="ice_rink"]({CAMPUS_BOUNDS["south"]},{CAMPUS_BOUNDS["west"]},{CAMPUS_BOUNDS["north"]},{CAMPUS_BOUNDS["east"]});
  way["leisure"="swimming_pool"]({CAMPUS_BOUNDS["south"]},{CAMPUS_BOUNDS["west"]},{CAMPUS_BOUNDS["north"]},{CAMPUS_BOUNDS["east"]});
);
out body geom;
"""

# Overpass API endpoints (multiple for redundancy)
OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# Building name to category mapping
BUILDING_CATEGORY_MAP = {
    # Gym/Fitness
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
    "soccer": "gym",
    "football": "gym",
    "pitch": "gym",
    "field": "gym",
    "arena": "gym",
    "athletics": "gym",
    "sport": "gym",
    "tennis": "gym",
    "pool": "gym",
    "aquatic": "gym",
    "canlan": "gym",
    "ice gardens": "gym",
    # Food/Dining
    "student centre": "food",
    "york lanes": "food",
    "food court": "food",
    "cafeteria": "food",
    "tim hortons": "food",
    "starbucks": "food",
    "dining": "food",
    "restaurant": "food",
    # Study Spaces
    "scott library": "study",
    "steacie": "study",
    "library": "study",
    "william small": "study",
    # Academic Buildings
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
    # Transit
    "pioneer village": "transit",
    "york university station": "transit",
    "subway": "transit",
    "bus terminal": "transit",
    "station": "transit",
    # Residences
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
}


class BuildingPolygon(BaseModel):
    id: str
    name: str
    category: str
    coordinates: list[list[float]]  # Array of [lat, lng] pairs
    center: list[float]  # [lat, lng]


class BuildingsResponse(BaseModel):
    buildings: list[BuildingPolygon]
    cached: bool
    source: str  # "redis", "overpass", or "fallback"


def get_category_from_name_and_tags(name: str, tags: dict | None = None) -> str:
    """Determine category from building name and OSM tags."""
    # Check OSM tags first for sports/leisure facilities
    if tags:
        leisure = tags.get("leisure")
        sport = tags.get("sport")
        amenity = tags.get("amenity")

        if leisure in ("pitch", "sports_centre", "stadium", "track", "ice_rink", "swimming_pool"):
            return "gym"
        if sport:
            return "gym"
        if amenity in ("gym", "fitness_centre"):
            return "gym"

    lower_name = name.lower()
    for keyword, category in BUILDING_CATEGORY_MAP.items():
        if keyword in lower_name:
            return category

    return "academic"  # Default


def is_within_campus(lat: float, lng: float) -> bool:
    """Check if coordinates are within campus bounds."""
    return (
        CAMPUS_BOUNDS["west"] <= lng <= CAMPUS_BOUNDS["east"]
        and CAMPUS_BOUNDS["south"] <= lat <= CAMPUS_BOUNDS["north"]
    )


def calculate_polygon_area(coords: list[list[float]]) -> float:
    """Calculate approximate polygon area for filtering."""
    area = 0.0
    n = len(coords)
    for i in range(n):
        j = (i + 1) % n
        area += coords[i][0] * coords[j][1]
        area -= coords[j][0] * coords[i][1]
    return abs(area / 2) * 111000 * 111000


def parse_osm_response(data: dict) -> list[dict]:
    """Parse OSM Overpass response to building polygons."""
    buildings = []

    if not data.get("elements"):
        return buildings

    for element in data["elements"]:
        if not element.get("geometry") and not element.get("members"):
            continue

        coordinates = []
        tags = element.get("tags", {})
        name = tags.get("name") or tags.get("addr:housename") or ""

        # Generate name for sports facilities without a name
        if not name:
            sport = tags.get("sport")
            leisure = tags.get("leisure")
            if sport:
                name = f"{sport.capitalize()} Field"
            elif leisure == "pitch":
                name = "Sports Field"
            elif leisure == "track":
                name = "Running Track"
            elif leisure == "ice_rink":
                name = "Ice Rink"
            elif leisure == "swimming_pool":
                name = "Swimming Pool"
            elif leisure == "sports_centre":
                name = "Sports Centre"
            elif leisure == "stadium":
                name = "Stadium"

        # For ways, extract coordinates directly
        if element.get("type") == "way" and element.get("geometry"):
            coordinates = [[point["lat"], point["lon"]] for point in element["geometry"]]

        # For relations (multipolygons), get outer way
        if element.get("type") == "relation" and element.get("members"):
            outer_way = next((m for m in element["members"] if m.get("role") == "outer"), None)
            if outer_way and outer_way.get("geometry"):
                coordinates = [[point["lat"], point["lon"]] for point in outer_way["geometry"]]

        # Skip if no valid coordinates or too few points
        if len(coordinates) < 3:
            continue

        # Calculate center point
        center_lat = sum(c[0] for c in coordinates) / len(coordinates)
        center_lng = sum(c[1] for c in coordinates) / len(coordinates)

        # Skip buildings outside campus bounds
        if not is_within_campus(center_lat, center_lng):
            continue

        # Skip small unnamed buildings
        area = calculate_polygon_area(coordinates)
        if not name and area < 500:
            continue

        building_id = f"osm-{element['type']}-{element['id']}"
        category = get_category_from_name_and_tags(name or f"building-{element['id']}", tags)

        buildings.append({
            "id": building_id,
            "name": name or "Campus Building",
            "category": category,
            "coordinates": coordinates,
            "center": [center_lat, center_lng],
        })

    return buildings


async def fetch_from_overpass() -> list[dict] | None:
    """Fetch building data from Overpass API."""
    async with httpx.AsyncClient(timeout=20.0) as client:
        for endpoint in OVERPASS_ENDPOINTS:
            try:
                response = await client.post(
                    endpoint,
                    data={"data": OVERPASS_QUERY},
                    headers={"Accept": "application/json"},
                )
                if response.status_code == 200:
                    data = response.json()
                    buildings = parse_osm_response(data)
                    if buildings:
                        return buildings
            except Exception as e:
                logger.warning("Overpass API (%s) failed: %s", endpoint, e)
                continue
    return None


# Fallback building data
FALLBACK_BUILDINGS = [
    {"id": "fallback-tait", "name": "Tait McKenzie Centre", "category": "gym", "center": [43.77442, -79.50956], "coordinates": []},
    {"id": "fallback-aviva", "name": "Aviva Centre", "category": "gym", "center": [43.77162, -79.51210], "coordinates": []},
    {"id": "fallback-student-centre", "name": "Student Centre", "category": "food", "center": [43.77635, -79.49595], "coordinates": []},
    {"id": "fallback-york-lanes", "name": "York Lanes Mall", "category": "food", "center": [43.77280, -79.50080], "coordinates": []},
    {"id": "fallback-scott", "name": "Scott Library", "category": "study", "center": [43.77380, -79.50380], "coordinates": []},
    {"id": "fallback-steacie", "name": "Steacie Science Library", "category": "study", "center": [43.77250, -79.50550], "coordinates": []},
    {"id": "fallback-ross", "name": "Ross Building", "category": "academic", "center": [43.77436, -79.49315], "coordinates": []},
    {"id": "fallback-vari", "name": "Vari Hall", "category": "academic", "center": [43.77310, -79.50360], "coordinates": []},
    {"id": "fallback-lassonde", "name": "Lassonde Building", "category": "academic", "center": [43.77410, -79.49080], "coordinates": []},
    {"id": "fallback-bergeron", "name": "Bergeron Centre", "category": "academic", "center": [43.77450, -79.49050], "coordinates": []},
    {"id": "fallback-schulich", "name": "Schulich School of Business", "category": "academic", "center": [43.77700, -79.49900], "coordinates": []},
    {"id": "fallback-osgoode", "name": "Osgoode Hall Law School", "category": "academic", "center": [43.77070, -79.50440], "coordinates": []},
    {"id": "fallback-pioneer", "name": "Pioneer Village Station", "category": "transit", "center": [43.77806, -79.51194], "coordinates": []},
    {"id": "fallback-york-station", "name": "York University Station", "category": "transit", "center": [43.77420, -79.49980], "coordinates": []},
    {"id": "fallback-founders", "name": "Founders College", "category": "residence", "center": [43.77700, -79.50200], "coordinates": []},
    {"id": "fallback-winters", "name": "Winters College", "category": "residence", "center": [43.77500, -79.50700], "coordinates": []},
]


@router.get("/buildings", response_model=BuildingsResponse)
async def get_buildings(current_user: User = Depends(get_current_user)):
    """
    Get York University building polygons with Redis caching.

    - First checks Redis cache (shared across all users)
    - If not cached, fetches from OpenStreetMap Overpass API
    - Caches result in Redis for 24 hours
    - Falls back to static data if all sources fail
    """
    # Try Redis cache first
    try:
        cached = await redis_service.get(BUILDINGS_CACHE_KEY)
        if cached:
            buildings = json.loads(cached)
            return BuildingsResponse(
                buildings=buildings,
                cached=True,
                source="redis"
            )
    except Exception as e:
        logger.warning("Redis cache read failed: %s", e)

    # Cache miss - fetch from Overpass API
    buildings = await fetch_from_overpass()

    if buildings:
        # Cache in Redis
        try:
            await redis_service.set(
                BUILDINGS_CACHE_KEY,
                json.dumps(buildings),
                expire_seconds=CACHE_TTL_SECONDS
            )
            logger.info("Cached %d buildings in Redis", len(buildings))
        except Exception as e:
            logger.warning("Redis cache write failed: %s", e)

        return BuildingsResponse(
            buildings=buildings,
            cached=False,
            source="overpass"
        )

    # All sources failed - return fallback
    return BuildingsResponse(
        buildings=FALLBACK_BUILDINGS,
        cached=False,
        source="fallback"
    )


@router.delete("/buildings/cache")
async def clear_buildings_cache(current_user: User = Depends(get_current_user)):
    """Clear the buildings cache (admin use)."""
    try:
        await redis_service.delete(BUILDINGS_CACHE_KEY)
        return {"message": "Buildings cache cleared"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {e}")
