from abc import ABC, abstractmethod


class BankVerifyAdapter(ABC):
    @abstractmethod
    async def penny_drop(self, account_number: str, ifsc: str, account_holder: str) -> dict:
        """Returns {"verified": bool, "accountHolderMatch": bool}."""
