from app.models.advisory import PestDisease
from app.services.disease_model.base import DiseaseModelAdapter


class StubDiseaseModel(DiseaseModelAdapter):
    async def scan(self, image_bytes: bytes) -> list[PestDisease]:
        return [
            PestDisease(
                diseaseName="Early Blight",
                crop="Tomato",
                pathogen="Alternaria solani",
                confidence=0.87,
                symptoms="पत्तियों पर भूरे गोल धब्बे, किनारों पर पीलापन",
                chemicalTreatment="Mancozeb 75% WP",
                organicTreatment="नीम तेल 5% घोल",
                dosage="2.5 g/L",
                estimatedCost=450,
            )
        ]
