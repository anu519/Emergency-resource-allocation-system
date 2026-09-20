/** Great-circle distance in km. */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const TIRUNELVELI_CENTER = { lat: 8.7192, lng: 77.7449 };

/**
 * Ranks hospitals for a given specialty + user location, using the same
 * weighting as the frontend prototype (specialty match, distance, bed/staff
 * availability, wait time) so scores don't drift between client and server.
 *
 * @param {Array} hospitals - Hospital rows, each with a `bedStatus` relation loaded
 * @param {string} specialty
 * @param {{lat:number,lng:number}|null} userCoords
 */
function rankHospitals(hospitals, specialty, userCoords) {
  const origin = userCoords || TIRUNELVELI_CENTER;

  const scored = hospitals.map((h) => {
    const dist = haversineKm(origin.lat, origin.lng, h.lat, h.lng);
    const status = h.bedStatus || { bedsAvailable: 0, icuAvailable: 0, waitMinutes: 20, doctorOnDuty: false, ctAvailable: false };

    const specialtyMatch = specialty
      ? h.specialties.some(
          (s) => s.toLowerCase().includes(specialty.toLowerCase()) || specialty.toLowerCase().includes(s.toLowerCase().split(" ")[0])
        )
      : true;

    const specialtyScore = specialtyMatch ? 40 : 10;
    const distScore = Math.max(0, 25 - dist * 3.2);
    const availScore = Math.min(20, status.bedsAvailable * 1.3) + (status.doctorOnDuty ? 8 : 0);
    const waitScore = Math.max(0, 12 - status.waitMinutes / 3);
    const total = specialtyScore + distScore + availScore + waitScore;

    const reasons = [];
    if (specialtyMatch) reasons.push(`Matches ${specialty || "your"} care needs`);
    if (status.doctorOnDuty) reasons.push("Specialist on duty now");
    reasons.push(`${status.bedsAvailable} bed${status.bedsAvailable === 1 ? "" : "s"} open`);
    if (status.icuAvailable > 0) reasons.push(`${status.icuAvailable} ICU bed${status.icuAvailable === 1 ? "" : "s"} free`);
    reasons.push(`~${Math.round(dist * 10) / 10} km away`);
    if (status.ctAvailable) reasons.push("CT/imaging available");

    return {
      ...h,
      distanceKm: Math.round(dist * 10) / 10,
      etaMinutes: Math.max(4, Math.round(dist * 3)),
      status,
      score: Math.round(total),
      specialtyMatch,
      reasons,
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

module.exports = { haversineKm, rankHospitals, TIRUNELVELI_CENTER };
