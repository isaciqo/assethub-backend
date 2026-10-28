// Localização registrada no momento de cada ação (conferência, envio,
// recebimento). Não substitui a sala — GPS dentro de prédio erra dezenas de
// metros —, serve de prova de presença: "foi feito na unidade?".

// Raio a partir do ponto da unidade que ainda conta como "na unidade". Soma-se
// a precisão informada pelo aparelho para não acusar quem está com sinal ruim.
const UNIT_RADIUS_M = 300;

class GeoService {
  // Aceita só coordenadas plausíveis; qualquer outra coisa vira "sem localização".
  clean(geo) {
    if (!geo) return null;
    const lat = Number(geo.lat);
    const lng = Number(geo.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    const accuracy = Number(geo.accuracy);
    return { lat, lng, accuracy: Number.isFinite(accuracy) ? Math.round(accuracy) : null };
  }

  distanceMeters(a, b) {
    const R = 6371000;
    const rad = d => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return Math.round(2 * R * Math.asin(Math.sqrt(h)));
  }

  // { lat, lng, accuracy, distance_m, outside_unit } — distância só quando a
  // unidade tem ponto fixado.
  assess(rawGeo, unit) {
    const geo = this.clean(rawGeo);
    if (!geo) return null;
    const ref = unit?.geo?.lat != null ? unit.geo : null;
    if (!ref) return { ...geo, distance_m: null, outside_unit: false };
    const distance = this.distanceMeters(ref, geo);
    return { ...geo, distance_m: distance, outside_unit: distance > UNIT_RADIUS_M + (geo.accuracy || 0) };
  }
}

GeoService.UNIT_RADIUS_M = UNIT_RADIUS_M;

module.exports = GeoService;
