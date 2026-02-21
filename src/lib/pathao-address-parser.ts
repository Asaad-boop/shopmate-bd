/**
 * Scoring-based Pathao address parser.
 * 
 * Algorithm:
 * A) Normalize address (lowercase, strip punctuation, apply bn→en aliases, abbreviations)
 * B) Apply hard_rules FIRST — if triggered, force_zone is locked
 * C) Score each zone: aliases, strong/weak keywords, ambiguous tokens, negatives, multi-signal bonus
 * D) Select best_zone, compute confidence
 * E) Area selection inside best_zone
 * F) Manual review triggers
 * G) Return top 3 suggestions
 */

import {
  BN_EN_ALIAS_MAP,
  ABBREVIATION_MAP,
  SCORING_WEIGHTS,
  CONFIDENCE_CONFIG,
  HARD_RULES,
  DHAKA_CITY,
  CITY_DEFINITIONS,
  CITY_DETECTION_KEYWORDS,
  type HardRule,
  type ZoneDefinition,
  type CityDefinition,
} from "./pathao-address-dictionary";

/* ── Types ── */

export interface ZoneSuggestion {
  zone: string;
  score: number;
  area: string;
  reasons: string[];
}

export interface ParseAddressResult {
  city: string;
  zone: string;
  area: string;
  confidence: number;
  needs_manual_review: boolean;
  reasons: string[];
  top_suggestions: ZoneSuggestion[];
  address_normalized: string;
}

/* ── A) Normalization ── */

