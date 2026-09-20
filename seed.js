const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// Ported directly from the frontend's HOSPITALS constant.
const HOSPITALS = [
  { key: "shifa", name: "Shifa Hospitals", area: "Kailasapuram, Tirunelveli", address: "82, Kailasapuram Middle Street, Tirunelveli - 627001", phone: "+914622333245", lat: 8.7280, lng: 77.7508, specialties: ["General Medicine", "ENT", "Orthopaedics", "Oncology", "Blood Bank"], insurers: ["Star Health", "HDFC Ergo", "CGHS", "Tamil Nadu CMCHIS"], beds: 180, established: 1971, rating: 4.1 },
  { key: "srisakthi", name: "Sri Sakthi Hospital", area: "Vannarpettai, Tirunelveli", address: "No 4, Trivandrum Main Road, Vannarpettai, Tirunelveli - 627003", phone: "+914622501075", lat: 8.7301, lng: 77.7398, specialties: ["Orthopaedics & Trauma", "Obstetrics & Gynaecology", "Critical Care", "Laparoscopy", "Spine Surgery"], insurers: ["Star Health", "ICICI Lombard", "Tamil Nadu CMCHIS"], beds: 120, established: 1989, rating: 4.0 },
  { key: "kauvery", name: "Kauvery Hospital Tirunelveli", area: "Vannarpettai, Tirunelveli", address: "North By-Pass Road, Vannarpettai, Tirunelveli - 627003", phone: "+914624006000", lat: 8.7294, lng: 77.7412, specialties: ["Cardiology", "Nephrology", "Neurology", "Critical Care", "General Surgery"], insurers: ["Star Health", "HDFC Ergo", "Care Health", "Tamil Nadu CMCHIS", "CGHS"], beds: 100, established: 2021, rating: 4.3 },
  { key: "porunai", name: "Porunai Hospitals", area: "Tirunelveli Town", address: "Tirunelveli - 627001", phone: "+914622570001", lat: 8.7135, lng: 77.7580, specialties: ["Super-speciality", "Cardiology", "Neurosurgery", "Oncology", "Nephrology"], insurers: ["Star Health", "ICICI Lombard", "Bajaj Allianz", "Tamil Nadu CMCHIS"], beds: 200, established: 2016, rating: 4.2 },
  { key: "galaxy", name: "Galaxy Hospitals", area: "Vannarpet, Tirunelveli", address: "110E/120/1, North By-Pass Road, Vannarpet, Tirunelveli - 627003", phone: "+914622501951", lat: 8.7288, lng: 77.7420, specialties: ["Cardiology", "Cardiac Surgery", "General Medicine"], insurers: ["Star Health", "Tamil Nadu CMCHIS"], beds: 90, established: 2005, rating: 4.0 },
  { key: "annaivelankanni", name: "Annai Velankanni Multispeciality Hospital", area: "Palayamkottai, Tirunelveli", address: "1/111, Somasinayanar Street, Murugankurichi, Palayamkottai, Tirunelveli - 627002", phone: "+919077919191", lat: 8.7158, lng: 77.7561, specialties: ["Cardiology", "Neurology", "Orthopaedics", "Paediatrics", "Gynaecology", "General Medicine"], insurers: ["Star Health", "HDFC Ergo", "Tamil Nadu CMCHIS"], beds: 110, established: 1977, rating: 3.9 },
  { key: "sooriya", name: "Sooriya Hospital", area: "High Road, Tirunelveli", address: "52/17, High Road, Near Getwell Anjaneyar Kovil, Tirunelveli - 627001", phone: "+914622334000", lat: 8.7150, lng: 77.7590, specialties: ["Multi-speciality", "General Surgery", "Diagnostics"], insurers: ["Star Health", "Care Health"], beds: 75, established: 1998, rating: 3.9 },
  { key: "rosemary", name: "Rosemary Speciality Hospital", area: "Vannarpettai, Tirunelveli", address: "10/3, South Byepass Road, Vannarpettai, Tirunelveli - 627003", phone: "+914622503010", lat: 8.7265, lng: 77.7385, specialties: ["General Medicine", "Diabetology", "Wound Care"], insurers: ["Star Health"], beds: 40, established: 2001, rating: 3.8 },
  { key: "raja", name: "Raja Hospital", area: "Barani Nagar, Tirunelveli", address: "110E7, North Bypass Road, Barani Nagar, Tirunelveli - 627003", phone: "+914622505050", lat: 8.7276, lng: 77.7430, specialties: ["Neurology", "Neurosurgery", "Stroke Care"], insurers: ["Star Health", "Tamil Nadu CMCHIS"], beds: 60, established: 2008, rating: 4.0 },
  { key: "venkateshwara", name: "Venkateshwara Hospitals", area: "Maharaja Nagar, Tirunelveli", address: "No 7D, High Ground, St Thomas Road, Maharaja Nagar, Tirunelveli - 627011", phone: "+914622578080", lat: 8.7231, lng: 77.7605, specialties: ["General Medicine", "Orthopaedics", "Paediatrics"], insurers: ["Star Health", "ICICI Lombard"], beds: 55, established: 1995, rating: 3.9 },
  { key: "mayo", name: "Mayo Hospital", area: "Melapalayam, Tirunelveli", address: "No.1, Anna Veethi, Melapalayam, Tirunelveli - 627005", phone: "+914622582020", lat: 8.7390, lng: 77.7190, specialties: ["General Medicine", "General Surgery", "Gynaecology"], insurers: ["Star Health"], beds: 50, established: 1990, rating: 3.7 },
  { key: "agarwal", name: "Dr Agarwal's Eye Hospital", area: "Vannarpet, Tirunelveli", address: "No: 10B/1H/2, Trivandrum Road, Vannarpet, Tirunelveli - 627003", phone: "+914622501818", lat: 8.7283, lng: 77.7405, specialties: ["Ophthalmology", "Cataract Surgery", "Retina Care"], insurers: ["Star Health", "HDFC Ergo"], beds: 25, established: 1994, rating: 4.4 },
];

