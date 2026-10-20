[out:json][timeout:25][maxsize:16777216][bbox:51.500,-0.135,51.513,-0.115];
(
  nwr["amenity"~"^(hospital|clinic|school|pharmacy|bus_station)$"];
  nwr["healthcare"~"^(hospital|clinic|pharmacy)$"];
  nwr["shop"="supermarket"];
  nwr["railway"~"^(station|halt)$"];
  nwr["public_transport"="station"];
);
out body center;