export function normalizeAddressText(raw: string): string {
  if (!raw) return "";
  let s = raw;

  // Apply bn→en aliases (Bengali script → English)
  for (const [bn, en] of Object.entries(BN_EN_ALIAS_MAP)) {
    if (s.includes(bn)) {
      s = s.split(bn).join(en);
    }
  }

  // Lowercase
  s = s.toLowerCase();

  // Apply abbreviation map BEFORE stripping punctuation (so "r/a" works)
  for (const [abbr, full] of Object.entries(ABBREVIATION_MAP)) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    s = s.replace(regex, full);
  }

  // Strip punctuation but keep hyphens between word-number (mirpur-1)
  s = s.replace(/[,।\.\/:;'"!?@#$%^&*~`{}[\]|\\]+/g, " ");
  s = s.replace(/\(|\)/g, " ");

  // Collapse spaces
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/* ── B) Hard Rules ── */

function checkHardRules(normalized: string): { zone: string; reason: string } | null {
  for (const rule of HARD_RULES) {
    const allMatch = rule.patterns.every(p => normalized.includes(p));
    if (!allMatch) continue;

    if (rule.negative_patterns) {
      const anyNeg = rule.negative_patterns.some(p => normalized.includes(p));
      if (anyNeg) continue;
    }

    return { zone: rule.force_zone, reason: rule.reason };
  }
  return null;
}
/* ── City Auto-Detection ── */

function detectCityFromAddress(normalized: string): string | null {
  // Check non-Dhaka cities first (Dhaka is default fallback)
  for (const city of ["Chittagong", "Sylhet", "Rajshahi"]) {
    const keywords = CITY_DETECTION_KEYWORDS[city] || [];
    for (const kw of keywords) {
      if (normalized.includes(kw)) {
        return city;
      }
    }
  }
  return null;
}

/* ── C) Zone Scoring ── */

interface ZoneScore {
  zone: string;
  score: number;
  reasons: string[];
  uniqueHits: number;
  onlyAmbiguous: boolean;
  bestArea: string;
  bestAreaScore: number;
}

function scoreZone(
  zoneName: string,
  zoneDef: ZoneDefinition,
  normalized: string,
  ambiguousTokens: CityDefinition["ambiguous_tokens"]
): ZoneScore {
  let score = 0;
  const reasons: string[] = [];
  let uniqueHits = 0;
  let onlyAmbiguous = true;

  // Alias match
  for (const alias of zoneDef.aliases) {
    if (normalized.includes(alias)) {
      score += SCORING_WEIGHTS.zone_alias_match;
      reasons.push(`Zone alias "${alias}" matched`);
      uniqueHits++;
      onlyAmbiguous = false;
      break; // count once
    }
  }

  // Strong keywords
  let strongCount = 0;
  for (const kw of zoneDef.strong_keywords) {
    if (normalized.includes(kw)) {
      score += SCORING_WEIGHTS.strong_keyword_match;
      reasons.push(`Strong keyword "${kw}" matched`);
      uniqueHits++;
      strongCount++;
      onlyAmbiguous = false;
    }
  }

  // Weak keywords
  let weakCount = 0;
  for (const kw of zoneDef.weak_keywords) {
    if (normalized.includes(kw)) {
      score += SCORING_WEIGHTS.weak_keyword_match;
      reasons.push(`Weak keyword "${kw}" matched`);
      uniqueHits++;
      weakCount++;
      // Weak keywords alone don't clear onlyAmbiguous
    }
  }

  // Check if only weak keywords matched
  if (uniqueHits > 0 && strongCount === 0 && !zoneDef.aliases.some(a => normalized.includes(a))) {
    // Only weak keywords = might still be ambiguous
    if (weakCount === uniqueHits) {
      onlyAmbiguous = true;
    }
  }

  // Ambiguous token check
  for (const [token, config] of Object.entries(ambiguousTokens)) {
    if (!normalized.includes(token)) continue;
    if (!config.possible_zones.includes(zoneName)) continue;

    // Check disambiguation signals
    let disambiguated = false;
    for (const [signal, targetZone] of Object.entries(config.disambiguation_signals)) {
      if (normalized.includes(signal) && targetZone === zoneName) {
        score += SCORING_WEIGHTS.strong_keyword_match; // Disambiguated = strong signal
        reasons.push(`Ambiguous "${token}" disambiguated by "${signal}"`);
        uniqueHits++;
        onlyAmbiguous = false;
        disambiguated = true;
        break;
      }
    }

    if (!disambiguated) {
      score += SCORING_WEIGHTS.ambiguous_token_match;
      reasons.push(`Ambiguous token "${token}" matched (not disambiguated)`);
      uniqueHits++;
    }
  }

  // Negative keywords penalty
  for (const kw of zoneDef.negative_keywords) {
    if (normalized.includes(kw)) {
      score += SCORING_WEIGHTS.negative_keyword_penalty;
      reasons.push(`Negative keyword "${kw}" penalty`);
    }
  }

  // Multi-signal bonus
  if (uniqueHits > 1) {
    const bonus = Math.min(
      (uniqueHits - 1) * SCORING_WEIGHTS.multi_signal_bonus,
      SCORING_WEIGHTS.multi_signal_max
    );
    score += bonus;
    reasons.push(`Multi-signal bonus +${bonus}`);
  }

  // Area matching
  let bestArea = "";
  let bestAreaScore = 0;
  for (const [areaName, areaDef] of Object.entries(zoneDef.areas)) {
    let areaScore = 0;
    for (const alias of areaDef.aliases) {
      if (normalized.includes(alias)) {
        areaScore += SCORING_WEIGHTS.area_alias_match;
      }
    }
    if (areaScore > bestAreaScore) {
      bestAreaScore = areaScore;
      bestArea = areaName;
    }
  }

  return {
    zone: zoneName,
    score: Math.max(0, score),
    reasons,
    uniqueHits,
    onlyAmbiguous: onlyAmbiguous && uniqueHits > 0,
    bestArea,
    bestAreaScore,
  };
}

/* ── Mirpur number extraction (handles "mirpur-1", "mirpur 1", "mirpur1road") ── */

function extractMirpurNumber(normalized: string): number | null {
  const match = normalized.match(/mirpur[\s-]*(\d{1,2})/);
  return match ? parseInt(match[1], 10) : null;
}

function extractUttaraSector(normalized: string): number | null {
  const match = normalized.match(/(?:uttara[\s-]*(?:sector[\s-]*)?|sector[\s-]*)(\d{1,2})[\s,]*(?:uttara)?/);
  return match ? parseInt(match[1], 10) : null;
}

function extractGulshanNumber(normalized: string): number | null {
  const match = normalized.match(/gulshan[\s-]*(\d{1,2})/);
  return match ? parseInt(match[1], 10) : null;
}

/* ── Main Parser ── */

export function parseAddress(
  addressRaw: string,
  userSelectedCity: string = "Dhaka"
): ParseAddressResult {
  const address_normalized = normalizeAddressText(addressRaw);
  const reasons: string[] = [];
  let needs_manual_review = false;
  let city = userSelectedCity;

  // Auto-detect city from address if not explicitly set
  const detectedCity = detectCityFromAddress(address_normalized);
  if (detectedCity && detectedCity !== city) {
    city = detectedCity;
    reasons.push(`City auto-detected: ${detectedCity}`);
  }

  // Get city definition
  const cityDef = CITY_DEFINITIONS[city] || DHAKA_CITY;

  // B) Check hard rules FIRST
  const hardRule = checkHardRules(address_normalized);
  let forcedZone: string | null = null;
  if (hardRule) {
    forcedZone = hardRule.zone;
    reasons.push(`Hard rule: ${hardRule.reason}`);
  }

  // Check numbered zone patterns (highest priority regex extractions)
  if (!forcedZone) {
    const mirpurNum = extractMirpurNumber(address_normalized);
    if (mirpurNum && mirpurNum >= 1 && mirpurNum <= 14) {
      const zoneName = `Mirpur-${mirpurNum}`;
      if (cityDef.zones[zoneName]) {
        forcedZone = zoneName;
        reasons.push(`Extracted Mirpur-${mirpurNum} from address pattern`);
      }
    }

    if (!forcedZone) {
      const uttaraSec = extractUttaraSector(address_normalized);
      if (uttaraSec && uttaraSec >= 1 && uttaraSec <= 14) {
        forcedZone = `Uttara Sector ${uttaraSec}`;
        reasons.push(`Extracted Uttara Sector ${uttaraSec} from address pattern`);
      }
    }

    if (!forcedZone) {
      const gulshanNum = extractGulshanNumber(address_normalized);
      if (gulshanNum && gulshanNum >= 1 && gulshanNum <= 2) {
        forcedZone = `Gulshan-${gulshanNum}`;
        reasons.push(`Extracted Gulshan-${gulshanNum} from address pattern`);
      }
    }
  }

  // C) Score all zones
  const zoneScores: ZoneScore[] = [];
  for (const [zoneName, zoneDef] of Object.entries(cityDef.zones)) {
    const zs = scoreZone(zoneName, zoneDef, address_normalized, cityDef.ambiguous_tokens);
    zoneScores.push(zs);
  }

  // Sort by score descending
  zoneScores.sort((a, b) => b.score - a.score);

  // D) Select best zone
  let bestZone: ZoneScore;
  let secondBestScore = 0;

  if (forcedZone) {
    // Find the forced zone in scores, or create a synthetic entry
    const forced = zoneScores.find(z => z.zone === forcedZone);
    if (forced) {
      // Boost its score to ensure it wins
      forced.score = Math.max(forced.score, (zoneScores[0]?.score || 0) + 10);
      forced.reasons.push("Forced by hard rule / pattern extraction");
    }
    bestZone = forced || {
      zone: forcedZone,
      score: 30,
      reasons: [`Forced zone: ${forcedZone}`],
      uniqueHits: 1,
      onlyAmbiguous: false,
      bestArea: "",
      bestAreaScore: 0,
    };
    // Re-sort
    zoneScores.sort((a, b) => b.score - a.score);
    secondBestScore = zoneScores.length > 1 ? zoneScores[1].score : 0;
  } else {
    bestZone = zoneScores[0] || {
      zone: "",
      score: 0,
      reasons: [],
      uniqueHits: 0,
      onlyAmbiguous: true,
      bestArea: "",
      bestAreaScore: 0,
    };
    secondBestScore = zoneScores.length > 1 ? zoneScores[1].score : 0;
  }

  // Compute confidence
  const scoreDiff = bestZone.score - secondBestScore;
  let confidence = Math.min(
    1,
    Math.max(
      0,
      CONFIDENCE_CONFIG.base + scoreDiff / CONFIDENCE_CONFIG.diff_divisor
    )
  );

  // E) Area selection
  let area = bestZone.bestArea;
  if (!area && bestZone.zone) {
    // Try to find area from the zone definition
    const zoneDef = cityDef.zones[bestZone.zone];
    if (zoneDef) {
      for (const [areaName, areaDef] of Object.entries(zoneDef.areas)) {
        for (const alias of areaDef.aliases) {
          if (address_normalized.includes(alias)) {
            area = areaName;
            break;
          }
        }
        if (area) break;
      }
    }
    if (!area) {
      confidence = Math.max(0, confidence - 0.1);
    }
  }

  // Check for tied areas
  if (bestZone.zone && cityDef.zones[bestZone.zone]) {
    const zoneDef = cityDef.zones[bestZone.zone];
    const matchedAreas = Object.entries(zoneDef.areas).filter(([, ad]) =>
      ad.aliases.some(a => address_normalized.includes(a))
    );
    if (matchedAreas.length > 1) {
      needs_manual_review = true;
      reasons.push(`Multiple areas matched: ${matchedAreas.map(a => a[0]).join(", ")}`);
    }
  }

  // F) Manual review triggers
  if (confidence < CONFIDENCE_CONFIG.manual_review_if_below) {
    needs_manual_review = true;
    reasons.push(`Confidence ${(confidence * 100).toFixed(0)}% below threshold`);
  }

  if (scoreDiff < CONFIDENCE_CONFIG.close_score_diff_threshold && bestZone.score > 0) {
    needs_manual_review = true;
    reasons.push(`Close scores: best=${bestZone.score} vs second=${secondBestScore}`);
  }

  if (bestZone.onlyAmbiguous) {
    needs_manual_review = true;
    reasons.push(`Only ambiguous token matched for ${bestZone.zone}`);
  }

  if (!bestZone.zone) {
    needs_manual_review = true;
    reasons.push("No zone matched");
  }

  // If forced zone, override manual review to false if confidence is high
  if (forcedZone && confidence >= 0.85) {
    needs_manual_review = false;
  }

  // G) Top suggestions
  const top_suggestions: ZoneSuggestion[] = zoneScores
    .filter(z => z.score > 0)
    .slice(0, 3)
    .map(z => ({
      zone: z.zone,
      score: z.score,
      area: z.bestArea,
      reasons: z.reasons,
    }));

  // Add reasons from bestZone
  reasons.push(...bestZone.reasons);

  return {
    city,
    zone: bestZone.zone,
    area,
    confidence: Math.round(confidence * 100) / 100,
    needs_manual_review,
    reasons: [...new Set(reasons)], // dedupe
    top_suggestions,
    address_normalized,
  };
}

/* ── Confidence Level Helper (for UI) ── */

export function getParseConfidenceLevel(confidence: number): {
  level: "high" | "medium" | "low";
  label: string;
  color: string;
  icon: string;
} {
  const pct = confidence * 100;
  if (pct >= 85) {
    return { level: "high", label: "Auto-detected", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "🟢" };
  }
  if (pct >= 60) {
    return { level: "medium", label: "Please verify", color: "bg-amber-50 text-amber-700 border-amber-200", icon: "🟡" };
  }
  return { level: "low", label: "Manual entry required", color: "bg-red-50 text-red-700 border-red-200", icon: "🔴" };
}
