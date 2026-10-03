from abc import ABC, abstractmethod


class GradeModelAdapter(ABC):
    @abstractmethod
    async def scan(self, image_bytes: bytes) -> dict:
        ...
