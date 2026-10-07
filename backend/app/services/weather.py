import httpx

from app.core.config import settings

DEV_FIXTURE = {
    "tempC": 31,
    "rainProbability": 40,
    "condition": "Partly Cloudy",
    "radarAvailable": True,
    "forecast": [
        {"day": "Today", "tempC": 31, "rainProbability": 40},
        {"day": "Tomorrow", "tempC": 30, "rainProbability": 55},
    ],
}

# Deterministic rain decision used by weather-aware tasks (phase-05 WS-07,
# task 7.7): a day counts as "rain expected" at/above this forecast chance.
RAIN_THRESHOLD_PERCENT = 50


def rain_expected(weather: dict | None, day: str = "Today") -> bool:
    """True when the forecast for `day` meets the rain threshold.

    Reads the daily `forecast` entry first and falls back to the current
    `rainProbability` when the day is not in the forecast. Returns False when no
    weather is available (honest absence — callers must not invent rain).
    """
    if not weather:
        return False
    for entry in weather.get("forecast") or []:
        if str(entry.get("day", "")).lower() == day.lower():
            return int(entry.get("rainProbability") or 0) >= RAIN_THRESHOLD_PERCENT
    return int(weather.get("rainProbability") or 0) >= RAIN_THRESHOLD_PERCENT


async def fetch_weather(lat: float, lng: float) -> dict:
    if not settings.weather_api_key:
        return DEV_FIXTURE
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params={
                "lat": lat,
                "lng": lng,
                "appid": settings.weather_api_key,
                "units": "metric",
            },
        )
        data = resp.json()
    temp = round(data["main"]["temp"])
    rain = int(data.get("clouds", {}).get("all", 0))
    condition = data["weather"][0]["main"] if data.get("weather") else "Unknown"
    return {
        "tempC": temp,
        "rainProbability": rain,
        "condition": condition,
        "radarAvailable": True,
        "forecast": [
            {"day": "Today", "tempC": temp, "rainProbability": rain},
            {"day": "Tomorrow", "tempC": temp, "rainProbability": rain},
        ],
    }
