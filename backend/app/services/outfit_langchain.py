import json
import logging
import os
import time
from typing import Any, Literal

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
_rate_limited_until = 0.0

OutfitCategory = Literal["upper", "lower", "accessories", "shoes"]
WaterResistance = Literal["none", "resistant", "waterproof"]
WeatherLevel = Literal["low", "medium", "high"]
CoverageTop = Literal["none", "short_sleeve", "long_sleeve", "jacket"]
CoverageBottom = Literal["shorts", "full_length"]
FootwearType = Literal["open", "closed", "boot"]


class OutfitItemReason(BaseModel):
    category: str = Field(description="Wardrobe category for this selected item.")
    label: str = Field(description="Selected item label.")
    reason: str = Field(description="Why this item was chosen for the weather and outfit.")


class OutfitExplanation(BaseModel):
    summary: str = Field(description="Short explanation of the selected outfit.")
    item_reasons: list[OutfitItemReason] = Field(
        default_factory=list,
        description="One reason per selected clothing item.",
    )
    outfit_reason: str = Field(
        default="",
        description="Short explanation of why the selected items work together as one outfit.",
    )
    reasons: list[str] = Field(description="Concise reasons the selected items fit the weather.")
    warnings: list[str] = Field(description="Honest caveats about weak weather fit or missing tags.")
    missing_items_advice: list[str] = Field(
        description="Concise advice for missing outfit categories or useful wardrobe tags."
    )


class OutfitExplanationDetails(OutfitExplanation):
    source: Literal["langchain", "fallback"]


class WeatherContext(BaseModel):
    temp_c: float | None = None
    description: str | None = None
    precip: str | None = None
    wind: float | None = None
    style: str | None = None
    occasion: str | None = None


class ExplanationRequest(BaseModel):
    weather_context: WeatherContext
    selected_items: list[dict[str, Any]] = Field(default_factory=list)
    missing_categories: list[str] = Field(default_factory=list)


class ImageAnalysisRequest(BaseModel):
    image_url: str
    label: str | None = None
    description: str | None = None
    brand: str | None = None
    category_hint: OutfitCategory | None = None


class OutfitImageAnalysis(BaseModel):
    category: OutfitCategory | None = Field(
        default=None,
        description="Best category for the visible item.",
    )
    label: str | None = Field(
        default=None,
        description="Concise item label based on the image and supplied product title.",
    )
    description: str | None = Field(
        default=None,
        description="Short, factual description of visible clothing features.",
    )
    color: str | None = Field(
        default=None,
        description="Dominant visible color or colorway.",
    )
    brand: str | None = Field(
        default=None,
        description="Brand only if supplied or clearly visible.",
    )
    water_resistance: WaterResistance | None = Field(
        default=None,
        description="Estimated water resistance. Use waterproof only when strongly indicated.",
    )
    wind_block: WeatherLevel | None = Field(
        default=None,
        description="Estimated wind blocking from visible garment structure.",
    )
    breathability: WeatherLevel | None = Field(
        default=None,
        description="Estimated breathability from visible material and coverage.",
    )
    coverage_top: CoverageTop | None = Field(
        default=None,
        description="Top-body coverage if this is an upper item.",
    )
    coverage_bottom: CoverageBottom | None = Field(
        default=None,
        description="Bottom-body coverage if this is a lower item.",
    )
    footwear_type: FootwearType | None = Field(
        default=None,
        description="Footwear type if this is a shoe item.",
    )
    warmth_score: int | None = Field(
        default=None,
        ge=1,
        le=10,
        description="Estimated warmth from 1 very light to 10 heavy winter.",
    )
    min_temp_c: float | None = Field(
        default=None,
        description="Estimated minimum comfortable temperature in Celsius.",
    )
    max_temp_c: float | None = Field(
        default=None,
        description="Estimated maximum comfortable temperature in Celsius.",
    )
    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Confidence in the image-derived metadata.",
    )


class OutfitImageAnalysisDetails(OutfitImageAnalysis):
    source: Literal["vision", "fallback"]


