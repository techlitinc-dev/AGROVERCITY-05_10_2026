from abc import ABC, abstractmethod

from app.models.advisory import PestDisease


class DiseaseModelAdapter(ABC):
    @abstractmethod
    async def scan(self, image_bytes: bytes) -> list[PestDisease]:
        ...
