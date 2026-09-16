from pydantic import BaseModel


class AppConfigOut(BaseModel):
    minSupportedVersion: str
    forceUpdate: bool
    featureFlags: dict[str, bool]
    maintenanceMode: bool