def _openai_api_key() -> str | None:
    return os.getenv("OPENAI_API_KEY") or os.getenv("GPT_key")


def _openai_model(default: str = "gpt-4o-mini") -> str:
    return os.getenv("OPENAI_MODEL") or os.getenv("GPT_MODEL") or default


def _openai_vision_model(default: str = "gpt-4o-mini") -> str:
    return os.getenv("OPENAI_VISION_MODEL") or _openai_model(default)


def _openai_cooldown_active() -> bool:
    return time.monotonic() < _rate_limited_until


def _record_openai_error(exc: Exception, context: str) -> None:
    global _rate_limited_until

    status_code = getattr(exc, "status_code", None)
    if status_code == 429:
        cooldown_seconds = int(os.getenv("OPENAI_RATE_LIMIT_COOLDOWN_SECONDS", "300"))
        _rate_limited_until = time.monotonic() + max(cooldown_seconds, 1)

    logger.warning(
        "%s fallback: %s%s",
        context,
        exc.__class__.__name__,
        f" status={status_code}" if status_code else "",
    )


def _context_text(*values: str | None) -> str:
    return " ".join(value for value in values if value).lower()


def _has_any(text: str, keywords: tuple[str, ...]) -> bool:
    return any(keyword in text for keyword in keywords)


def _clamp_int(value: int | float | None, min_value: int, max_value: int) -> int | None:
    if value is None:
        return None
    return min(max_value, max(min_value, round(value)))


def _clamp_float(value: int | float | None, min_value: float, max_value: float) -> float | None:
    if value is None:
        return None
    return min(max_value, max(min_value, float(value)))


def _temperature_range_for_warmth(warmth_score: int) -> tuple[float, float]:
    ranges = {
        1: (22.0, 35.0),
        2: (20.0, 32.0),
        3: (16.0, 28.0),
        4: (12.0, 24.0),
        5: (8.0, 20.0),
        6: (4.0, 16.0),
        7: (-2.0, 12.0),
        8: (-8.0, 8.0),
        9: (-15.0, 3.0),
        10: (-20.0, 0.0),
    }
    return ranges[warmth_score]


def _estimate_category(payload: ImageAnalysisRequest, text: str) -> OutfitCategory | None:
    if payload.category_hint:
        return payload.category_hint
    if _has_any(text, ("shoe", "sneaker", "boot", "loafer", "sandal", "heel")):
        return "shoes"
    if _has_any(text, ("pants", "jeans", "trouser", "shorts", "skirt", "leggings")):
        return "lower"
    if _has_any(text, ("hat", "cap", "beanie", "scarf", "glove", "umbrella", "bag")):
        return "accessories"
    if text:
        return "upper"
    return None


