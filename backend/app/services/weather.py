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