// Ported from the frontend's DOCTORS constant; hospitalKey maps to HOSPITALS[].key.
const DOCTORS = [
  { name: "Dr. Meenakshi Raman", specialty: "General Medicine", hospitalKey: "shifa", exp: 14, rating: 4.6, fee: 299, langs: ["English", "Tamil"] },
  { name: "Dr. Arul Selvan", specialty: "Cardiology", hospitalKey: "kauvery", exp: 19, rating: 4.8, fee: 499, langs: ["English", "Tamil"] },
  { name: "Dr. Priya Nagarajan", specialty: "Obstetrics & Gynaecology", hospitalKey: "srisakthi", exp: 11, rating: 4.5, fee: 399, langs: ["Tamil", "English"] },
  { name: "Dr. Karthik Subramaniam", specialty: "Orthopaedics", hospitalKey: "srisakthi", exp: 9, rating: 4.4, fee: 349, langs: ["English", "Tamil"] },
  { name: "Dr. Lakshmi Ganesan", specialty: "Paediatrics", hospitalKey: "annaivelankanni", exp: 13, rating: 4.7, fee: 349, langs: ["Tamil", "English"] },
  { name: "Dr. Vignesh Iyer", specialty: "Neurology", hospitalKey: "raja", exp: 16, rating: 4.6, fee: 549, langs: ["English", "Tamil"] },
  { name: "Dr. Fathima Beevi", specialty: "Diabetology", hospitalKey: "rosemary", exp: 12, rating: 4.5, fee: 349, langs: ["Tamil", "English"] },
  { name: "Dr. Senthil Kumar", specialty: "Nephrology", hospitalKey: "porunai", exp: 15, rating: 4.6, fee: 449, langs: ["English", "Tamil"] },
  { name: "Dr. Deepa Ravichandran", specialty: "Ophthalmology", hospitalKey: "agarwal", exp: 10, rating: 4.7, fee: 299, langs: ["English", "Tamil"] },
  { name: "Dr. Muthu Krishnan", specialty: "General Medicine", hospitalKey: "venkateshwara", exp: 8, rating: 4.3, fee: 249, langs: ["Tamil", "English"] },
];

