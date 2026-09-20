/** Same keyword map as the frontend, plus the new emergency quick-tap
 *  categories (cardiac arrest, stroke, accident, poisoning, etc.) so the
 *  quick-tap buttons and free-text search resolve identically. */
const SYMPTOM_MAP = [
  { keywords: ["cardiac arrest", "chest pain", "heart", "cardiac", "palpitation", "breathless", "breathing difficulty"], specialty: "Cardiology", label: "Cardiology" },
  { keywords: ["stroke", "face droop", "slurred speech", "left arm", "right arm", "numbness", "can't move", "cannot move", "paralysis", "headache", "migraine"], specialty: "Neurology", label: "Neurology / Stroke Care" },
  { keywords: ["fracture", "broken bone", "accident", "trauma", "fell down", "sprain", "dislocat", "road accident", "knee pain", "back pain", "joint pain", "spine"], specialty: "Orthopaedics", label: "Orthopaedics & Trauma" },
  { keywords: ["kidney stone", "urine", "urinary", "flank pain"], specialty: "Nephrology", label: "Nephrology / Urology" },
  { keywords: ["pregnan", "labour", "labor", "delivery", "contraction"], specialty: "Obstetrics & Gynaecology", label: "Obstetrics & Gynaecology" },
  { keywords: ["child", "baby", "infant", "fever in kid"], specialty: "Paediatrics", label: "Paediatrics" },
  { keywords: ["eye", "vision", "cataract"], specialty: "Ophthalmology", label: "Ophthalmology" },
  { keywords: ["snake bite", "animal bite", "poisoning", "overdose", "ingested"], specialty: "General Medicine", label: "Poisoning / Bite — General Medicine" },
  { keywords: ["bleeding", "cut", "wound", "burn", "burns"], specialty: "General Surgery", label: "General Surgery / Trauma" },
  { keywords: ["seizure", "fit", "convulsion"], specialty: "Neurology", label: "Neurology" },
  { keywords: ["diabetes", "sugar level", "blood sugar"], specialty: "Diabetology", label: "Diabetology" },
  { keywords: ["fever", "cold", "cough", "vomit", "stomach", "diarrhea", "weakness"], specialty: "General Medicine", label: "General Medicine" },
];

const CRITICAL_KEYWORDS = [
  "cardiac arrest", "not breathing", "unconscious", "unconsciousness", "stroke", "face droop",
  "slurred speech", "severe bleeding", "major trauma", "seizure", "can't breathe", "cannot breathe",
  "choking", "collapsed", "snake bite", "severe burns", "road accident",
];

function detectSpecialty(text) {
  const t = (text || "").toLowerCase();
  for (const rule of SYMPTOM_MAP) {
    if (rule.keywords.some((k) => t.includes(k))) return rule;
  }
  return { specialty: "General Medicine", label: "General Medicine" };
}

function detectSeverity(text) {
  const t = (text || "").toLowerCase();
  return CRITICAL_KEYWORDS.some((k) => t.includes(k));
}

module.exports = { SYMPTOM_MAP, CRITICAL_KEYWORDS, detectSpecialty, detectSeverity };