def _estimate_weather_tags(
    payload: ImageAnalysisRequest,
    analysis: OutfitImageAnalysis | None = None,
) -> dict[str, Any]:
    text = _context_text(
        analysis.label if analysis else None,
        analysis.description if analysis else None,
        analysis.brand if analysis else None,
        payload.label,
        payload.description,
        payload.brand,
    )
    category = (analysis.category if analysis else None) or _estimate_category(payload, text)

    coverage_top = analysis.coverage_top if analysis else None
    coverage_bottom = analysis.coverage_bottom if analysis else None
    footwear_type = analysis.footwear_type if analysis else None
    water_resistance = analysis.water_resistance if analysis else None
    wind_block = analysis.wind_block if analysis else None
    breathability = analysis.breathability if analysis else None

    if category == "upper" and coverage_top is None:
        if _has_any(text, ("jacket", "coat", "parka", "raincoat", "shell", "anorak")):
            coverage_top = "jacket"
        elif _has_any(text, ("hoodie", "sweater", "sweatshirt", "long sleeve", "flannel")):
            coverage_top = "long_sleeve"
        elif _has_any(text, ("t-shirt", "tee", "polo", "short sleeve", "tank")):
            coverage_top = "short_sleeve"
    if category == "lower" and coverage_bottom is None:
        coverage_bottom = "shorts" if _has_any(text, ("shorts", "skort")) else "full_length"
    if category == "shoes" and footwear_type is None:
        if _has_any(text, ("boot", "chelsea", "hiking")):
            footwear_type = "boot"
        elif _has_any(text, ("sandal", "slide", "flip flop", "open toe")):
            footwear_type = "open"
        else:
            footwear_type = "closed"

    if water_resistance is None:
        if _has_any(text, ("waterproof", "gore-tex", "rain boot", "raincoat")):
            water_resistance = "waterproof"
        elif _has_any(text, ("water resistant", "water-resistant", "repellent", "shell", "rain")):
            water_resistance = "resistant"
    if wind_block is None:
        if _has_any(text, ("windproof", "hardshell", "shell", "parka", "raincoat")):
            wind_block = "high"
        elif _has_any(text, ("jacket", "coat", "hoodie", "sweatshirt", "boot")):
            wind_block = "medium"
    if breathability is None:
        if _has_any(text, ("mesh", "linen", "tank", "sandal", "shorts", "running")):
            breathability = "high"
        elif _has_any(text, ("waterproof", "raincoat", "shell", "leather", "insulated")):
            breathability = "low"
        else:
            breathability = "medium"

    warmth_score = _clamp_int(analysis.warmth_score if analysis else None, 1, 10)
    if warmth_score is None:
        warmth_score = 3
        if category == "upper":
            warmth_score = {
                "none": 1,
                "short_sleeve": 2,
                "long_sleeve": 4,
                "jacket": 6,
            }.get(coverage_top, 3)
        elif category == "lower":
            warmth_score = 1 if coverage_bottom == "shorts" else 4
        elif category == "shoes":
            warmth_score = {"open": 1, "closed": 3, "boot": 6}.get(footwear_type, 3)
        elif category == "accessories":
            warmth_score = 2

        if _has_any(text, ("parka", "puffer", "down", "insulated", "winter", "ski", "snow")):
            warmth_score = max(warmth_score, 8)
        elif _has_any(text, ("fleece", "wool", "sherpa", "thermal", "coat")):
            warmth_score = max(warmth_score, 6)
        elif _has_any(text, ("hoodie", "sweater", "sweatshirt")):
            warmth_score = max(warmth_score, 5)
        elif _has_any(text, ("tank", "sandal", "flip flop", "linen")):
            warmth_score = min(warmth_score, 2)

    min_temp_c = _clamp_float(analysis.min_temp_c if analysis else None, -20, 50)
    max_temp_c = _clamp_float(analysis.max_temp_c if analysis else None, -20, 50)
    if min_temp_c is None or max_temp_c is None:
        estimated_min, estimated_max = _temperature_range_for_warmth(warmth_score)
        min_temp_c = estimated_min if min_temp_c is None else min_temp_c
        max_temp_c = estimated_max if max_temp_c is None else max_temp_c
    if min_temp_c > max_temp_c:
        min_temp_c, max_temp_c = max_temp_c, min_temp_c

    return {
        "category": category,
        "water_resistance": water_resistance,
        "wind_block": wind_block,
        "breathability": breathability,
        "coverage_top": coverage_top,
        "coverage_bottom": coverage_bottom,
        "footwear_type": footwear_type,
        "warmth_score": warmth_score,
        "min_temp_c": min_temp_c,
        "max_temp_c": max_temp_c,
    }


def _item_label(item: dict[str, Any]) -> str:
    label = item.get("label")
    category = item.get("category")
    if label and category:
        return f"{label} ({category})"
    if label:
        return str(label)
    return "selected item"