// The 12-cause icon grid for the booking flow's "reason for visit" screen.
const CAUSES = [
  { slug: "knee-joint-pain", label: "Knee / Joint pain", specialty: "Orthopaedics", icon: "bone" },
  { slug: "back-pain", label: "Back & Spine pain", specialty: "Orthopaedics", icon: "activity" },
  { slug: "kidney-stone", label: "Kidney stone / Urinary issues", specialty: "Nephrology", icon: "droplet" },
  { slug: "fever-cold", label: "Fever, Cold & Cough", specialty: "General Medicine", icon: "thermometer" },
  { slug: "pregnancy-women", label: "Pregnancy & Women's health", specialty: "Obstetrics & Gynaecology", icon: "baby" },
  { slug: "child-health", label: "Child health", specialty: "Paediatrics", icon: "users" },
  { slug: "eye-problems", label: "Eye problems", specialty: "Ophthalmology", icon: "eye" },
  { slug: "heart-chest-pain", label: "Heart & Chest pain", specialty: "Cardiology", icon: "heart-pulse" },
  { slug: "diabetes-sugar", label: "Diabetes & Sugar", specialty: "Diabetology", icon: "syringe" },
  { slug: "headache-migraine", label: "Headache & Migraine", specialty: "Neurology", icon: "brain" },
  { slug: "stomach-digestion", label: "Stomach & Digestion", specialty: "General Medicine", icon: "pill" },
  { slug: "skin-allergy-wound", label: "Skin, Allergy & Wound care", specialty: "General Medicine", icon: "scissors" },
];

function seededRandom(seed) {
  let x = 0;
  for (let i = 0; i < seed.length; i++) x = (x * 31 + seed.charCodeAt(i)) % 100000;
  return () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
}

// Generates a few upcoming open slots per doctor over the next 3 days, so
// the "book appointment" flow has something real to select immediately
// after seeding, without needing a separate slot-generation job yet.
function upcomingSlots(count = 6) {
  const slots = [];
  const now = new Date();
  for (let i = 1; i <= count; i++) {
    const start = new Date(now.getTime() + i * 5 * 60 * 60 * 1000); // spread every 5h
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    slots.push({ startTime: start, endTime: end });
  }
  return slots;
}

async function main() {
  console.log("Seeding hospitals...");
  const hospitalIdByKey = {};
  for (const h of HOSPITALS) {
    const created = await prisma.hospital.create({
      data: {
        name: h.name,
        area: h.area,
        address: h.address,
        phone: h.phone,
        lat: h.lat,
        lng: h.lng,
        specialties: h.specialties,
        insurers: h.insurers,
        beds: h.beds,
        established: h.established,
        rating: h.rating,
      },
    });
    hospitalIdByKey[h.key] = created.id;

    // Demo bed status — clearly flagged isLiveFeed:false until a hospital
    // integration replaces it with real data (matches the frontend's
    // existing "DEMO figures" disclosure).
    const rnd = seededRandom(h.key);
    await prisma.hospitalBedStatus.create({
      data: {
        hospitalId: created.id,
        bedsAvailable: Math.max(1, Math.round(h.beds * 0.06 + rnd() * (h.beds * 0.1))),
        icuAvailable: Math.round(rnd() * 4),
        waitMinutes: Math.max(4, Math.round(rnd() * 30)),
        doctorOnDuty: rnd() > 0.15,
        ctAvailable: rnd() > 0.3,
        isLiveFeed: false,
      },
    });
  }

  console.log("Seeding doctors + slots...");
  for (const d of DOCTORS) {
    const doctor = await prisma.doctor.create({
      data: {
        hospitalId: hospitalIdByKey[d.hospitalKey],
        name: d.name,
        specialty: d.specialty,
        expYears: d.exp,
        rating: d.rating,
        fee: d.fee,
        languages: d.langs,
      },
    });
    await prisma.doctorSlot.createMany({
      data: upcomingSlots().map((s) => ({ doctorId: doctor.id, startTime: s.startTime, endTime: s.endTime })),
    });
  }

  console.log("Seeding cause categories...");
  for (const [i, c] of CAUSES.entries()) {
    await prisma.causeCategory.create({
      data: { slug: c.slug, label: c.label, specialty: c.specialty, icon: c.icon, sortOrder: i },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
