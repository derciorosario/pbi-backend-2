// placesAutocompleteCountriesCities.js
const https = require("https");

/**
 * Autocomplete restricted to countries + cities (localities).
 * @param {string} input  - user text (e.g., "Mapu", "Moz")
 * @param {object} opts
 * @param {string} opts.apiKey             - Google Maps API key
 * @param {string} [opts.sessionToken]     - strongly recommended for billing sessions
 * @param {object} [opts.bias]             - optional {lat, lng, radiusMeters} for locationBias
 * @param {string} [opts.languageCode="en"]
 * @returns {Promise<any>} raw API JSON
 */
function autocompleteCountriesAndCities(input, {
  apiKey,
  sessionToken,
  bias,
  languageCode = "en",
} = {}) {
  if (!input) return Promise.reject(new Error("input is required"));
  if (!apiKey) return Promise.reject(new Error("apiKey is required"));

  const body = {
    input,
    // Filter to ONLY these primary types:
    includedPrimaryTypes: ["country", "locality"],
    languageCode,
  };

  if (sessionToken) body.sessionToken = sessionToken;
  if (bias && bias.lat != null && bias.lng != null && bias.radiusMeters != null) {
    body.locationBias = {
      circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: bias.radiusMeters }
    };
  }

  const reqOpts = {
    method: "POST",
    hostname: "places.googleapis.com",
    path: "/v1/places:autocomplete",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      // Field mask is REQUIRED for v1:
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId," +
        "suggestions.placePrediction.text.text," +
        "suggestions.placePrediction.structuredFormat," +
        "suggestions.placePrediction.types," +
        "suggestions.placePrediction.primaryType",
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(reqOpts, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        try {
          const json = JSON.parse(raw || "null");
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(json);
          else reject(new Error(`HTTP ${res.statusCode}: ${raw}`));
        } catch {
          reject(new Error(`Bad JSON (status ${res.statusCode}): ${raw}`));
        }
      });
    });
    req.on("error", reject);
    req.end(JSON.stringify(body));
  });
}



const { randomUUID } = require("crypto");
autocompleteCountriesAndCities("Mapu", {
  apiKey: 'AIzaSyAF9zZKiLS2Ep98eFCX-jA871QAJxG5des',
  sessionToken: randomUUID(),            // recommended for pricing sessions
  bias: { lat: -25.9667, lng: 32.5833, radiusMeters: 300000 }, // optional bias around Maputo
  languageCode: "pt"                     // optional language
})
.then(r => {
  // r.suggestions = up to 5 predictions
  console.log(
    r.suggestions.map(s => ({
      id: s.placePrediction.placeId,
      label: s.placePrediction.text?.text,
      primaryType: s.placePrediction.primaryType,
      types: s.placePrediction.types
    }))
  );
})
.catch(console.error);

