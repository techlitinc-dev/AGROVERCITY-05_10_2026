from pydantic import BaseModel, model_validator

# Swiggy/Zomato-style label set. `label` stays a free string for backward
# compatibility with existing saved addresses; the frontend renders
# label === "Other" ? customLabel : label.
ADDRESS_LABELS = ("Home", "Office", "Farm", "Warehouse", "Shop", "Other")


class AddressRequest(BaseModel):
    label: str
    customLabel: str | None = None  # required when label == "Other"
    line1: str
    landmark: str = ""
    village: str
    district: str
    state: str
    pincode: str
    contactName: str = ""
    contactPhone: str = ""
    lat: float | None = None
    lng: float | None = None
    isDefault: bool = False

    @model_validator(mode="after")
    def _other_requires_custom_label(self):
        if (self.label or "").strip() == "Other" and not (self.customLabel or "").strip():
            raise ValueError('customLabel is required when label is "Other"')
        return self
