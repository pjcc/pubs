import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getTagIcon } from '../tagIcons.js';

// Default map centre
const BRIGHTON = [50.8225, -0.1372];

function esc(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function extractCoords(pub) {
  if (pub.extraInfo) {
    try {
      const info = typeof pub.extraInfo === 'string' ? JSON.parse(pub.extraInfo) : pub.extraInfo;
      if (info._lat != null && info._lng != null) return [info._lat, info._lng];
    } catch {}
  }
  const url = pub.mapsLink;
  if (!url) return null;
  const dMatches = [...url.matchAll(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/g)];
  if (dMatches.length) {
    const last = dMatches[dMatches.length - 1];
    return [parseFloat(last[1]), parseFloat(last[2])];
  }
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) return [parseFloat(atMatch[1]), parseFloat(atMatch[2])];
  return null;
}

function getThemeColor() {
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue('--accent-teal').trim() || '#4ecdc4';
}

function buildMarkerIcon(color) {
  const html = `<div class="marker-dot" style="background:${color}"></div>`;
  return L.divIcon({
    html,
    className: 'pub-div-marker',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function buildTooltipHtml(pub, showIcons) {
  let iconsLine = '';
  if (showIcons) {
    const icons = pub.tags
      .map((t) => getTagIcon(t))
      .filter(Boolean)
      .slice(0, 6);
    if (icons.length) {
      iconsLine = `<div class="marker-label-icons">${icons.join(' ')}</div>`;
    }
  }
  return `<div class="marker-label-name">${esc(pub.name)}</div>${iconsLine}`;
}

export default function MapView({ pubs, theme, showIcons }) {
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;

    const coords = pubs
      .map((p) => extractCoords(p))
      .filter(Boolean);

    const map = L.map(containerRef.current);
    if (coords.length > 1) {
      map.fitBounds(coords, { padding: [30, 30], maxZoom: 16 });
    } else if (coords.length === 1) {
      map.setView(coords[0], 15);
    } else {
      map.setView(BRIGHTON, 14);
    }

    const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    });
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri',
      maxZoom: 19,
    });
    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
      maxZoom: 17,
    });
    const watercolor = L.tileLayer('https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg', {
      attribution: '&copy; <a href="https://stamen.com">Stamen</a>',
      maxZoom: 16,
    });

    const layers = { 'Streets': streets, 'Satellite': satellite, 'Topo': topo, 'Watercolour': watercolor };
    const savedLayer = localStorage.getItem('brighton-pubs-map-style') || 'Streets';
    (layers[savedLayer] || streets).addTo(map);

    const control = L.control.layers(layers, null, { position: 'topright' }).addTo(map);
    map.on('baselayerchange', (e) => {
      localStorage.setItem('brighton-pubs-map-style', e.name);
    });

    layerRef.current = L.layerGroup().addTo(map);

    // Locate user button
    const LocateControl = L.Control.extend({
      options: { position: 'topleft' },
      onAdd() {
        const btn = L.DomUtil.create('div', 'leaflet-bar leaflet-control locate-btn');
        btn.innerHTML = '<a href="#" title="Show my location" role="button" aria-label="Show my location">&#9678;</a>';
        btn.querySelector('a').onclick = (e) => {
          e.preventDefault();
          map.locate({ setView: true, maxZoom: 15 });
        };
        return btn;
      },
    });
    new LocateControl().addTo(map);

    let userMarker = null;
    let userCircle = null;
    map.on('locationfound', (e) => {
      const r = e.accuracy / 2;
      if (userMarker) {
        userMarker.setLatLng(e.latlng);
        userCircle.setLatLng(e.latlng).setRadius(r);
      } else {
        userMarker = L.circleMarker(e.latlng, {
          radius: 7, fillColor: '#4285f4', fillOpacity: 1,
          color: '#fff', weight: 2,
        }).addTo(map).bindPopup('You are here');
        userCircle = L.circle(e.latlng, { radius: r, color: '#4285f4', fillOpacity: 0.1, weight: 1 }).addTo(map);
      }
    });
    map.on('locationerror', () => {});

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;

    layerRef.current.clearLayers();

    const color = getThemeColor();
    const bounds = [];

    for (const pub of pubs) {
      const coords = extractCoords(pub);
      if (!coords) continue;
      bounds.push(coords);

      const icon = buildMarkerIcon(color);
      const marker = L.marker(coords, { icon }).addTo(layerRef.current);

      const tooltip = marker.bindTooltip(buildTooltipHtml(pub, showIcons), {
        permanent: true,
        interactive: true,
        direction: 'top',
        offset: [0, -4],
        className: 'pub-marker-label',
      }).getTooltip();

      if (tooltip) {
        const el = tooltip.getElement?.bind(tooltip);
        marker.on('tooltipopen', () => {
          const tooltipEl = el ? el() : tooltip._container;
          if (tooltipEl) {
            tooltipEl.style.cursor = 'pointer';
            tooltipEl.onclick = () => marker.openPopup();
          }
        });
      }

      const rating = pub.mapsRating ? ` <span style="color:#e8a317">★ ${esc(String(pub.mapsRating))}</span>` : '';
      const area = pub.area ? `<br><small style="opacity:0.7">${esc(pub.area)}</small>` : '';
      const tags = pub.tags.length ? `<br><small>${pub.tags.map(esc).join(', ')}</small>` : '';
      const link = pub.mapsLink ? `<br><a href="${esc(pub.mapsLink)}" target="_blank" rel="noopener noreferrer" style="font-size:11px">Open in Google Maps</a>` : '';
      marker.bindPopup(`<strong>${esc(pub.name)}</strong>${rating}${area}${tags}${link}`);
    }

    if (bounds.length > 1) {
      mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 16 });
    } else if (bounds.length === 1) {
      mapRef.current.setView(bounds[0], 15);
    }
  }, [pubs, theme, showIcons]);

  return <div ref={containerRef} className="map-container" />;
}
