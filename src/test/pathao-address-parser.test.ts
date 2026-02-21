import { describe, it, expect } from "vitest";
import { parseAddress, normalizeAddressText } from "@/lib/pathao-address-parser";

describe("pathao-address-parser", () => {
  describe("normalizeAddressText", () => {
    it("converts Bengali to English and normalizes", () => {
      const result = normalizeAddressText("ঢাকা মিরপুর ১");
      expect(result).toContain("dhaka");
      expect(result).toContain("mirpur");
    });

    it("expands abbreviations", () => {
      const result = normalizeAddressText("Bashundhara R/A Block A");
      expect(result).toContain("residential area");
    });

    it("strips punctuation and collapses spaces", () => {
      const result = normalizeAddressText("  mirpur-1,  shah ali garden  ");
      expect(result).toBe("mirpur-1 shah ali garden");
    });
  });

  describe("parseAddress - test case from spec", () => {
    it("maps 'Kawran Bazar / Bashundhara City' to Panthapath", () => {
      const result = parseAddress(
        "9/10 garden road west Kawran Bazar ( Bashundhara city shopping complex er pichone)"
      );
      expect(result.zone).toBe("Panthapath");
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.needs_manual_review).toBe(false);
      expect(["Kawran Bazar", "Bashundhara City"]).toContain(result.area);
      expect(result.address_normalized).toBeTruthy();
    });
  });

  describe("parseAddress - Mirpur zones", () => {
    it("maps Shah Ali Garden to Mirpur-1", () => {
      const result = parseAddress("148/9/1 Shah Ali Garden, Shah Ali Bagh, Mirpur-1");
      expect(result.zone).toBe("Mirpur-1");
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it("maps mirpur1 road to Mirpur-1", () => {
      const result = parseAddress("house 10, road 5, mirpur1");
      expect(result.zone).toBe("Mirpur-1");
    });

    it("maps Pallabi to Mirpur-12", () => {
      const result = parseAddress("Pallabi, Mirpur");
      expect(result.zone).toBe("Mirpur-12");
    });

    it("maps Kafrul to Mirpur-14", () => {
      const result = parseAddress("Kafrul, Mirpur 14");
      expect(result.zone).toBe("Mirpur-14");
    });

    it("maps Shewrapara to Mirpur-6", () => {
      const result = parseAddress("Shewrapara, Mirpur");
      expect(result.zone).toBe("Mirpur-6");
    });

    it("maps Agargaon to Mirpur-6", () => {
      const result = parseAddress("Agargaon, Sher-e-Bangla Nagar");
      expect(result.zone).toBe("Mirpur-6");
    });
  });

  describe("parseAddress - Dhanmondi / Mohammadpur", () => {
    it("maps Dhanmondi address", () => {
      const result = parseAddress("House 10, Road 5, Dhanmondi");
      expect(result.zone).toBe("Dhanmondi");
    });

    it("maps Science Lab to Dhanmondi", () => {
      const result = parseAddress("Science Lab, Dhaka");
      expect(result.zone).toBe("Dhanmondi");
    });

    it("maps Mohammadpur", () => {
      const result = parseAddress("Lalmatia, Mohammadpur");
      expect(result.zone).toBe("Mohammadpur");
    });
  });

  describe("parseAddress - Gulshan / Banani", () => {
    it("maps Gulshan-1 with Niketan", () => {
      const result = parseAddress("Niketan, Gulshan 1");
      expect(result.zone).toBe("Gulshan-1");
    });

    it("maps Gulshan-2", () => {
      const result = parseAddress("Road 45, Gulshan 2, Dhaka");
      expect(result.zone).toBe("Gulshan-2");
    });
  });

  describe("parseAddress - Uttara sectors", () => {
    it("maps Uttara Sector 3", () => {
      const result = parseAddress("Sector 3, Uttara, Dhaka");
      expect(result.zone).toBe("Uttara Sector 3");
    });

    it("maps Uttara Sector 7", () => {
      const result = parseAddress("House 5, Road 10, Uttara Sector 7");
      expect(result.zone).toBe("Uttara Sector 7");
    });

    it("maps Diabari to Uttara Sector 14", () => {
      const result = parseAddress("Diabari, Uttara");
      expect(result.zone).toBe("Uttara Sector 14");
    });
  });

  describe("parseAddress - ambiguous Bashundhara", () => {
    it("maps Bashundhara R/A to residential area", () => {
      const result = parseAddress("Block A, Bashundhara R/A");
      expect(result.zone).toBe("Bashundhara R/A");
    });

    it("maps Bashundhara City Shopping to Panthapath", () => {
      const result = parseAddress("Bashundhara City Shopping Complex");
      expect(result.zone).toBe("Panthapath");
    });

    it("flags bare 'bashundhara' as needing manual review", () => {
      const result = parseAddress("Bashundhara");
      // D) Bare "bashundhara" without city/r-a signals = ambiguous, low confidence
      expect(result.needs_manual_review).toBe(true);
    });
  });

  describe("parseAddress - other zones", () => {
    it("maps Badda", () => {
      const result = parseAddress("Merul Badda, Dhaka");
      expect(result.zone).toBe("Badda");
    });

    it("maps Jatrabari", () => {
      const result = parseAddress("Jatrabari, Dhaka");
      expect(result.zone).toBe("Jatrabari");
    });

    it("maps Motijheel", () => {
      const result = parseAddress("Dilkusha, Motijheel");
      expect(result.zone).toBe("Motijheel");
    });

    it("maps Farmgate", () => {
      const result = parseAddress("Farmgate, Dhaka");
      expect(result.zone).toBe("Farmgate");
    });
  });

  describe("parseAddress - returns suggestions", () => {
    it("returns top_suggestions array", () => {
      const result = parseAddress("some address near mirpur");
      expect(result.top_suggestions).toBeDefined();
      expect(Array.isArray(result.top_suggestions)).toBe(true);
    });
  });

  describe("parseAddress - confidence thresholds", () => {
    it("gives high confidence for exact match", () => {
      const result = parseAddress("Mirpur-10, Dhaka");
      expect(result.confidence).toBeGreaterThanOrEqual(0.75);
    });

    it("gives lower confidence for vague address", () => {
      const result = parseAddress("some random street 123");
      expect(result.confidence).toBeLessThan(0.85);
    });

    it("includes mapping_mode in result", () => {
      const result = parseAddress("Dhanmondi Road 5");
      expect(result.mapping_mode).toBe("auto");
    });

    it("Kawran Bazar hard rule fires correctly", () => {
      const result = parseAddress("kawran bazar area near panthapath");
      expect(result.zone).toBe("Panthapath");
    });

    it("Bashundhara R/A with kuril fires correctly", () => {
      const result = parseAddress("Bashundhara near Kuril");
      expect(result.zone).toBe("Bashundhara R/A");
    });
  });
});
