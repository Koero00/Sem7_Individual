from pydantic import BaseModel, ConfigDict, Field


class ProductFields(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=2_000)
    price: int = Field(ge=0, description="Price in cents")
    image_url: str | None = Field(default=None, max_length=2_000)


class ProductCreate(ProductFields):
    id: str | None = Field(default=None, min_length=1, max_length=100)


class ProductUpdate(ProductFields):
    pass


class Product(ProductFields):
    model_config = ConfigDict(from_attributes=True)

    id: str
