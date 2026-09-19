import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from "@react-google-maps/api";
import { useState } from "react";

const riskColor = {
  Low: "#2e7d32", Medium: "#f9a825", High: "#ef6c00", Critical: "#c62828",
};

export default function MapView({ projects }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  });
  const [active, setActive] = useState(null);

  if (!isLoaded) return <p>Loading map...</p>;

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "500px" }}
      center={{ lat: 22.9734, lng: 78.6569 }} // India centroid
      zoom={5}
    >
      {projects.map((p, i) => (
        <Marker
          key={i}
          position={{ lat: p.lat, lng: p.lng }}
          icon={{
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: riskColor[p.risk_band] || "#1976d2",
            fillOpacity: 1,
            strokeWeight: 1,
          }}
          onClick={() => setActive(p)}
        />
      ))}
      {active && (
        <InfoWindow position={{ lat: active.lat, lng: active.lng }} onCloseClick={() => setActive(null)}>
          <div>
            <strong>{active.project}</strong><br />
            {active.district}, {active.state}<br />
            Risk: {active.risk_band} ({active.risk_score}%)
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  );
}