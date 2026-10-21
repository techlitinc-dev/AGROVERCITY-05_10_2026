/**
 * Minimal Google Maps JS API typings. @types/google.maps is intentionally not
 * installed — these declarations cover only what `lib/googleMaps.ts` and
 * `components/common/RouteMap.tsx` use. If the real types package is ever
 * added, this file should be deleted.
 */
declare namespace google {
  namespace maps {
    interface LatLngLiteral {
      lat: number;
      lng: number;
    }

    class LatLng {
      lat(): number;
      lng(): number;
    }

    type LatLngLike = LatLng | LatLngLiteral;

    class LatLngBounds {
      constructor(sw?: LatLngLike, ne?: LatLngLike);
      extend(point: LatLngLike): LatLngBounds;
      union(other: LatLngBounds): LatLngBounds;
      getNorthEast(): LatLng;
      getSouthWest(): LatLng;
      isEmpty(): boolean;
    }

    class Point {
      constructor(x: number, y: number);
    }

    class Size {
      constructor(width: number, height: number);
    }

    interface MapTypeStyle {
      featureType?: string;
      elementType?: string;
      stylers: Record<string, string | number | boolean>[];
    }

    interface MapOptions {
      center?: LatLngLike;
      zoom?: number;
      disableDefaultUI?: boolean;
      zoomControl?: boolean;
      gestureHandling?: string;
      backgroundColor?: string;
      styles?: MapTypeStyle[];
    }

    class Map {
      constructor(el: HTMLElement, opts?: MapOptions);
      setCenter(center: LatLngLike): void;
      setZoom(zoom: number): void;
      fitBounds(bounds: LatLngBounds, padding?: number | Point): void;
    }

    interface Symbol {
      path: string;
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWeight?: number;
      scale?: number;
      anchor?: Point;
    }

    interface Icon {
      url?: string;
      scaledSize?: Size;
      anchor?: Point;
    }

    interface MarkerLabel {
      text: string;
      color?: string;
      fontSize?: string;
      fontWeight?: string;
    }

    interface MarkerOptions {
      position?: LatLngLike;
      map?: Map | null;
      title?: string;
      icon?: string | Symbol | Icon;
      label?: string | MarkerLabel;
      zIndex?: number;
    }

    class Marker {
      constructor(opts?: MarkerOptions);
      setMap(map: Map | null): void;
    }

    class MVCArray<T> {
      getLength(): number;
      getAt(i: number): T;
      forEach(fn: (el: T, i: number) => void): void;
    }

    interface PolylineOptions {
      path?: LatLngLike[] | MVCArray<LatLng>;
      map?: Map | null;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeWeight?: number;
      geodesic?: boolean;
      zIndex?: number;
    }

    class Polyline {
      constructor(opts?: PolylineOptions);
      setMap(map: Map | null): void;
      getPath(): MVCArray<LatLng>;
    }

    interface MapsEventListener {
      remove(): void;
    }

    namespace event {
      function clearInstanceListeners(instance: object): void;
    }

    namespace geometry {
      namespace encoding {
        function decodePath(encodedPath: string): LatLng[];
      }
    }
  }
}

interface Window {
  google?: typeof google;
  __agroverGoogleMapsReady?: () => void;
}
