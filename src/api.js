const API_BASE_URL = "http://localhost:4000";

export async function getHospitals() {
  const response = await fetch(`${API_BASE_URL}/api/hospitals`);

  if (!response.ok) {
    throw new Error("Failed to load hospitals");
  }

  const data = await response.json();

  return data.hospitals;
}

export async function getCauses() {
  const response = await fetch(`${API_BASE_URL}/api/causes`);

  if (!response.ok) {
    throw new Error("Failed to load causes");
  }

  const data = await response.json();

  return data.causes;
}