def fallback_explanation(payload: ExplanationRequest) -> OutfitExplanationDetails:
    weather = payload.weather_context
    selected = [_item_label(item) for item in payload.selected_items]
    weather_bits = [
        f"{round(weather.temp_c)}C" if weather.temp_c is not None else None,
        weather.description,
        weather.precip,
        f"{round(weather.wind)} m/s wind" if weather.wind is not None else None,
        weather.style,
        weather.occasion,
    ]
    weather_text = ", ".join(bit for bit in weather_bits if bit) or "the current weather"

    if selected:
        summary = f"These selected wardrobe items fit {weather_text}: {', '.join(selected)}."
        item_reasons = [
            {
                "category": str(item.get("category") or "item"),
                "label": str(item.get("label") or "selected item"),
                "reason": (
                    f"Chosen for {weather_text} because its scoring reasons include "
                    f"{', '.join((item.get('reasons') or [])[:2]) or 'a balanced weather fit'}."
                ),
            }
            for item in payload.selected_items
        ]
        outfit_reason = (
            "Together, the selected categories cover the outfit from clothing to footwear while "
            "balancing temperature, precipitation, wind, and comfort scores."
        )
        reasons = [
            "The selected items were retrieved from the user's wardrobe and ranked by weather fit.",
            "Temperature, rain, wind, warmth, breathability, coverage, and vector similarity were scored before this explanation was generated.",
        ]
    else:
        summary = "No strong wardrobe match was found for this weather."
        item_reasons = []
        outfit_reason = "There are not enough selected wardrobe items to explain a complete outfit."
        reasons = [
            "The retrieval and weather scoring pipeline did not find a selected item for any category."
        ]

    warnings: list[str] = []
    if payload.missing_categories:
        warnings.append(f"Missing categories: {', '.join(payload.missing_categories)}.")

    missing_items_advice = [
        f"Add more tagged {category} items." for category in payload.missing_categories
    ]
    if not missing_items_advice:
        missing_items_advice = ["Keep item weather tags current for better recommendations."]

    return OutfitExplanationDetails(
        summary=summary,
        item_reasons=item_reasons,
        outfit_reason=outfit_reason,
        reasons=reasons,
        warnings=warnings,
        missing_items_advice=missing_items_advice,
        source="fallback",
    )


def fallback_image_analysis(payload: ImageAnalysisRequest) -> OutfitImageAnalysisDetails:
    estimates = _estimate_weather_tags(payload)
    return OutfitImageAnalysisDetails(
        category=estimates["category"],
        label=payload.label,
        description=payload.description,
        color=None,
        brand=payload.brand,
        water_resistance=estimates["water_resistance"],
        wind_block=estimates["wind_block"],
        breathability=estimates["breathability"],
        coverage_top=estimates["coverage_top"],
        coverage_bottom=estimates["coverage_bottom"],
        footwear_type=estimates["footwear_type"],
        warmth_score=estimates["warmth_score"],
        min_temp_c=estimates["min_temp_c"],
        max_temp_c=estimates["max_temp_c"],
        confidence=0.25,
        source="fallback",
    )


async def generate_outfit_explanation(payload: ExplanationRequest) -> OutfitExplanationDetails:
    if _openai_cooldown_active():
        logger.info("LangChain explanation fallback: OpenAI rate-limit cooldown active")
        return fallback_explanation(payload)

    api_key = _openai_api_key()
    if not api_key:
        logger.info("LangChain explanation fallback: missing OPENAI_API_KEY or GPT_key")
        return fallback_explanation(payload)

    model = _openai_model()

    try:
        from langchain_core.prompts import ChatPromptTemplate
        from langchain_openai import ChatOpenAI

        prompt = ChatPromptTemplate.from_messages(
            [
                (
                    "system",
                    "You explain a weather-based outfit recommendation. "
                    "Return structured JSON matching the schema exactly. "
                    "Use only the selected wardrobe items provided. "
                    "Do not invent wardrobe items, brands, colors, or weather facts. "
                    "For item_reasons, include one concise reason for each selected item, "
                    "covering why that exact clothing item was chosen. "
                    "For outfit_reason, explain why the selected clothes fit together as an outfit, "
                    "using coverage, warmth, rain, wind, comfort, style, and occasion when provided. "
                    "Do not make medical or safety claims. "
                    "Keep the writing concise and user-friendly.",
                ),
                (
                    "human",
                    "Weather, selected outfit items, item metadata, item scores, style, "
                    "occasion, and missing categories:\n{payload}",
                ),
            ]
        )

        llm = ChatOpenAI(model=model, temperature=0, api_key=api_key)
        chain = prompt | llm.with_structured_output(OutfitExplanation)
        explanation = await chain.ainvoke(
            {"payload": json.dumps(payload.model_dump(), ensure_ascii=True)}
        )

        if not isinstance(explanation, OutfitExplanation):
            return fallback_explanation(payload)

        return OutfitExplanationDetails(
            summary=explanation.summary,
            item_reasons=explanation.item_reasons,
            outfit_reason=explanation.outfit_reason,
            reasons=explanation.reasons,
            warnings=explanation.warnings,
            missing_items_advice=explanation.missing_items_advice,
            source="langchain",
        )
    except Exception as exc:
        _record_openai_error(exc, "LangChain explanation")
        return fallback_explanation(payload)


async def analyze_outfit_image(payload: ImageAnalysisRequest) -> OutfitImageAnalysisDetails:
    if _openai_cooldown_active():
        logger.info("Outfit image analysis fallback: OpenAI rate-limit cooldown active")
        return fallback_image_analysis(payload)

    api_key = _openai_api_key()
    if not api_key:
        logger.info("Outfit image analysis fallback: missing OPENAI_API_KEY or GPT_key")
        return fallback_image_analysis(payload)

    if not payload.image_url:
        return fallback_image_analysis(payload)

    model = _openai_vision_model()

    try:
        from langchain_core.messages import HumanMessage, SystemMessage
        from langchain_openai import ChatOpenAI

        supplied_context = {
            "product_title": payload.label,
            "product_description": payload.description,
            "brand": payload.brand,
            "category_hint": payload.category_hint,
        }
        system = (
            "You analyze a product image for a weather-aware wardrobe app. "
            "Return structured metadata for the single visible clothing item. "
            "Use the supplied title, brand, description, and category hint as context, "
            "but prefer visible image evidence for color, coverage, and item type. "
            "Use null for properties that cannot be inferred. "
            "Never claim waterproofing, wind protection, fabric, or insulation unless it is "
            "strongly implied by visible construction or supplied product text. "
            "Always estimate warmth_score, min_temp_c, and max_temp_c; those three fields must "
            "be numeric conservative estimates even when the exact fabric is unknown. "
            "Temperature ranges are approximate Celsius comfort estimates."
        )
        human = HumanMessage(
            content=[
                {
                    "type": "text",
                    "text": "Analyze this clothing item and return wardrobe metadata:\n"
                    + json.dumps(supplied_context, ensure_ascii=True),
                },
                {
                    "type": "image_url",
                    "image_url": {"url": payload.image_url},
                },
            ]
        )

        llm = ChatOpenAI(model=model, temperature=0, api_key=api_key, max_retries=1)
        analyzer = llm.with_structured_output(OutfitImageAnalysis)
        analysis = await analyzer.ainvoke([SystemMessage(content=system), human])

        if not isinstance(analysis, OutfitImageAnalysis):
            return fallback_image_analysis(payload)

        estimates = _estimate_weather_tags(payload, analysis)
        confidence = analysis.confidence if analysis.confidence > 0 else 0.75
        result = analysis.model_dump()
        result.update(
            {
                "category": analysis.category or estimates["category"],
                "water_resistance": analysis.water_resistance or estimates["water_resistance"],
                "wind_block": analysis.wind_block or estimates["wind_block"],
                "breathability": analysis.breathability or estimates["breathability"],
                "coverage_top": analysis.coverage_top or estimates["coverage_top"],
                "coverage_bottom": analysis.coverage_bottom or estimates["coverage_bottom"],
                "footwear_type": analysis.footwear_type or estimates["footwear_type"],
                "warmth_score": estimates["warmth_score"],
                "min_temp_c": estimates["min_temp_c"],
                "max_temp_c": estimates["max_temp_c"],
                "confidence": confidence,
                "source": "vision",
            }
        )
        return OutfitImageAnalysisDetails(**result)
    except Exception as exc:
        _record_openai_error(exc, "Outfit image analysis")
        return fallback_image_analysis(payload)
